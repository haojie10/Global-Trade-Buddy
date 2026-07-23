import { NextApiRequest, NextApiResponse } from 'next';
import { PoolClient } from 'pg';
import { withDb } from '../../../../lib/api-handler';
import { requireAdmin } from '../../../../lib/auth';

async function contentStatsHandler(req: NextApiRequest, res: NextApiResponse, dbClient: PoolClient) {
  const session = requireAdmin(req);
  if (!session) {
    return res.status(403).json({ error: '权限不足，仅管理员可访问' });
  }

  // 1. 行业分布
  const industryDistRes = await dbClient.query(
    `SELECT i.name, COUNT(ri.report_id)::int as value
     FROM industries i
     LEFT JOIN report_industries ri ON i.id = ri.industry_id
     GROUP BY i.name
     ORDER BY value DESC`
  );
  const industryDist = industryDistRes.rows;

  // 2. 地区分布
  const regionDistRes = await dbClient.query(
    `SELECT c.region as name, COUNT(rc.report_id)::int as value
     FROM countries c
     JOIN report_countries rc ON c.id = rc.country_id
     GROUP BY c.region
     ORDER BY value DESC`
  );
  const regionDist = regionDistRes.rows;

  // 3. 国家分布
  const countryDistRes = await dbClient.query(
    `SELECT c.name, c.region, COUNT(rc.report_id)::int as value
     FROM countries c
     LEFT JOIN report_countries rc ON c.id = rc.country_id
     GROUP BY c.name, c.region
     ORDER BY value DESC
     LIMIT 10`
  );
  const countryDist = countryDistRes.rows;

  // 4. 行业 x 区域 矩阵热力图数据
  const matrixRes = await dbClient.query(
    `SELECT i.name as industry, c.region, COUNT(r.id)::int as count
     FROM reports r
     JOIN report_industries ri ON r.id = ri.report_id
     JOIN industries i ON ri.industry_id = i.id
     JOIN report_countries rc ON r.id = rc.report_id
     JOIN countries c ON rc.country_id = c.id
     GROUP BY i.name, c.region`
  );
  const matrix = matrixRes.rows;

  // 5. 新鲜度看板
  const freshnessRes = await dbClient.query(
    `SELECT 
       COUNT(CASE WHEN created_at >= NOW() - INTERVAL '30 days' THEN 1 END)::int as green,
       COUNT(CASE WHEN created_at >= NOW() - INTERVAL '90 days' AND created_at < NOW() - INTERVAL '30 days' THEN 1 END)::int as yellow,
       COUNT(CASE WHEN created_at < NOW() - INTERVAL '90 days' THEN 1 END)::int as red
     FROM reports`
  );
  const freshness = [
    { name: '活跃 (<30天)', value: freshnessRes.rows[0].green || 0 },
    { name: '黄警 (30-90天)', value: freshnessRes.rows[0].yellow || 0 },
    { name: '老化 (>90天)', value: freshnessRes.rows[0].red || 0 }
  ];

  // 6. 报告明细列表（支持按标签展示，分页防止数据膨胀导致单请求过大）
  const page = Math.max(1, parseInt((req.query.page as string) || '1', 10) || 1);
  const pageSize = Math.min(200, Math.max(1, parseInt((req.query.pageSize as string) || '50', 10) || 50));
  const offset = (page - 1) * pageSize;

  const reportsCountRes = await dbClient.query('SELECT COUNT(*)::int AS total FROM reports');
  const reportsTotal = reportsCountRes.rows[0].total;

  const reportsListRes = await dbClient.query(
    `SELECT r.id, r.title, r.category, r.market_region, r.created_at,
            (SELECT STRING_AGG(name, ', ') FROM industries JOIN report_industries ON industries.id = report_industries.industry_id WHERE report_id = r.id) as industries,
            (SELECT STRING_AGG(name, ', ') FROM countries JOIN report_countries ON countries.id = report_countries.country_id WHERE report_id = r.id) as countries
     FROM reports r
     ORDER BY r.created_at DESC
     LIMIT $1 OFFSET $2`,
    [pageSize, offset]
  );
  const reportsList = reportsListRes.rows;

  // 6.1 获取这些报告的实体关联与图谱连线数
  if (reportsList.length > 0) {
    const reportIds = reportsList.map((r: any) => r.id);

    const [entitiesRes, edgesRes] = await Promise.all([
      dbClient.query(
        `SELECT re.report_id, e.id as entity_id, e.canonical_name, e.entity_type, re.role,
                (SELECT STRING_AGG(ea.alias_name, '|||') FROM entity_aliases ea WHERE ea.entity_id = e.id) as aliases
         FROM report_entities re
         JOIN entities e ON re.entity_id = e.id
         WHERE re.report_id = ANY($1)`,
        [reportIds]
      ),
      dbClient.query(
        `SELECT report_id, COUNT(*)::int as edge_count FROM (
           SELECT report_id_a as report_id FROM relations WHERE report_id_a = ANY($1)
           UNION ALL
           SELECT report_id_b as report_id FROM relations WHERE report_id_b = ANY($1)
         ) sub GROUP BY report_id`,
        [reportIds]
      )
    ]);

    const entityMap = new Map<string, {
      primary_company: string;
      company_aliases: string[];
      competitors: string[];
      suppliers: string[];
      customers: string[];
      channels: string[];
      sisters: string[];
      products: string[];
    }>();

    for (const row of entitiesRes.rows) {
      if (!entityMap.has(row.report_id)) {
        entityMap.set(row.report_id, {
          primary_company: '',
          company_aliases: [],
          competitors: [],
          suppliers: [],
          customers: [],
          channels: [],
          sisters: [],
          products: []
        });
      }
      const item = entityMap.get(row.report_id)!;
      const role = row.role;
      const name = row.canonical_name;

      if (role === 'primary') {
        item.primary_company = name;
        if (row.aliases) {
          const aliasList = row.aliases.split('|||').map((s: string) => s.trim()).filter(Boolean);
          item.company_aliases = Array.from(new Set([...item.company_aliases, ...aliasList]));
        }
      } else if (role === 'competitor') {
        if (!item.competitors.includes(name)) item.competitors.push(name);
      } else if (role === 'supplier') {
        if (!item.suppliers.includes(name)) item.suppliers.push(name);
      } else if (role === 'customer') {
        if (!item.customers.includes(name)) item.customers.push(name);
      } else if (role === 'channel') {
        if (!item.channels.includes(name)) item.channels.push(name);
      } else if (role === 'sister_parent') {
        if (!item.sisters.includes(name)) item.sisters.push(name);
      } else if (role === 'product') {
        if (!item.products.includes(name)) item.products.push(name);
      }
    }

    const edgeMap = new Map<string, number>();
    for (const row of edgesRes.rows) {
      edgeMap.set(row.report_id, row.edge_count);
    }

    for (const r of reportsList) {
      const ents = entityMap.get(r.id) || {
        primary_company: '',
        company_aliases: [],
        competitors: [],
        suppliers: [],
        customers: [],
        channels: [],
        sisters: [],
        products: []
      };
      r.primary_company = ents.primary_company;
      r.company_aliases = ents.company_aliases;
      r.competitors = ents.competitors;
      r.suppliers = ents.suppliers;
      r.customers = ents.customers;
      r.channels = ents.channels;
      r.sisters = ents.sisters;
      r.products = ents.products;
      r.edge_count = edgeMap.get(r.id) || 0;
    }
  }

  // 7. 内容缺口建议 (最近30天未命中搜索)
  const gapsRes = await dbClient.query(
    `SELECT query as name, COUNT(*)::int as count
     FROM search_logs
     WHERE results_count = 0 AND created_at >= NOW() - INTERVAL '30 days'
     GROUP BY query
     ORDER BY count DESC
     LIMIT 5`
  );
  const gaps = gapsRes.rows;

  return res.status(200).json({
    industryDist,
    regionDist,
    countryDist,
    matrix,
    freshness,
    reportsList,
    reportsPagination: { page, pageSize, total: reportsTotal },
    gaps
  });
}

export default withDb(contentStatsHandler, {
  methods: ['GET']
});
