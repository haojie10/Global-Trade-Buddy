import { NextApiRequest, NextApiResponse } from 'next';
import { PoolClient } from 'pg';
import { withDb } from '../../../../lib/api-handler';

async function checkDuplicateHandler(req: NextApiRequest, res: NextApiResponse, dbClient: PoolClient) {
  const { companyName, category = 'customer' } = req.body;

  if (!companyName || !companyName.trim()) {
    return res.status(400).json({ error: 'companyName is required' });
  }

  const queryTag = companyName.trim();

  // 1. 使用 pg_trgm 模糊匹配最相似的公司实体
  const entityRes = await dbClient.query(
    `SELECT 
       e.id AS entity_id, 
       e.canonical_name,
       GREATEST(
         similarity(e.canonical_name, $1), 
         COALESCE(MAX(similarity(ea.alias_name, $1)), 0)
       ) AS score
     FROM entities e
     LEFT JOIN entity_aliases ea ON e.id = ea.entity_id
     WHERE e.entity_type = 'company'
     GROUP BY e.id, e.canonical_name
     HAVING GREATEST(
       similarity(e.canonical_name, $1), 
       COALESCE(MAX(similarity(ea.alias_name, $1)), 0)
     ) > 0.3
     ORDER BY score DESC
     LIMIT 1`,
    [queryTag]
  );

  if (entityRes.rows.length === 0) {
    return res.status(200).json({ duplicateFound: false });
  }

  const matchedEntity = entityRes.rows[0];
  const entityId = matchedEntity.entity_id;

  // 2. 检查该相似企业是否已有关联报告 (且类型符合，比如同样是 'customer' 报告)
  const reportRes = await dbClient.query(
    `SELECT r.id AS report_id, r.title AS report_title
     FROM report_entities re
     JOIN reports r ON re.report_id = r.id
     WHERE re.entity_id = $1 AND r.category = $2
     LIMIT 1`,
    [entityId, category]
  );

  if (reportRes.rows.length === 0) {
    return res.status(200).json({ duplicateFound: false });
  }

  const matchedReport = reportRes.rows[0];

  return res.status(200).json({
    duplicateFound: true,
    reportId: matchedReport.report_id,
    reportTitle: matchedReport.report_title,
    matchedEntityId: entityId,
    matchedCanonicalName: matchedEntity.canonical_name,
    score: parseFloat(matchedEntity.score)
  });
}

// 导出包装过的 API，并且直接导出核心 handler 供测试调用
export default async function handler(req: NextApiRequest, res: NextApiResponse, testDbClient?: PoolClient) {
  if (testDbClient) {
    return checkDuplicateHandler(req, res, testDbClient);
  }
  return withDb(checkDuplicateHandler, {
    methods: ['POST'],
    requiredBody: ['companyName']
  })(req, res);
}
