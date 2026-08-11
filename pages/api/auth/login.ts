import { NextApiRequest, NextApiResponse } from 'next';
import bcrypt from 'bcryptjs';
import pool from '../../../lib/db';
import { setSessionCookie } from '../../../lib/auth';
import { checkRateLimit } from '../../../lib/rate-limit';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  // IP 级限流：1 分钟最多 10 次登录尝试，防爆破
  if (checkRateLimit(req, res, { windowMs: 60 * 1000, max: 10 })) return;

  const { phoneOrEmail, password } = req.body;
  if (!phoneOrEmail || !password) {
    return res.status(400).json({ error: '请输入账号和密码' });
  }

  let dbClient;
  try {
    dbClient = await pool.connect();
    // 只用账号查询，不把密码放入 SQL 条件（防止时序攻击）
    const userRes = await dbClient.query(
      `SELECT id, phone_number, email, role, free_quota, password, nickname, status, member_type, subscription_expires_at 
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

    // 检查账号状态（若已被封禁，直接拦截）
    if (user.status === 'banned') {
      return res.status(403).json({ error: '您的账号已被管理员禁用，请联系平台支持' });
    }

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
        nickname: user.nickname
      },
    });
  } catch (err: any) {
    console.error("Login Handler Error:", err);
    // 返回具体错误信息便于排查（包含数据库连通性、表缺失或密钥问题）
    return res.status(500).json({ 
      error: '服务器内部错误', 
      details: err.message,
      code: err.code || null 
    });
  } finally {
    if (dbClient) {
      dbClient.release();
    }
  }
}
