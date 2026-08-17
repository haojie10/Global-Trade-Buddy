import { NextApiRequest, NextApiResponse } from 'next';
import { PoolClient } from 'pg';
import { withDb } from '../../../../lib/api-handler';

async function entityDetailHandler(req: NextApiRequest, res: NextApiResponse, client: PoolClient) {
  const { id } = req.query;
  if (!id) {
    return res.status(400).json({ error: 'Missing parameter: id' });
  }

  // 0. 查询实体自身基础信息
  const entityRes = await client.query(
    `SELECT canonical_name, entity_type, description, website, headquarters, employee_count FROM entities WHERE id = $1`,
    [id]
  );
  if (entityRes.rows.length === 0) {
    return res.status(404).json({ error: '未找到该实体' });
  }
  const entity = entityRes.rows[0];

  // 1. 查询该实体的别名
  const aliasesRes = await client.query(
    `SELECT alias_name FROM entity_aliases WHERE entity_id = $1`,
    [id]
  );

  // 2. 查询该实体的商业关系 (竞争对手和供应商)
  const relationsRes = await client.query(
    `SELECT 
       er.relation_type,
       er.market_region,
       e.id AS related_entity_id,
       e.canonical_name AS related_entity_name
     FROM entity_relations er
     JOIN entities e ON (er.entity_id_b = e.id AND er.entity_id_a = $1)
     UNION
     SELECT 
       er.relation_type,
       er.market_region,
       e.id AS related_entity_id,
       e.canonical_name AS related_entity_name
     FROM entity_relations er
     JOIN entities e ON (er.entity_id_a = e.id AND er.entity_id_b = $1)`,
    [id]
  );

  const aliases = aliasesRes.rows.map((r: any) => r.alias_name);
  const competitors = relationsRes.rows
    .filter((r: any) => r.relation_type === 'competitor')
    .map((r: any) => ({ id: r.related_entity_id, name: r.related_entity_name, market: r.market_region }));
  const suppliers = relationsRes.rows
    .filter((r: any) => r.relation_type === 'supplier')
    .map((r: any) => ({ id: r.related_entity_id, name: r.related_entity_name, market: r.market_region }));

  return res.status(200).json({
    id,
    canonical_name: entity.canonical_name,
    entity_type: entity.entity_type,
    description: entity.description || '',
    website: entity.website || '',
    headquarters: entity.headquarters || '',
    employee_count: entity.employee_count || '',
    aliases,
    competitors,
    suppliers
  });
}

export default withDb(entityDetailHandler, {
  methods: ['GET'],
  requiredQuery: ['id']
});
