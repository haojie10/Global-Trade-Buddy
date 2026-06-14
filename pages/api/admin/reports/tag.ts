import { NextApiRequest, NextApiResponse } from 'next';
import pool from '../../../../lib/db';
import { getSession } from '../../../../lib/auth';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  // 从 httpOnly Cookie 中读取会话进行鉴权
  const session = getSession(req);
  if (!session) {
    return res.status(401).json({ error: '未登录，请先登录后操作' });
  }

  const { reportId, entityName, entityType } = req.body;
  if (!reportId || !entityName || !entityType) {
    return res.status(400).json({ error: '参数缺失，请提供 reportId, entityName 和 entityType' });
  }

  const tag = entityName.trim();
  if (!tag) {
    return res.status(400).json({ error: '实体名称不能为空' });
  }

  if (!['company', 'product', 'channel'].includes(entityType)) {
    return res.status(400).json({ error: '无效的实体类型' });
  }

  const dbClient = await pool.connect();

  try {
    await dbClient.query('BEGIN');

    // 1. 查询报告是否存在
    const reportRes = await dbClient.query('SELECT id, market_region FROM reports WHERE id = $1', [reportId]);
    if (reportRes.rows.length === 0) {
      throw new Error('指定报告不存在');
    }
    const reportMarket = reportRes.rows[0].market_region;

    // 2. 查找或插入实体 (通过 canonical_name 唯一)
    let entityId: string;
    
    // 检查是否已有同名实体或别称
    const entityCheck = await dbClient.query(
      `SELECT e.id FROM entities e
       LEFT JOIN entity_aliases ea ON e.id = ea.entity_id
       WHERE e.canonical_name = $1 OR ea.alias_name = $1
       LIMIT 1`,
      [tag]
    );

    if (entityCheck.rows.length > 0) {
      entityId = entityCheck.rows[0].id;
    } else {
      const insertEntityRes = await dbClient.query(
        `INSERT INTO entities (canonical_name, entity_type)
         VALUES ($1, $2)
         ON CONFLICT (canonical_name) DO UPDATE SET entity_type = EXCLUDED.entity_type
         RETURNING id`,
        [tag, entityType]
      );
      entityId = insertEntityRes.rows[0].id;
    }

    // 3. 关联到 report_entities 表
    await dbClient.query(
      `INSERT INTO report_entities (report_id, entity_id)
       VALUES ($1, $2)
       ON CONFLICT (report_id, entity_id) DO NOTHING`,
      [reportId, entityId]
    );

    // 4. 重建 relations 关联边，让图谱关联报告
    // 将此报告和具有相同实体的其他报告连起来
    await dbClient.query(
      `INSERT INTO relations (report_id_a, report_id_b, relation_key, market_region, relation_type)
       SELECT DISTINCT $1::UUID AS report_id_a, re.report_id AS report_id_b, $2 AS relation_key, $3 AS market_region, 'produces' AS relation_type
       FROM report_entities re
       WHERE re.entity_id = $4::UUID AND re.report_id != $1::UUID
       ON CONFLICT (report_id_a, report_id_b, relation_key) DO NOTHING`,
      [reportId, tag, reportMarket, entityId]
    );

    await dbClient.query('COMMIT');
    return res.status(200).json({ success: true, entityId });
  } catch (err: any) {
    await dbClient.query('ROLLBACK');
    return res.status(500).json({ error: err.message });
  } finally {
    dbClient.release();
  }
}
