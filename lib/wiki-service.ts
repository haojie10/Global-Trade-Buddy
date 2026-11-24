import type { PoolClient, Client } from 'pg';
import { extractRootDomain, cleanCompanyNameForLookup } from './crm-service';
import { getRegionByCountryName } from './region-country-mapper';
import {
  MarketFlowData,
  WikiFaqItem,
  WikiSourceItem,
  normalizeWikiSlug,
  validateMarketFlowData,
  generateDefaultFaqs,
} from './wiki-schema';

export type DbQueryable = Pick<PoolClient | Client, 'query'>;

export interface PlayerAssetMatch {
  reportId: string | null;
  reportTitle: string | null;
  contactCount: number;
}

export interface RelatedWikiReport {
  id: string;
  title: string;
  category: string;
  market_region: string;
  summary: string;
}

export interface UpsertWikiPayload {
  slug?: string;
  title: string;
  summary: string;
  flow_data: MarketFlowData;
  content_md: string;
  faq_items?: WikiFaqItem[];
  sources?: WikiSourceItem[];
  video_url?: string | null;
  cover_image?: string | null;
  status?: 'draft' | 'published';
}

const MIN_CLEAN_NAME_LENGTH = 3;
const RELATED_SUMMARY_MAX_LEN = 120;

/**
 * 转义 PostgreSQL ILIKE 通配符（\、%、_），防止用户输入特殊字符导致宽泛匹配
 */
function escapeIlikePattern(raw: string): string {
  return raw.replace(/[\\%_]/g, (ch) => `\\${ch}`);
}

/**
 * 批量将百科图谱中的渠道玩家与站内 reports、crm_contacts 碰撞，返回脱敏汇总结果。
 * 全程最多发出 2 条批量 SQL（无 N+1 查询），且绝不查询或返回 email 明文、phone 或 source_session。
 * @param flowData 行业市场流转结构数据
 * @param dbClient 数据库查询连接
 * @returns 以根域名（优先）或清洗公司名为键的资产匹配映射
 */
export async function matchPlayersWithPlatformAssets(
  flowData: MarketFlowData,
  dbClient: DbQueryable
): Promise<Record<string, PlayerAssetMatch>> {
  const matchMap = new Map<string, PlayerAssetMatch>();
  const domainSet = new Set<string>();
  const cleanNameSet = new Set<string>();
  const playerEntries: Array<{ key: string; domain: string; matchableCleanName: string }> = [];

  for (const node of flowData?.flow_nodes || []) {
    for (const player of node?.players || []) {
      const domain = extractRootDomain(player.website);
      const cleanName = cleanCompanyNameForLookup(player.name);
      const key = domain || cleanName;
      if (!key) continue;

      // 仅长度 >= 3 的清洗公司名纳入碰撞，杜绝短词误匹配
      const matchableCleanName = cleanName.length >= MIN_CLEAN_NAME_LENGTH ? cleanName : '';
      if (domain) domainSet.add(domain);
      if (matchableCleanName) cleanNameSet.add(matchableCleanName);

      playerEntries.push({ key, domain, matchableCleanName });
      if (!matchMap.has(key)) {
        matchMap.set(key, { reportId: null, reportTitle: null, contactCount: 0 });
      }
    }
  }

  const domains = Array.from(domainSet);
  const cleanNames = Array.from(cleanNameSet);
  if (domains.length === 0 && cleanNames.length === 0) {
    return Object.fromEntries(matchMap);
  }

  // 1. 批量匹配站内深度研报（使用 cardinality 安全判断空数组，按根域名优先、其次清洗公司名回填）
  try {
    const repRes = await dbClient.query(
      `SELECT id, title, website_domain, clean_company
       FROM reports
       WHERE (cardinality($1::text[]) > 0 AND website_domain = ANY($1::text[]))
          OR (cardinality($2::text[]) > 0 AND clean_company = ANY($2::text[]))
       ORDER BY created_at DESC`,
      [domains, cleanNames]
    );

    const byDomain = new Map<string, { id: string; title: string }>();
    const byCleanName = new Map<string, { id: string; title: string }>();
    for (const row of repRes.rows) {
      if (row.website_domain && !byDomain.has(row.website_domain)) {
        byDomain.set(row.website_domain, { id: row.id, title: row.title });
      }
      if (row.clean_company && !byCleanName.has(row.clean_company)) {
        byCleanName.set(row.clean_company, { id: row.id, title: row.title });
      }
    }

    for (const entry of playerEntries) {
      const matched =
        (entry.domain && byDomain.get(entry.domain)) ||
        (entry.matchableCleanName && byCleanName.get(entry.matchableCleanName));
      const target = matchMap.get(entry.key);
      if (matched && target) {
        target.reportId = matched.id;
        target.reportTitle = matched.title;
      }
    }
  } catch (err) {
    console.warn('[WikiService] 匹配站内 reports 降级跳过:', (err as Error).message);
  }

  // 2. 通过 UNION ALL 分别按域名与清洗公司名独立聚合去重计数，杜绝跨维度累加重复计数与隐私泄露
  try {
    const crmRes = await dbClient.query(
      `SELECT 'domain' AS match_type, website_domain AS match_key, COUNT(DISTINCT email)::int AS cnt
       FROM crm_contacts
       WHERE cardinality($1::text[]) > 0 AND website_domain = ANY($1::text[])
       GROUP BY website_domain
       UNION ALL
       SELECT 'name' AS match_type, clean_company_name AS match_key, COUNT(DISTINCT email)::int AS cnt
       FROM crm_contacts
       WHERE cardinality($2::text[]) > 0 AND clean_company_name = ANY($2::text[])
       GROUP BY clean_company_name`,
      [domains, cleanNames]
    );

    const countByDomain = new Map<string, number>();
    const countByCleanName = new Map<string, number>();
    for (const row of crmRes.rows) {
      const cnt = Number(row.cnt || 0);
      if (row.match_type === 'domain' && row.match_key) {
        countByDomain.set(row.match_key, cnt);
      } else if (row.match_type === 'name' && row.match_key) {
        countByCleanName.set(row.match_key, cnt);
      }
    }

    for (const entry of playerEntries) {
      const target = matchMap.get(entry.key);
      if (!target) continue;
      const domainCnt = entry.domain ? (countByDomain.get(entry.domain) || 0) : 0;
      const nameCnt = entry.matchableCleanName ? (countByCleanName.get(entry.matchableCleanName) || 0) : 0;
      target.contactCount = domainCnt > 0 ? domainCnt : nameCnt;
    }
  } catch (err) {
    console.warn('[WikiService] 匹配 crm_contacts 计数降级为 0:', (err as Error).message);
  }

  return Object.fromEntries(matchMap);
}

