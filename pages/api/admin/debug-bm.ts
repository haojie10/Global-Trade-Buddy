import { NextApiRequest, NextApiResponse } from 'next';
import { PoolClient } from 'pg';
import { withDb } from '../../../lib/api-handler';

async function debugBmHandler(req: NextApiRequest, res: NextApiResponse, dbClient: PoolClient) {
  try {
    const repRes = await dbClient.query(`SELECT id, title, category, market_region FROM reports WHERE title LIKE '%B&M Stores%' LIMIT 1`);
    if (repRes.rows.length === 0) {
      return res.status(404).json({ error: '未找到 B&M Stores 报告' });
    }

    const targetReport = repRes.rows[0];
    const reportId = targetReport.id;

    // 查连线
    const relRes = await dbClient.query(
      `SELECT r.relation_type, r.relation_key, r.market_region, ra.title as title_a, rb.title as title_b
       FROM relations r
       JOIN reports ra ON r.report_id_a = ra.id
       JOIN reports rb ON r.report_id_b = rb.id
       WHERE r.report_id_a = $1 OR r.report_id_b = $1`,
      [reportId]
    );

    // 查实体关键词
    const entRes = await dbClient.query(
      `SELECT re.role, e.canonical_name, e.entity_type, e.id as entity_id
       FROM report_entities re
       JOIN entities e ON re.entity_id = e.id
       WHERE re.report_id = $1`,
      [reportId]
    );

    const hitAnalysis: any[] = [];
    for (const ent of entRes.rows) {
      const otherRes = await dbClient.query(
        `SELECT r.title, r.category, r.market_region, re.role
         FROM report_entities re
         JOIN reports r ON re.report_id = r.id
         WHERE re.entity_id = $1 AND re.report_id != $2`,
        [ent.entity_id, reportId]
      );
      hitAnalysis.push({
        keyword: ent.canonical_name,
        entity_type: ent.entity_type,
        role: ent.role,
        other_reports_count: otherRes.rows.length,
        other_reports: otherRes.rows
      });
    }

    return res.status(200).json({
      targetReport,
      relations: relRes.rows,
      entities: entRes.rows,
      hitAnalysis
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
}

export default withDb(debugBmHandler, { methods: ['GET', 'POST'] });
