import { NextApiRequest, NextApiResponse } from 'next';
import pool from '../../../lib/db';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const { phoneOrEmail, password } = req.body;
  if (!phoneOrEmail || !password) {
    return res.status(400).json({ error: '请输入账号和密码' });
  }

  const dbClient = await pool.connect();

  try {
    const userRes = await dbClient.query(
      `SELECT id, phone_number, email, role, free_quota 
       FROM users 
       WHERE (phone_number = $1 OR email = $1) AND password = $2`,
      [phoneOrEmail, password]
    );

    if (userRes.rows.length === 0) {
      return res.status(401).json({ error: '账号或密码错误' });
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
      },
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  } finally {
    dbClient.release();
  }
}
