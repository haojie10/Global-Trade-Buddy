import { NextApiRequest, NextApiResponse } from 'next';
import { PoolClient } from 'pg';
import { requireAdmin } from '../../../../lib/auth';
import { withDb } from '../../../../lib/api-handler';

async function relationHandler(req: NextApiRequest, res: NextApiResponse, client: PoolClient) {
  const adminSession = requireAdmin(req);
  if (!adminSession) {
    return res.status(403).json({ error: '权限不足，仅管理员可执行此操作' });
  }

  const { entityIdA, entityIdB, relatedEntityName, relationType, marketRegion } = req.body;
  if (!entityIdA || (!entityIdB && !relatedEntityName) || !relationType) {
    return res.status(400).json({ error: 'Missing parameters: entityIdA, relationType, and either entityIdB or relatedEntityName are required.' });
  }

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
}

export default withDb(relationHandler, {
  methods: ['POST']
});
