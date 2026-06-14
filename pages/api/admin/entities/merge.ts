import { NextApiRequest, NextApiResponse } from 'next';
import pool from '../../../../lib/db';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const { sourceEntityId, targetEntityId, aliasName } = req.body;
  if (!targetEntityId || !aliasName) {
    return res.status(400).json({ error: 'Missing parameters: targetEntityId, aliasName are required.' });
  }

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // 1. 在 entity_aliases 中为目标公司记录该别名
    await client.query(
      `INSERT INTO entity_aliases (entity_id, alias_name)
       VALUES ($1, $2)
       ON CONFLICT (alias_name) 
       DO UPDATE SET entity_id = EXCLUDED.entity_id`,
      [targetEntityId, aliasName]
    );

    // 如果指定了旧实体 ID，则执行数据合并和转移逻辑
    if (sourceEntityId) {
    // 查询旧公司被哪些报告提及过
    const reportEnts = await client.query(
      `SELECT report_id FROM report_entities WHERE entity_id = $1`,
      [sourceEntityId]
    );

    for (const row of reportEnts.rows) {
      await client.query(
        `INSERT INTO report_entities (report_id, entity_id)
         VALUES ($1, $2)
         ON CONFLICT (report_id, entity_id) DO NOTHING`,
        [row.report_id, targetEntityId]
      );
    }

    // 从 report_entities 中清除掉和旧公司的关联
    await client.query(
      `DELETE FROM report_entities WHERE entity_id = $1`,
      [sourceEntityId]
    );

    // 3. 将所有涉及旧公司的实体关系 (entity_relations) 迁移到新公司上
    // 注意：迁移后可能会与已有关系发生冲突，所以这里处理一下唯一约束
    const relationsA = await client.query(
      `SELECT id, entity_id_b, relation_type, market_region FROM entity_relations WHERE entity_id_a = $1`,
      [sourceEntityId]
    );
    for (const rel of relationsA.rows) {
      await client.query(
        `INSERT INTO entity_relations (entity_id_a, entity_id_b, relation_type, market_region)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (entity_id_a, entity_id_b, relation_type, market_region) DO NOTHING`,
        [targetEntityId, rel.entity_id_b, rel.relation_type, rel.market_region]
      );
    }

    const relationsB = await client.query(
      `SELECT id, entity_id_a, relation_type, market_region FROM entity_relations WHERE entity_id_b = $1`,
      [sourceEntityId]
    );
    for (const rel of relationsB.rows) {
      await client.query(
        `INSERT INTO entity_relations (entity_id_a, entity_id_b, relation_type, market_region)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (entity_id_a, entity_id_b, relation_type, market_region) DO NOTHING`,
        [rel.entity_id_a, targetEntityId, rel.relation_type, rel.market_region]
      );
    }

    // 从 relations 中删除与旧公司相关的行
    await client.query(
      `DELETE FROM entity_relations WHERE entity_id_a = $1 OR entity_id_b = $1`,
      [sourceEntityId]
    );

    // 4. 安全地从 entities 表中移除被合并的公司记录
    await client.query(
      `DELETE FROM entities WHERE id = $1`,
      [sourceEntityId]
    );
    }

    await client.query('COMMIT');

    return res.status(200).json({ success: true });
  } catch (err: any) {
    await client.query('ROLLBACK');
    return res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
}
