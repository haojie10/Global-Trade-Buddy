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
