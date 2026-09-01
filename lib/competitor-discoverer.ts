import { PoolClient } from 'pg';

/**
 * 清洗公司名称，去除常见法律实体后缀及首尾特殊符号
 */
export function cleanCompanyName(rawName: string): string {
  if (!rawName) return '';
  let name = rawName.trim();

  // 剔除前后引号、括号、标点符号
  name = name.replace(/^["'“”‘’（(\[\s\.,，。]+|["'“”‘’）)\]\s\.,，。]+$/g, '').trim();

  // 常见噪音词拦截
  const noiseWords = [
    '未知', '待定', '无', 'none', 'n/a', 'null', 'undefined',
    '中国供应商', '产业集群', '批发市场', '行业均值', '其他', '电商平台'
  ];
  if (noiseWords.includes(name.toLowerCase())) {
    return '';
  }

  // 去除末尾常见的法律形式后缀 (不区分大小写，支持各种缩写与点号)
  // 例: "TEDi GmbH & Co. KG" -> "TEDi", "Action B.V." -> "Action", "Feron Co., Ltd." -> "Feron"
  const legalSuffixRegex = /[\s,\-\.]+(gmbh\s*&\s*co\.?\s*kg|gmbh|co\.?,\s*ltd\.?|co\.?\s*ltd\.?|ltd\.?|inc\.?|corp\.?|corporation|b\.?v\.?|s\.?a\.?|s\.?r\.?l\.?|s\.?p\.?a\.?|plc|ag|holding|group|oy|ab|as)[\s\.]*$/i;
  
  const cleaned = name.replace(legalSuffixRegex, '').trim().replace(/[\s,\-\.]+$/, '');
  if (cleaned.length >= 2) {
    return cleaned;
  }

  return name;
}

export interface CompetitorInput {
  name: string;
  country?: string;
  website?: string;
}

/**
 * 解析竞争对手元数据字符串
 * 支持以下格式：
 * 1. 基础逗号分隔: "TEDi, Europris, Normal, Flying Tiger Copenhagen"
 * 2. 增强竖线/详情格式: "TEDi|德国|https://tedi.com, Europris|挪威|https://europris.no"
 */
export function parseCompetitorString(rawCompetitors: string, defaultCountry = '全球'): CompetitorInput[] {
  if (!rawCompetitors || !rawCompetitors.trim()) return [];

  const items = rawCompetitors
    .split(/,|，|\n/)
    .map(s => s.trim())
    .filter(Boolean);

  const results: CompetitorInput[] = [];

  for (const item of items) {
    if (item.includes('|')) {
      const parts = item.split('|').map(s => s.trim());
      const name = cleanCompanyName(parts[0]);
      if (name) {
        results.push({
          name,
          country: parts[1] || defaultCountry,
          website: parts[2] || undefined,
        });
      }
    } else {
      const name = cleanCompanyName(item);
      if (name) {
        results.push({
          name,
          country: defaultCountry,
        });
      }
    }
  }

  return results;
}

/**
 * 发现并自动将新竞争对手加入调研任务队列 (research_tasks)
 * 具备三级智能去重：
 * 1. reports 报告库查重（主体与别名）
 * 2. entities / entity_aliases 查重（若已有对应的已发布报告主体）
 * 3. research_tasks 任务池查重（无论处于 pending, running 还是 completed）
 */
export async function discoverAndQueueCompetitors(
  dbClient: PoolClient,
  competitorsRaw: string,
  sourceCompanyName: string,
  sourceReportId: string,
  sourceCountry = '全球',
  batchName = '竞品裂变发现'
): Promise<{ added: string[]; skipped: string[] }> {
  const competitorList = parseCompetitorString(competitorsRaw, sourceCountry);
  const added: string[] = [];
  const skipped: string[] = [];

  if (competitorList.length === 0) {
    return { added, skipped };
  }

  for (const comp of competitorList) {
    const compName = comp.name;
    const compLower = compName.toLowerCase();

    // 1. 检查是否与母公司自身同名
    if (compLower === sourceCompanyName.toLowerCase().trim()) {
      skipped.push(`${compName} (与母公司同名)`);
      continue;
    }

    // 2. 检查 reports 表中是否已存在该公司的已发布报告 (按主体及别名)
    const existingReportRes = await dbClient.query(
      `SELECT r.id 
       FROM reports r
       LEFT JOIN report_entities re ON r.id = re.report_id AND re.role = 'primary'
       LEFT JOIN entities e ON re.entity_id = e.id
       LEFT JOIN entity_aliases ea ON e.id = ea.entity_id
       WHERE r.category = 'customer' 
         AND (
           LOWER(e.canonical_name) = $1 
           OR LOWER(ea.alias_name) = $1
           OR LOWER(r.title) LIKE $2
         )
       LIMIT 1`,
      [compLower, `%${compLower}%`]
    );

    if (existingReportRes.rows.length > 0) {
      skipped.push(`${compName} (已有正式报告: ${existingReportRes.rows[0].id})`);
      continue;
    }

    // 3. 检查 research_tasks 任务池中是否已有该客户
    const existingTaskRes = await dbClient.query(
      `SELECT id, status, seq_no FROM research_tasks 
       WHERE LOWER(TRIM(company_name)) = $1 
       LIMIT 1`,
      [compLower]
    );

    if (existingTaskRes.rows.length > 0) {
      skipped.push(`${compName} (已在任务池中: #${existingTaskRes.rows[0].seq_no} [${existingTaskRes.rows[0].status}])`);
      continue;
    }

    // 4. 确认不存在，作为新发现的潜在客户原子插入 research_tasks (候补优先级 priority: 20)
    await dbClient.query(
      `INSERT INTO research_tasks (
        batch_name,
        company_name,
        country,
        website,
        status,
        source_type,
        source_report_id,
        source_company_name,
        priority
      ) VALUES ($1, $2, $3, $4, 'pending', 'competitor_discovery', $5, $6, 20)
      ON CONFLICT DO NOTHING`,
      [
        batchName,
        compName,
        comp.country || sourceCountry,
        comp.website || null,
        sourceReportId,
        sourceCompanyName
      ]
    );

    added.push(compName);
    console.log(`[Competitor Discovery] 自动发现新竞品并加入待调研队列: ${compName} (来源: ${sourceCompanyName})`);
  }

  return { added, skipped };
}