/**
 * 检索同品类或同国家的站内深度研报，用于百科详情页延伸阅读与转化引导
 * @param industryName 品类名称
 * @param countryName 国家中文名称
 * @param dbClient 数据库查询连接
 * @param limit 返回上限，默认 4 条
 * @returns 截断摘要后的关联研报列表，异常时降级返回空数组
 */
export async function getRelatedReportsForWiki(
  industryName: string,
  countryName: string,
  dbClient: DbQueryable,
  limit = 4
): Promise<RelatedWikiReport[]> {
  const cleanIndustry = String(industryName || '').trim();
  const cleanCountry = String(countryName || '').trim();
  if (!cleanIndustry && !cleanCountry) {
    return [];
  }

  const safeLimit = Math.max(1, Math.min(20, Math.floor(limit) || 4));
  const whereClauses: string[] = [];
  const params: unknown[] = [];

  if (cleanIndustry) {
    params.push(cleanIndustry);
    const eqIdx = params.length;
    params.push(`%${escapeIlikePattern(cleanIndustry)}%`);
    const likeIdx = params.length;
    whereClauses.push(`ind.name = $${eqIdx} OR r.title ILIKE $${likeIdx}`);
  }
  if (cleanCountry) {
    params.push(cleanCountry);
    const cntIdx = params.length;
    params.push(`%${escapeIlikePattern(cleanCountry)}%`);
    const likeIdx = params.length;
    whereClauses.push(`cnt.name = $${cntIdx} OR r.market_region ILIKE $${likeIdx} OR r.title ILIKE $${likeIdx}`);
  }

  params.push(safeLimit);
  const limitIdx = params.length;

  try {
    const res = await dbClient.query(
      `SELECT DISTINCT r.id, r.title, r.category, r.market_region, r.summary, r.created_at
       FROM reports r
       LEFT JOIN report_industries ri ON r.id = ri.report_id
       LEFT JOIN industries ind ON ri.industry_id = ind.id
       LEFT JOIN report_countries rc ON r.id = rc.report_id
       LEFT JOIN countries cnt ON rc.country_id = cnt.id
       WHERE ${whereClauses.join(' OR ')}
       ORDER BY r.created_at DESC
       LIMIT $${limitIdx}`,
      params
    );

    return res.rows.map((row: Record<string, unknown>) => {
      const rawSummary = typeof row.summary === 'string' ? row.summary : '';
      return {
        id: String(row.id),
        title: String(row.title || ''),
        category: String(row.category || 'customer'),
        market_region: String(row.market_region || ''),
        summary:
          rawSummary.length > RELATED_SUMMARY_MAX_LEN
            ? `${rawSummary.slice(0, RELATED_SUMMARY_MAX_LEN)}...`
            : rawSummary,
      };
    });
  } catch (err) {
    console.warn('[WikiService] 检索延伸研报失败:', (err as Error).message);
    return [];
  }
}

