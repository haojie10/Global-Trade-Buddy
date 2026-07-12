import { NextApiRequest, NextApiResponse } from 'next';
import { PoolClient } from 'pg';
import { withDb } from '../../../../lib/api-handler';
import { requireAdmin } from '../../../../lib/auth';

async function updateReportTagsHandler(req: NextApiRequest, res: NextApiResponse, dbClient: PoolClient) {
  const session = requireAdmin(req);
  if (!session) {
    return res.status(403).json({ error: '权限不足，仅管理员可操作' });
  }

  const { reportId, industry_ids, country_ids } = req.body;

  if (!reportId) {
    return res.status(400).json({ error: 'Missing reportId' });
  }

  await dbClient.query('BEGIN');
  try {
    // 1. 更新行业关联
    await dbClient.query('DELETE FROM report_industries WHERE report_id = $1', [reportId]);
    if (Array.isArray(industry_ids)) {
      for (const indId of industry_ids) {
        if (indId) {
          await dbClient.query(
            'INSERT INTO report_industries (report_id, industry_id) VALUES ($1, $2)',
            [reportId, indId]
          );
        }
      }
    }

    // 2. 更新国家关联
    await dbClient.query('DELETE FROM report_countries WHERE report_id = $1', [reportId]);
    if (Array.isArray(country_ids)) {
      for (const ctyId of country_ids) {
        if (ctyId) {
          await dbClient.query(
            'INSERT INTO report_countries (report_id, country_id) VALUES ($1, $2)',
            [reportId, ctyId]
          );
        }
      }
    }

    await dbClient.query('COMMIT');
    return res.status(200).json({ success: true });
  } catch (err) {
    await dbClient.query('ROLLBACK');
    throw err;
  }
}

export default withDb(updateReportTagsHandler, {
  methods: ['POST'],
  requiredBody: ['reportId']
});
