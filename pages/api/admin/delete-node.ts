import { NextApiRequest, NextApiResponse } from 'next';
import { PoolClient } from 'pg';
import { withDb } from '../../../lib/api-handler';
import { requireAdmin } from '../../../lib/auth';

async function deleteNodeHandler(req: NextApiRequest, res: NextApiResponse, dbClient: PoolClient) {
  const { id, nodeType } = req.body;

  if (!['report', 'entity'].includes(nodeType)) {
    return res.status(400).json({ error: '无效的节点类型' });
  }

  // 统一管理员鉴权，取代原有的 session/cookie 双重回退方案
  const adminSession = requireAdmin(req);
  if (!adminSession) {
    return res.status(403).json({ error: '权限不足，只有管理员可以执行此操作' });
  }

  await dbClient.query('BEGIN');

  if (nodeType === 'report') {
    // 删除报告，外键约束会自动级联删除相关的 relations, unlocks, notes, favorites
    const deleteRes = await dbClient.query(
      'DELETE FROM reports WHERE id = $1 RETURNING id',
      [id]
    );
    if (deleteRes.rows.length === 0) {
      throw new Error('未找到指定报告，或已被其他管理员删除');
    }
  } else {
    // 删除公司/品类等实体，外键约束会自动级联删除对应的 entity_aliases, report_entities, entity_relations
    const deleteRes = await dbClient.query(
      'DELETE FROM entities WHERE id = $1 RETURNING id',
      [id]
    );
    if (deleteRes.rows.length === 0) {
      throw new Error('未找到指定实体，或已被其他管理员删除');
    }
  }

  await dbClient.query('COMMIT');
  return res.status(200).json({ success: true });
}

export default withDb(deleteNodeHandler, {
  methods: ['POST'],
  requiredBody: ['id', 'nodeType']
});
