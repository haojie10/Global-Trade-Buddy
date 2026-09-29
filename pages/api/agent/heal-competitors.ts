import { NextApiRequest, NextApiResponse } from 'next';
import { PoolClient } from 'pg';
import { withDb } from '../../../lib/api-handler';
import { extractAndNormalizeEntities, parseMetadata } from '../../../lib/entity-extractor';
import { computeRelationsForReport, ReportEntityItem } from '../../../lib/relation-calculator';
import { cleanCompanyName } from '../../../lib/competitor-discoverer';
import { filterCountriesOnly } from '../../../lib/country-helpers';

function extractMeta(html: string, name: string): string {
  const match = html.match(new RegExp(`<meta[^>]*?name=["']${name}["'][^>]*?content=(["'])([\\s\\S]*?)\\1`, 'i'));
  if (match) return match[2].trim();
  const matchRev = html.match(new RegExp(`<meta[^>]*?content=(["'])([\\s\\S]*?)\\1[^>]*?name=["']${name}["']`, 'i'));
  if (matchRev) return matchRev[2].trim();
  return '';
}

async function healCompetitorsHandler(req: NextApiRequest, res: NextApiResponse, dbClient: PoolClient) {
  // 1. 验证 Agent 凭据
  const authHeader = req.headers.authorization;
  const token = (authHeader && authHeader.split(' ')[1]) || (req.headers['x-agent-key'] as string);
  const isProd = process.env.NODE_ENV === 'production';
  const expectedToken = process.env.AGENT_API_KEY;

  const isAuthValid = isProd
    ? (Boolean(token) && token === expectedToken)
    : (token === (expectedToken || 'automation_agent_secret') || token === 'automation_agent_secret');

  if (!isAuthValid) {
    return res.status(401).json({ error: 'Unauthorized: Invalid Agent API Key' });
  }

  const { reportIds = [], all = false, limit = 8 } = req.body;
  const batchLimit = Math.max(1, Math.min(Number(limit) || 8, 20));

  let targetReportIds: string[] = [];
  let totalRemaining = 0;

  if (Array.isArray(reportIds) && reportIds.length > 0) {
    targetReportIds = reportIds;
  } else if (all) {
    // 1. 精准统计：全库 HTML meta 含管道符 或 关联实体含管道符的报告总数
    const countRes = await dbClient.query(`
      SELECT COUNT(DISTINCT r.id) AS cnt
      FROM reports r
      WHERE (
        r.content_html ~* '<meta[^>]*?name=["'']competitors["''][^>]*?content=["''][^"'']*\\|'
        OR r.content_html ~* '<meta[^>]*?content=["''][^"'']*\\|[^"'']*["''][^>]*?name=["'']competitors["'']'
        OR EXISTS (
          SELECT 1 FROM report_entities re
          JOIN entities e ON re.entity_id = e.id
          WHERE re.report_id = r.id AND e.canonical_name LIKE '%|%'
        )
      )
    `);
    totalRemaining = parseInt(countRes.rows[0]?.cnt || '0', 10);

    if (totalRemaining === 0) {
      return res.status(200).json({
        success: true,
        message: '🎉 全库检测完毕：已无任何包含管道符的脏实体或未规范化 meta 的报告！',
        healedReportsCount: 0,
        healedReports: [],
        remainingDirtyReports: 0,
        orphansDeletedCount: 0,
        activeRelationsCount: 0,
        activeRelations: []
      });
    }

    // 2. 每次截取最多 batchLimit 篇执行自愈，避免 Nginx 504 超时
    const scanRes = await dbClient.query(`
      SELECT DISTINCT r.id
      FROM reports r
      WHERE (
        r.content_html ~* '<meta[^>]*?name=["'']competitors["''][^>]*?content=["''][^"'']*\\|'
        OR r.content_html ~* '<meta[^>]*?content=["''][^"'']*\\|[^"'']*["''][^>]*?name=["'']competitors["'']'
        OR EXISTS (
          SELECT 1 FROM report_entities re
          JOIN entities e ON re.entity_id = e.id
          WHERE re.report_id = r.id AND e.canonical_name LIKE '%|%'
        )
      )
      ORDER BY r.id
      LIMIT $1
    `, [batchLimit]);

    targetReportIds = scanRes.rows.map(r => r.id);
  } else {
    return res.status(400).json({ error: '请提供 reportIds 数组或指定 all: true' });
  }

  const healResults: any[] = [];

  await dbClient.query('BEGIN');

  try {
    for (const repId of targetReportIds) {
      const repRes = await dbClient.query(
        'SELECT id, title, category, market_region, summary, content_html, primary_entity_id FROM reports WHERE id = $1',
        [repId]
      );

      if (repRes.rows.length === 0) {
        healResults.push({ id: repId, status: 'not_found' });
        continue;
      }

      const report = repRes.rows[0];
      let contentHtml: string = report.content_html || '';
      const title: string = report.title || '';
      const finalCategory: string = report.category || 'customer';

      // 提取 meta 标签
      const meta = parseMetadata(contentHtml);
      const metaCompanyName = extractMeta(contentHtml, 'company_name');
      const metaCompanyAliases = extractMeta(contentHtml, 'company_aliases');
      const metaCompanyWebsite = extractMeta(contentHtml, 'company_website');
      const metaCompetitors = extractMeta(contentHtml, 'competitors');
      const metaSuppliers = extractMeta(contentHtml, 'suppliers');
      const metaCustomers = extractMeta(contentHtml, 'customers');
      const metaSisterParents = extractMeta(contentHtml, 'sister_parents');
      const metaProducts = extractMeta(contentHtml, 'products');
      const metaRegions = extractMeta(contentHtml, 'regions');
      const metaChannels = extractMeta(contentHtml, 'channels');

      const cleanEntityTag = (tag: string) => {
        if (!tag) return '';
        const namePart = tag.split('|')[0].trim();
        return cleanCompanyName(namePart);
      };

      const aliasesList = metaCompanyAliases
        ? metaCompanyAliases.split(/,|，|\/|\||;|；|\n/).map(cleanCompanyName).filter(Boolean)
        : [];

      const cleanCompetitors = metaCompetitors
        ? metaCompetitors.split(/,|，/).map(cleanEntityTag).filter(Boolean)
        : [];

      const manualTags = {
        companies: metaCompanyName ? [cleanCompanyName(metaCompanyName)] : [],
        companyAliases: aliasesList,
        companyWebsite: metaCompanyWebsite || undefined,
        competitors: cleanCompetitors,
        suppliers: metaSuppliers ? metaSuppliers.split(/,|，/).map(cleanEntityTag).filter(Boolean) : [],
        customers: metaCustomers ? metaCustomers.split(/,|，/).map(cleanEntityTag).filter(Boolean) : [],
        sisters: metaSisterParents ? metaSisterParents.split(/,|，/).map(cleanEntityTag).filter(Boolean) : [],
        products: metaProducts ? metaProducts.split(/,|，/).map(s => s.trim()).filter(Boolean) : [],
        regions: metaRegions ? metaRegions.split(/,|，/).map(s => s.trim()).filter(Boolean) : [],
        channels: metaChannels ? metaChannels.split(/,|，/).map(cleanEntityTag).filter(Boolean) : []
      };

      // 规范化 HTML 中的 meta 标签内容（将长文本洗成纯净公司名，保持一致）
      if (cleanCompetitors.length > 0) {
        const cleanCompContent = cleanCompetitors.join(', ');
        contentHtml = contentHtml.replace(
          /(<meta\s+name=["']competitors["']\s+content=["'])[\s\S]*?(["'])/i,
          `$1${cleanCompContent}$2`
        );
      }

      // 处理地区/国家
      let regionsList: string[] = [];
      if (manualTags.regions && manualTags.regions.length > 0) {
        regionsList = [...manualTags.regions];
      }
      if (meta.market_region && meta.market_region !== '全球') {
        regionsList.push(meta.market_region);
      }
      const cleanCountriesList = filterCountriesOnly(regionsList);
      const finalMarketRegion = cleanCountriesList.length > 0
        ? cleanCountriesList.join(', ')
        : (regionsList.length > 0 ? regionsList.join(', ') : (report.market_region || '全球'));

      // 重新提取并归一化实体
      const resolvedEntities = await extractAndNormalizeEntities(
        contentHtml,
        meta.title || title,
        dbClient,
        manualTags,
        meta.primary_subject,
        finalCategory
      );

      const primaryEnt = resolvedEntities.find(e => e.role === 'primary');
      const primaryEntityId = primaryEnt ? primaryEnt.id : report.primary_entity_id;

      // 更新 reports 表中的 content_html 和 primary_entity_id
      await dbClient.query(
        'UPDATE reports SET content_html = $1, primary_entity_id = $2 WHERE id = $3',
        [contentHtml, primaryEntityId, repId]
      );

      // 重写 report_entities 关联
      await dbClient.query('DELETE FROM report_entities WHERE report_id = $1', [repId]);
      if (resolvedEntities.length > 0) {
        const selectParts: string[] = [];
        const queryParams: any[] = [repId];
        let paramIndex = 2;
        for (const ent of resolvedEntities) {
          selectParts.push(`($1::uuid, $${paramIndex}::uuid, $${paramIndex + 1}::varchar)`);
          queryParams.push(ent.id, ent.role);
          paramIndex += 2;
        }
        await dbClient.query(
          `INSERT INTO report_entities (report_id, entity_id, role) 
           VALUES ${selectParts.join(',')} 
           ON CONFLICT (report_id, entity_id) DO UPDATE SET role = EXCLUDED.role`,
          queryParams
        );
      }

      // 重算拓扑图谱关系
      const currentEntMap = new Map<string, ReportEntityItem>();
      for (const ent of resolvedEntities) {
        currentEntMap.set(ent.id, {
          role: ent.role,
          canonical_name: ent.canonical_name
        });
      }

      const primaryEntNameA = primaryEnt ? primaryEnt.canonical_name.toLowerCase().trim() : '';

      await computeRelationsForReport(
        repId,
        finalCategory,
        finalMarketRegion,
        currentEntMap,
        primaryEntNameA,
        primaryEntityId,
        dbClient
      );

      healResults.push({
        id: repId,
        title,
        status: 'healed',
        primary_company: primaryEntNameA,
        cleaned_competitors: cleanCompetitors,
        entities_count: resolvedEntities.length
      });
    }

    // 清理无引用的包含管道符的孤儿实体
    const orphanCleanRes = await dbClient.query(`
      DELETE FROM entities 
      WHERE canonical_name LIKE '%|%'
        AND id NOT IN (SELECT DISTINCT entity_id FROM report_entities)
      RETURNING id, canonical_name
    `);

    await dbClient.query('COMMIT');

    // 查询当前目标报告所涉及的最新 relations 关系连线
    const relationsRes = await dbClient.query(`
      SELECT rel.id, rel.relation_type, rel.relation_key, rel.market_region,
             ra.title AS title_a, rb.title AS title_b,
             ra.id AS report_id_a, rb.id AS report_id_b
      FROM relations rel
      JOIN reports ra ON rel.report_id_a = ra.id
      JOIN reports rb ON rel.report_id_b = rb.id
      WHERE rel.report_id_a = ANY($1) OR rel.report_id_b = ANY($1)
    `, [targetReportIds]);

    return res.status(200).json({
      success: true,
      healedReportsCount: healResults.length,
      remainingDirtyReports: Math.max(0, totalRemaining - healResults.length),
      healedReports: healResults,
      orphansDeletedCount: orphanCleanRes.rows.length,
      activeRelationsCount: relationsRes.rows.length,
      activeRelations: relationsRes.rows.map(r => ({
        type: r.relation_type,
        key: r.relation_key,
        market: r.market_region,
        from: r.title_a,
        to: r.title_b
      }))
    });

  } catch (err: any) {
    await dbClient.query('ROLLBACK');
    console.error('[ERR] heal-competitors failed:', err);
    return res.status(500).json({ error: err.message });
  }
}

export default withDb(healCompetitorsHandler, {
  methods: ['POST']
});
