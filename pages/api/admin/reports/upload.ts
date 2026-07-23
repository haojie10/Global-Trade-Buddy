import { NextApiRequest, NextApiResponse } from 'next';
import { PoolClient } from 'pg';
import { withDb } from '../../../../lib/api-handler';
import { requireAdmin } from '../../../../lib/auth';
import { parseMetadata, runDehydration, extractAndNormalizeEntities } from '../../../../lib/entity-extractor';
import { getStandardCategory } from '../../../../lib/category-mapper';
import { uploadImage, cleanOrphanedImages } from '../../../../lib/storage';
import { RETAILER_ENTITIES } from '../../../../lib/entity-constants';

async function uploadHandler(req: NextApiRequest, res: NextApiResponse, dbClient: PoolClient) {
  const adminSession = requireAdmin(req);
  if (!adminSession) {
    return res.status(403).json({ error: '权限不足，仅管理员可执行此操作' });
  }

  const { rawHtml, manualTags, category, summary, overwriteReportId, industry_ids, country_ids } = req.body;

  // 1. 脱水处理（图片统一走 lib/storage.ts）
  const { cleanHtml, imageCount } = await runDehydration(rawHtml, uploadImage);

  // 2. 元数据及实体提取
  const meta = parseMetadata(rawHtml);

  // 提取兼顾 HTML head 里的 company_aliases 标记
  const metaAliasesMatch = rawHtml.match(/<meta[^>]*?name=["']company_aliases["'][^>]*?content=["']([^"']*?)["']/i);
  const metaAliases = metaAliasesMatch ? metaAliasesMatch[1].split(/,|，|\/|\||;|；/).map((s: string) => s.trim()).filter(Boolean) : [];

  const mergedManualTags = {
    ...manualTags,
    companyAliases: Array.from(new Set([
      ...(manualTags?.companyAliases || []),
      ...metaAliases
    ]))
  };

  // 处理手动标记的地区标签
  let regionsList: string[] = [];
  if (mergedManualTags?.regions) {
    regionsList = mergedManualTags.regions.map((r: string) => r.trim()).filter(Boolean);
  }
  
  // 合并自动提取的地区（如果不是“全球”默认值）
  if (meta.market_region && meta.market_region !== '全球') {
    regionsList.push(meta.market_region);
  }
  
  // 如果最终列表为空，则使用自动提取的地区或“全球”
  if (regionsList.length === 0) {
    regionsList = [meta.market_region || '全球'];
  }
  
  const finalMarketRegion = Array.from(new Set(regionsList)).join(', ');

  await dbClient.query('BEGIN');

  // 4. 确定分类和摘要
  const finalCategory = category || meta.category;
  const finalSummary = summary !== undefined ? summary.trim() : meta.summary;

  // 3. 提取并归一化实体
  const resolvedEntities = await extractAndNormalizeEntities(
    rawHtml,
    meta.title,
    dbClient,
    mergedManualTags,
    meta.primary_subject,
    finalCategory
  );

  // 找到主体公司的实体 ID
  const primaryEnt = resolvedEntities.find(e => e.role === 'primary');
  const primaryEntityId = primaryEnt ? primaryEnt.id : null;

  let newReportId = overwriteReportId;
  // NOTE: 覆盖更新前需保存旧 content_html，事务后用于对比并清理孤儿图片
  let oldContentHtmlForOverwrite: string | null = null;

  if (overwriteReportId) {
    // 先查询旧的 content_html
    const oldContentRes = await dbClient.query(
      'SELECT content_html FROM reports WHERE id = $1',
      [overwriteReportId]
    );
    oldContentHtmlForOverwrite = oldContentRes.rows[0]?.content_html || null;

    // 覆盖更新模式：更新报告内容，同时更新主体实体关联
    await dbClient.query(
      `UPDATE reports 
       SET title = $1, category = $2, market_region = $3, summary = $4, content_html = $5, primary_entity_id = $6
       WHERE id = $7`,
      [meta.title, finalCategory, finalMarketRegion, finalSummary, cleanHtml, primaryEntityId, overwriteReportId]
    );

    // 清理旧的报告与实体的映射，以便重新建立
    await dbClient.query(`DELETE FROM report_entities WHERE report_id = $1`, [overwriteReportId]);
  } else {
    // 新建模式
    const insertReportRes = await dbClient.query(
      `INSERT INTO reports (title, category, market_region, summary, content_html, primary_entity_id) 
       VALUES ($1, $2, $3, $4, $5, $6) 
       RETURNING id`,
      [meta.title, finalCategory, finalMarketRegion, finalSummary, cleanHtml, primaryEntityId]
    );
    newReportId = insertReportRes.rows[0].id;
  }

  // 保存行业与国家关联
  await dbClient.query('DELETE FROM report_industries WHERE report_id = $1', [newReportId]);
  await dbClient.query('DELETE FROM report_countries WHERE report_id = $1', [newReportId]);

  if (Array.isArray(industry_ids)) {
    for (const indId of industry_ids) {
      if (indId) {
        await dbClient.query(
          'INSERT INTO report_industries (report_id, industry_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
          [newReportId, indId]
        );
      }
    }
  }

  // 自动从 HTML 的 products 元数据提取行业并建立关联 (将产品名自动映射到 54 个标准大类)
  let autoIndustries: string[] = [];
  if (manualTags?.products && Array.isArray(manualTags.products)) {
    autoIndustries = manualTags.products.map((p: string) => p.trim()).filter(Boolean);
  }

  const ignoredCategories: string[] = [];
  for (const indName of autoIndustries) {
    const mappedCategory = getStandardCategory(indName);
    if (!mappedCategory) {
      ignoredCategories.push(indName);
      continue;
    }
    const indRes = await dbClient.query(
      'INSERT INTO industries (name) VALUES ($1) ON CONFLICT (name) DO UPDATE SET name = EXCLUDED.name RETURNING id',
      [mappedCategory]
    );
    const indId = indRes.rows[0].id;
    await dbClient.query(
      'INSERT INTO report_industries (report_id, industry_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
      [newReportId, indId]
    );
  }

  if (Array.isArray(country_ids)) {
    for (const ctyId of country_ids) {
      if (ctyId) {
        await dbClient.query(
          'INSERT INTO report_countries (report_id, country_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
          [newReportId, ctyId]
        );
      }
    }
  }

  // 自动从 HTML 的 market_region 提取国家并建立关联
  const autoCountries = finalMarketRegion.split(',').map(s => s.trim()).filter(Boolean);
  for (const ctyName of autoCountries) {
    let lookupName = ctyName;
    if (ctyName.toLowerCase() === 'germany') lookupName = '德国';
    if (ctyName.toLowerCase() === 'austria') lookupName = '奥地利';
    
    const ctyRes = await dbClient.query('SELECT id FROM countries WHERE name = $1 LIMIT 1', [lookupName]);
    if (ctyRes.rows.length > 0) {
      const ctyId = ctyRes.rows[0].id;
      await dbClient.query(
        'INSERT INTO report_countries (report_id, country_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
        [newReportId, ctyId]
      );
    }
  }

  // 5. 写入 report_entities 表并携带其扮演的角色 role
  for (const ent of resolvedEntities) {
    await dbClient.query(
      `INSERT INTO report_entities (report_id, entity_id, role) 
       VALUES ($1, $2, $3) 
       ON CONFLICT (report_id, entity_id) DO UPDATE SET role = EXCLUDED.role`,
      [newReportId, ent.id, ent.role]
    );
  }

  // 5.5 自动关系推理逻辑 (1个产品，多个公司 -> 两两建立 competitor 关系)
  if (manualTags?.products) {
    const productNames = manualTags.products.map((p: string) => p.trim()).filter(Boolean);
    
    if (productNames.length === 1) {
      const companyNames: string[] = [];
      if (manualTags.companies && manualTags.companies.length > 0) {
        companyNames.push(manualTags.companies[0]);
      }
      const otherCompanies = [
        ...(manualTags.competitors || []),
        ...(manualTags.suppliers || []),
        ...(manualTags.customers || []),
        ...(manualTags.sisters || [])
      ].map(c => c.trim()).filter(Boolean);
      
      const allCompanyNames = Array.from(new Set([...companyNames, ...otherCompanies]));

      if (allCompanyNames.length > 1) {
        const compRes = await dbClient.query(
          `SELECT id FROM entities WHERE canonical_name = ANY($1) AND entity_type = 'company'`,
          [allCompanyNames]
        );
        const compIds = compRes.rows.map((r: any) => r.id);
        
        for (let i = 0; i < compIds.length; i++) {
          for (let j = i + 1; j < compIds.length; j++) {
            await dbClient.query(
              `INSERT INTO entity_relations (entity_id_a, entity_id_b, relation_type, market_region)
               VALUES ($1, $2, 'competitor', $3)
               ON CONFLICT (entity_id_a, entity_id_b, relation_type, market_region) DO NOTHING`,
              [compIds[i], compIds[j], finalMarketRegion || null]
            );
          }
        }
      }
    }
  }

  // 6. 在 relations 表中建边并携带 market_region 属性
  // 遵循用户定义逻辑：
  // 1. 竞争: A 显式提及 B 为 competitor (或反之)，且剔除渠道商/超市
  // 2. 供销: A 提及 B 为 supplier (或 B 提及 A 为 customer/channel)
  // 3. 经营: 仅存在于【品类报告】与【公司报告】之间
  // 4. 提及: 姐妹公司 或 共享 GTB 大品类
  // 优先级: 竞争 > 供销 > 经营 > 提及
  
  // 获取当前报告 A 所有的实体及其 role
  const currentRepEntities = await dbClient.query(
    `SELECT re.entity_id, re.role, e.canonical_name, e.entity_type
     FROM report_entities re
     JOIN entities e ON re.entity_id = e.id
     WHERE re.report_id = $1`,
    [newReportId]
  );

  // 查询所有其他报告 B 及其主体实体
  const otherReportsRes = await dbClient.query(
    `SELECT r.id AS b_report_id, r.category AS b_category, r.primary_entity_id AS b_primary_id,
            e.canonical_name AS b_primary_name
     FROM reports r
     LEFT JOIN entities e ON r.primary_entity_id = e.id
     WHERE r.id != $1`,
    [newReportId]
  );

  // 获取所有报告关联的实体角色组合
  const allRepEntitiesRes = await dbClient.query(
    `SELECT re.report_id, re.entity_id, re.role, e.canonical_name, e.entity_type
     FROM report_entities re
     JOIN entities e ON re.entity_id = e.id`
  );

  const otherRepEntMap = new Map<string, Map<string, { role: string; canonical_name: string; entity_type: string }>>();
  for (const row of allRepEntitiesRes.rows) {
    if (!otherRepEntMap.has(row.report_id)) {
      otherRepEntMap.set(row.report_id, new Map());
    }
    otherRepEntMap.get(row.report_id)!.set(row.entity_id, {
      role: row.role,
      canonical_name: row.canonical_name,
      entity_type: row.entity_type
    });
  }

  const currentEntMap = new Map<string, { role: string; canonical_name: string; entity_type: string }>();
  for (const row of currentRepEntities.rows) {
    currentEntMap.set(row.entity_id, {
      role: row.role,
      canonical_name: row.canonical_name,
      entity_type: row.entity_type
    });
  }

  const primaryEntNameA = primaryEnt ? primaryEnt.canonical_name.toLowerCase().trim() : '';

  for (const otherRep of otherReportsRes.rows) {
    const bReportId = otherRep.b_report_id;
    const bCategory = otherRep.b_category;
    const bPrimaryId = otherRep.b_primary_id;
    const bPrimaryName = otherRep.b_primary_name ? otherRep.b_primary_name.toLowerCase().trim() : '';

    const entMapB = otherRepEntMap.get(bReportId) || new Map();

    let finalRelType: string | null = null;
    let finalRelKey: string = '';

    // ---- 优先级 1: 竞争关系 (Competitor) ----
    const aHasBAsComp = bPrimaryId && currentEntMap.has(bPrimaryId) && currentEntMap.get(bPrimaryId)!.role === 'competitor';
    const bHasAAsComp = primaryEntityId && entMapB.has(primaryEntityId) && entMapB.get(primaryEntityId)!.role === 'competitor';

    const isRetailerA = RETAILER_ENTITIES.has(primaryEntNameA);
    const isRetailerB = RETAILER_ENTITIES.has(bPrimaryName);
    const isRetailerInvolved = isRetailerA || isRetailerB;

    if ((aHasBAsComp || bHasAAsComp) && !isRetailerInvolved) {
      finalRelType = 'competitor';
      finalRelKey = aHasBAsComp 
        ? (otherRep.b_primary_name || '同业竞争') 
        : (primaryEnt ? primaryEnt.canonical_name : '同业竞争');
    }

    // ---- 优先级 2: 供销关系 (Produces / Supply) ----
    if (!finalRelType) {
      const aHasBAsSupplier = bPrimaryId && currentEntMap.has(bPrimaryId) && currentEntMap.get(bPrimaryId)!.role === 'supplier';
      const bHasAAsCustomerOrChannel = primaryEntityId && entMapB.has(primaryEntityId) && 
        ['customer', 'channel'].includes(entMapB.get(primaryEntityId)!.role);

      const bHasAAsSupplier = primaryEntityId && entMapB.has(primaryEntityId) && entMapB.get(primaryEntityId)!.role === 'supplier';
      const aHasBAsCustomerOrChannel = bPrimaryId && currentEntMap.has(bPrimaryId) && 
        ['customer', 'channel'].includes(currentEntMap.get(bPrimaryId)!.role);

      if (aHasBAsSupplier || bHasAAsCustomerOrChannel) {
        finalRelType = 'supplier';
        finalRelKey = otherRep.b_primary_name || '供销渠道';
      } else if (bHasAAsSupplier || aHasBAsCustomerOrChannel) {
        finalRelType = 'supplier';
        finalRelKey = primaryEnt ? primaryEnt.canonical_name : '供销渠道';
      }
    }

    // ---- 优先级 3: 经营关系 (Operation) ----
    // 仅存在于【品类报告】与【公司报告】之间！
    if (!finalRelType) {
      const isOneProductOneCompany = (finalCategory === 'product' && bCategory === 'customer') || 
                                     (finalCategory === 'customer' && bCategory === 'product');
      if (isOneProductOneCompany) {
        for (const [entIdA, dataA] of currentEntMap.entries()) {
          if (dataA.role === 'product' && entMapB.has(entIdA)) {
            finalRelType = 'operation';
            finalRelKey = dataA.canonical_name;
            break;
          }
        }
      }
    }

    // ---- 优先级 4: 提及关系 (Mention) ----
    if (!finalRelType) {
      const aHasBAsSister = bPrimaryId && currentEntMap.has(bPrimaryId) && currentEntMap.get(bPrimaryId)!.role === 'sister_parent';
      const bHasAAsSister = primaryEntityId && entMapB.has(primaryEntityId) && entMapB.get(primaryEntityId)!.role === 'sister_parent';

      if (aHasBAsSister || bHasAAsSister) {
        finalRelType = 'mention';
        finalRelKey = '关联/姐妹公司';
      } else {
        // 共享 GTB 标准大品类 (products)
        for (const [entIdA, dataA] of currentEntMap.entries()) {
          if (dataA.role === 'product' && entMapB.has(entIdA) && entMapB.get(entIdA)!.role === 'product') {
            finalRelType = 'mention';
            finalRelKey = dataA.canonical_name;
            break;
          }
        }
      }
    }

    if (finalRelType) {
      await dbClient.query(
        `INSERT INTO relations (report_id_a, report_id_b, relation_key, market_region, relation_type) 
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (report_id_a, report_id_b, relation_key) DO UPDATE SET relation_type = EXCLUDED.relation_type`,
        [newReportId, bReportId, finalRelKey, finalMarketRegion, finalRelType]
      );
    }
  }

  await dbClient.query('COMMIT');

  // 事务提交成功后，异步对比并清理覆盖前的孤儿图片（不阻塞响应）
  if (oldContentHtmlForOverwrite !== null) {
    cleanOrphanedImages(oldContentHtmlForOverwrite, cleanHtml).catch((err: any) => {
      console.error('[WARN] upload: 孤儿图片清理失败:', err.message);
    });
  }

  return res.status(200).json({
    success: true,
    reportId: newReportId,
    imageCount,
    title: meta.title,
    ignoredCategories
  });
}

export default withDb(uploadHandler, {
  methods: ['POST'],
  requiredBody: ['rawHtml']
});

export const config = {
  api: {
    bodyParser: {
      sizeLimit: '20mb',
    },
  },
};
