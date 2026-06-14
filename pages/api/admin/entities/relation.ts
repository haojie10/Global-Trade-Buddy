import { NextApiRequest, NextApiResponse } from 'next';
import pool from '../../../../lib/db';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const { entityIdA, entityIdB, relationType, marketRegion } = req.body;
  if (!entityIdA || !entityIdB || !relationType) {
    return res.status(400).json({ error: 'Missing parameters: entityIdA, entityIdB, relationType are required.' });
  }

  const client = await pool.connect();
  try {
    await client.query(
      `INSERT INTO entity_relations (entity_id_a, entity_id_b, relation_type, market_region)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (entity_id_a, entity_id_b, relation_type, market_region) 
       DO NOTHING`,
      [entityIdA, entityIdB, relationType, marketRegion || null]
    );

    return res.status(200).json({ success: true });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
}
