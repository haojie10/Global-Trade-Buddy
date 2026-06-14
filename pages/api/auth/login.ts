import { NextApiRequest, NextApiResponse } from 'next';
import bcrypt from 'bcryptjs';
import pool from '../../../lib/db';
import { setSessionCookie } from '../../../lib/auth';

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
    // 只用账号查询，不把密码放入 SQL 条件（防止时序攻击）
    const userRes = await dbClient.query(
      `SELECT id, phone_number, email, role, free_quota, password 
       FROM users 
       WHERE phone_number = $1 OR email = $1`,
      [phoneOrEmail]
    );

    if (userRes.rows.length === 0) {
      // 防止枚举攻击：用户不存在时也做一次无意义的 compare，保持响应时间一致
      await bcrypt.compare(password, '$2b$10$invalidhashforfixedtimingXXXXXXXXXXXXXXXXXXX');
      return res.status(401).json({ error: '账号或密码错误' });
    }

    const user = userRes.rows[0];
    const passwordMatch = await bcrypt.compare(password, user.password);

    if (!passwordMatch) {
      return res.status(401).json({ error: '账号或密码错误' });
    }

    // 验证通过，设置 httpOnly Cookie
    setSessionCookie(res, { userId: user.id, role: user.role });

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
