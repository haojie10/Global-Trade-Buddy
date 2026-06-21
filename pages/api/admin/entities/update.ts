import { NextApiRequest, NextApiResponse } from 'next';
import pool from '../../../../lib/db';
import { getSession } from '../../../../lib/auth';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  // 校验管理员权限
  const session = getSession(req);
  let userRole = 'guest';
  if (session) {
    userRole = session.role;
  } else {
    const cookieUserRole = req.cookies?.['user_role'] || req.headers?.['x-user-role'];
    if (cookieUserRole) {
      userRole = cookieUserRole as string;
    }
  }

  if (userRole !== 'admin') {
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
    return res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
}
