import { NextApiRequest, NextApiResponse } from 'next';
import bcrypt from 'bcryptjs';
import pool from '../../../lib/db';
import { setSessionCookie } from '../../../lib/auth';

/**
 * 校验密码强度：至少 8 位，包含字母和数字
 */
function validatePassword(password: string): string | null {
  if (password.length < 8) {
    return '密码长度至少 8 位';
  }
  if (!/[a-zA-Z]/.test(password)) {
    return '密码必须包含至少一个字母';
  }
  if (!/[0-9]/.test(password)) {
    return '密码必须包含至少一个数字';
  }
  return null;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const { phone, email, password } = req.body;
  if (!password || (!phone && !email)) {
    return res.status(400).json({ error: '请填入必要的注册信息' });
  }

  // 密码强度校验
  const passwordError = validatePassword(password);
  if (passwordError) {
    return res.status(400).json({ error: passwordError });
  }

  const dbClient = await pool.connect();

  try {
    // NOTE: 角色强制为 'user'，管理员只能通过数据库手动分配，防止注册自封管理员
    const selectedRole = 'user';
    const quota = 3;

    // 对密码进行 bcrypt 哈希处理（cost factor = 10）
    const passwordHash = await bcrypt.hash(password, 10);

    const signupRes = await dbClient.query(
      `INSERT INTO users (phone_number, email, password, role, free_quota) 
       VALUES ($1, $2, $3, $4, $5) 
       RETURNING id, phone_number, email, role, free_quota`,
      [phone || null, email || null, passwordHash, selectedRole, quota]
    );

    const user = signupRes.rows[0];

    // 注册成功后自动登录，设置 httpOnly Cookie
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
    if (err.code === '23505') {
      return res.status(400).json({ error: '该手机号或邮箱已被注册' });
    }
    return res.status(500).json({ error: err.message });
  } finally {
    dbClient.release();
  }
}
