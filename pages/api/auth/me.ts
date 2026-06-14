import { NextApiRequest, NextApiResponse } from 'next';
import pool from '../../../lib/db';
import { getSession } from '../../../lib/auth';

// 返回当前登录用户信息（前端替代 localStorage 的统一入口）
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const session = getSession(req);
  if (!session) {
    return res.status(401).json({ error: '未登录' });
  }

  const dbClient = await pool.connect();

  try {
    const userRes = await dbClient.query(
      `SELECT id, phone_number, email, role, free_quota, member_type 
       FROM users WHERE id = $1`,
      [session.userId]
    );

    if (userRes.rows.length === 0) {
      return res.status(401).json({ error: '用户不存在' });
    }

    const user = userRes.rows[0];
    return res.status(200).json({
      success: true,
      user: {
        id: user.id,
        phoneNumber: user.phone_number,
        email: user.email,
        role: user.role,
        freeQuota: user.free_quota,
        memberType: user.member_type,
      },
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  } finally {
    dbClient.release();
  }
}
