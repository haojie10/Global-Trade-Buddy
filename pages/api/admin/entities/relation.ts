import { NextApiRequest, NextApiResponse } from 'next';
import pool from '../../../../lib/db';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const { entityIdA, entityIdB, relatedEntityName, relationType, marketRegion } = req.body;
  if (!entityIdA || (!entityIdB && !relatedEntityName) || !relationType) {
    return res.status(400).json({ error: 'Missing parameters: entityIdA, relationType, and either entityIdB or relatedEntityName are required.' });
  }

  const client = await pool.connect();
  try {
    let targetEntityId = entityIdB;

    // 如果未传 ID 但传了名字，则自动检索或扩充词库创建实体
    if (!targetEntityId && relatedEntityName) {
      const nameTrim = relatedEntityName.trim();
      const insertRes = await client.query(
        `INSERT INTO entities (canonical_name, entity_type) 
         VALUES ($1, 'company') 
         ON CONFLICT (canonical_name) DO UPDATE SET entity_type = EXCLUDED.entity_type
         RETURNING id`,
        [nameTrim]
      );
      targetEntityId = insertRes.rows[0].id;
    }

    await client.query(
      `INSERT INTO entity_relations (entity_id_a, entity_id_b, relation_type, market_region)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (entity_id_a, entity_id_b, relation_type, market_region) 
       DO NOTHING`,
      [entityIdA, targetEntityId, relationType, marketRegion || null]
    );

    return res.status(200).json({ success: true });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
}
