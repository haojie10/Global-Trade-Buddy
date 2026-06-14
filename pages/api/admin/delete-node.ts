import { NextApiRequest, NextApiResponse } from 'next';
import pool from '../../../lib/db';
import { getSession } from '../../../lib/auth';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  // 1. 鉴权：只有登录的管理员用户才能删除节点
  const session = getSession(req);
  if (!session) {
    return res.status(401).json({ error: '未登录，请先登录后操作' });
  }

  if (session.role !== 'admin') {
    return res.status(403).json({ error: '权限不足，只有管理员可以执行此操作' });
  }

  const { id, nodeType } = req.body;
  if (!id || !nodeType) {
    return res.status(400).json({ error: '参数缺失，请提供 id 与 nodeType' });
  }

  if (!['report', 'entity'].includes(nodeType)) {
    return res.status(400).json({ error: '无效的节点类型' });
  }

  const dbClient = await pool.connect();

  try {
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
  } catch (err: any) {
    await dbClient.query('ROLLBACK');
    return res.status(500).json({ error: err.message });
  } finally {
    dbClient.release();
  }
}
