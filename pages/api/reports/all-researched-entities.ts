import { NextApiRequest, NextApiResponse } from 'next';
import { PoolClient } from 'pg';
import { withDb } from '../../../../lib/api-handler';
import { extractRootDomain, cleanCompanyNameForLookup } from '../../../../lib/crm-service';

/**
 * GET /api/reports/all-researched-entities
 * 内部/管理员与导出脚本专用：快速获取全量已有研报的域名与公司名集合
 */
async function handler(req: NextApiRequest, res: NextApiResponse, dbClient: PoolClient) {
  try {
    const repRes = await dbClient.query(`
      SELECT r.id, r.title, r.category, r.market_region,
             e.canonical_name,
             SUBSTRING(r.content_html FROM 'company_website["''][^>]*?content=["'']([^"'']+)["'']') AS meta_site,
             SUBSTRING(r.content_html FROM 'company_name["''][^>]*?content=["'']([^"'']+)["'']') AS meta_comp
      FROM reports r
      LEFT JOIN entities e ON r.primary_entity_id = e.id
      WHERE r.content_html IS NOT NULL
    `);

    const domains = new Set<string>();
    const cleanNames = new Set<string>();
    const reportList: any[] = [];

    for (const r of repRes.rows) {
      const site = r.meta_site || '';
      const domain = extractRootDomain(site);
      if (domain) domains.add(domain);

      const rawComp = r.meta_comp || r.canonical_name || (r.title ? r.title.split(/ - | 360°/)[0].trim() : '');
      const cleanName = cleanCompanyNameForLookup(rawComp);
      if (cleanName && cleanName.length >= 3) cleanNames.add(cleanName);

      reportList.push({
        id: r.id,
        title: r.title,
        domain: domain || null,
        company: cleanName || null,
      });
    }

    return res.status(200).json({
      success: true,
      total_reports: repRes.rows.length,
      researched_domains: Array.from(domains),
      researched_companies: Array.from(cleanNames),
    });
  } catch (error: any) {
    console.error('Fetch researched entities error:', error);
    return res.status(500).json({ error: error.message });
  }
}

export default withDb(handler);
