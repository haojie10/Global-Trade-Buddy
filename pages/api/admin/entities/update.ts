import { NextApiRequest, NextApiResponse } from 'next';
import pool from '../../../../lib/db';
import { requireAdmin } from '../../../../lib/auth';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  // 统一管理员鉴权，取代原有的 cookie/header 回退方案
  const adminSession = requireAdmin(req);
  if (!adminSession) {
    return res.status(403).json({ error: '权限不足，仅管理员可进行此操作' });
  }

  const { entityId, description, website, headquarters, employee_count } = req.body;
  if (!entityId) {
    return res.status(400).json({ error: '参数缺失，缺少 entityId' });
  }

  const client = await pool.connect();
  try {
    await client.query(
      `UPDATE entities 
       SET description = $1, website = $2, headquarters = $3, employee_count = $4 
       WHERE id = $5`,
      [description, website, headquarters, employee_count, entityId]
    );

    return res.status(200).json({ success: true });
  } catch (err: any) {
    const safeMsg = process.env.NODE_ENV === 'production' ? '服务器内部错误' : err.message;
    return res.status(500).json({ error: safeMsg });
  } finally {
    client.release();
  }
}
