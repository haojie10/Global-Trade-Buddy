import { NextApiRequest, NextApiResponse } from 'next';
import pool from '../../../lib/db';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const { phone, email, password, role } = req.body;
  if (!password || (!phone && !email)) {
    return res.status(400).json({ error: '请填入必要的注册信息' });
  }

  const dbClient = await pool.connect();

  try {
    const selectedRole = role === 'admin' ? 'admin' : 'user';
    const quota = selectedRole === 'admin' ? 999 : 3;

    const signupRes = await dbClient.query(
      `INSERT INTO users (phone_number, email, password, role, free_quota) 
       VALUES ($1, $2, $3, $4, $5) 
       RETURNING id, phone_number, email, role, free_quota`,
      [phone || null, email || null, password, selectedRole, quota]
    );

    const user = signupRes.rows[0];
    return res.status(200).json({
      success: true,
      user: {
        id: user.id,
        phoneNumber: user.phone_number,
        email: user.email,
        role: user.role,
        freeQuota: user.free_quota,
      },
    });
  } catch (err: any) {
    if (err.code === '23505') {
      return res.status(400).json({ error: '该手机号或邮箱已被注册' });
    }
    return res.status(500).json({ error: err.message });
  } finally {
    dbClient.release();
  }
}