/**
 * 幂等创建或更新行业百科词条（按 slug 原子 Upsert）
 * @param dbClient 数据库查询连接
 * @param payload 百科入库负载
 * @returns 入库后的 id、规范化 slug 与原子判定的操作类型（created / updated）
 */
export async function upsertWikiEntry(
  dbClient: DbQueryable,
  payload: UpsertWikiPayload
): Promise<{ id: string; slug: string; action: 'created' | 'updated' }> {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    throw new Error('upsertWikiEntry payload 必须为非空对象');
  }

  const validation = validateMarketFlowData(payload.flow_data);
  if (!validation.valid) {
    throw new Error(`flow_data 校验失败: ${validation.errors.join('; ')}`);
  }

  if (
    typeof payload.title !== 'string' ||
    !payload.title.trim() ||
    typeof payload.summary !== 'string' ||
    !payload.summary.trim() ||
    typeof payload.content_md !== 'string' ||
    !payload.content_md.trim()
  ) {
    throw new Error('title、summary、content_md 均不能为空');
  }

  const trimmedTitle = payload.title.trim();
  const trimmedSummary = payload.summary.trim();
  const rawSlug =
    typeof payload.slug === 'string' && payload.slug.trim()
      ? payload.slug.trim()
      : payload.flow_data.meta.id;
  const slug = normalizeWikiSlug(rawSlug);
  const countryCode = payload.flow_data.meta.country_code.toUpperCase();
  const countryName = payload.flow_data.meta.country_name_cn.trim();
  const marketRegion = getRegionByCountryName(countryName) || '全球';
  const industryName = payload.flow_data.meta.category_name_cn.trim();
  const categoryId = payload.flow_data.meta.category_id ?? null;
  const hsCode6 = payload.flow_data.meta.hs_code_6 || null;
  const archetypeId = payload.flow_data.meta.archetype_id;
  const status = payload.status === 'draft' ? 'draft' : 'published';

  const faqItems =
    Array.isArray(payload.faq_items) && payload.faq_items.length > 0
      ? payload.faq_items
      : generateDefaultFaqs(payload.flow_data, trimmedTitle);
  const sources = Array.isArray(payload.sources) ? payload.sources : [];

  const upsertRes = await dbClient.query(
    `INSERT INTO wiki_entries (
       slug, title, summary, country_code, country_name, market_region,
       category_id, industry_name, hs_code_6, archetype_id,
       flow_data, content_md, faq_items, sources,
       video_url, cover_image, status, published_at, updated_at
     )
     VALUES (
       $1, $2, $3, $4, $5, $6,
       $7, $8, $9, $10,
       $11::jsonb, $12, $13::jsonb, $14::jsonb,
       $15, $16, $17, CASE WHEN $17 = 'published' THEN NOW() ELSE NULL END, NOW()
     )
     ON CONFLICT (slug) DO UPDATE SET
       title = EXCLUDED.title,
       summary = EXCLUDED.summary,
       country_code = EXCLUDED.country_code,
       country_name = EXCLUDED.country_name,
       market_region = EXCLUDED.market_region,
       category_id = EXCLUDED.category_id,
       industry_name = EXCLUDED.industry_name,
       hs_code_6 = EXCLUDED.hs_code_6,
       archetype_id = EXCLUDED.archetype_id,
       flow_data = EXCLUDED.flow_data,
       content_md = EXCLUDED.content_md,
       faq_items = EXCLUDED.faq_items,
       sources = EXCLUDED.sources,
       video_url = COALESCE(EXCLUDED.video_url, wiki_entries.video_url),
       cover_image = COALESCE(EXCLUDED.cover_image, wiki_entries.cover_image),
       status = EXCLUDED.status,
       published_at = COALESCE(wiki_entries.published_at, EXCLUDED.published_at),
       updated_at = NOW()
     RETURNING id, slug, (xmax = 0) AS inserted`,
    [
      slug,
      trimmedTitle,
      trimmedSummary,
      countryCode,
      countryName,
      marketRegion,
      categoryId,
      industryName,
      hsCode6,
      archetypeId,
      JSON.stringify(payload.flow_data),
      payload.content_md,
      JSON.stringify(faqItems),
      JSON.stringify(sources),
      payload.video_url || null,
      payload.cover_image || null,
      status,
    ]
  );

  const row = upsertRes.rows[0];
  const action: 'created' | 'updated' = row.inserted ? 'created' : 'updated';

  return {
    id: row.id,
    slug: row.slug,
    action,
  };
}
