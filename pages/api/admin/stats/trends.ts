import { NextApiRequest, NextApiResponse } from 'next';
import { PoolClient } from 'pg';
import { withDb } from '../../../../lib/api-handler';
import { requireAdmin } from '../../../../lib/auth';

async function trendsStatsHandler(req: NextApiRequest, res: NextApiResponse, dbClient: PoolClient) {
  const session = requireAdmin(req);
  if (!session) {
    return res.status(403).json({ error: '权限不足，仅管理员可访问' });
  }

  // 1. 实体热度榜 (根据关联报告的浏览量)
  const entityHeatRes = await dbClient.query(
    `SELECT e.id, e.canonical_name as name, e.entity_type as type,
            COUNT(DISTINCT re.report_id)::int as report_count,
            COUNT(pv.id)::int as view_count
     FROM entities e
     LEFT JOIN report_entities re ON e.id = re.entity_id
     LEFT JOIN page_views pv ON re.report_id = pv.content_id AND pv.content_type = 'report'
     GROUP BY e.id, e.canonical_name, e.entity_type
     ORDER BY view_count DESC, report_count DESC
     LIMIT 15`
  );
  const entityHeat = entityHeatRes.rows;

  // 2. 新兴热搜词汇 (最近 7 天的搜索词排行)
  const emergingKeywordsRes = await dbClient.query(
    `SELECT query as name, COUNT(*)::int as value
     FROM search_logs
     WHERE created_at >= NOW() - INTERVAL '7 days'
     GROUP BY query
     ORDER BY value DESC
     LIMIT 10`
  );
  const emergingKeywords = emergingKeywordsRes.rows;

  // 3. 行业关注度变动 (最近30天各行业报告浏览量排行)
  const industryConcernRes = await dbClient.query(
    `SELECT i.name, COUNT(pv.id)::int as value
     FROM industries i
     JOIN report_industries ri ON i.id = ri.industry_id
     JOIN page_views pv ON ri.report_id = pv.content_id AND pv.content_type = 'report'
     WHERE pv.created_at >= NOW() - INTERVAL '30 days'
     GROUP BY i.name
     ORDER BY value DESC`
  );
  const industryConcern = industryConcernRes.rows;

  return res.status(200).json({
    entityHeat,
    emergingKeywords,
    industryConcern
  });
}

export default withDb(trendsStatsHandler, {
  methods: ['GET']
});
