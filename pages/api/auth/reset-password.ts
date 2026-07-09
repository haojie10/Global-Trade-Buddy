import { NextApiRequest, NextApiResponse } from 'next';
import bcrypt from 'bcryptjs';
import pool from '../../../lib/db';

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

  const { email, password, code } = req.body;
  if (!email || !password || !code) {
    return res.status(400).json({ error: '请填入邮箱、验证码和新密码' });
  }

  // 密码强度校验
  const passwordError = validatePassword(password);
  if (passwordError) {
    return res.status(400).json({ error: passwordError });
  }

  const dbClient = await pool.connect();

  try {
    // 1. 核对该邮箱是否已注册
    const userRes = await dbClient.query('SELECT id FROM users WHERE email = $1', [email]);
    if (userRes.rows.length === 0) {
      return res.status(400).json({ error: '该邮箱尚未注册' });
    }

    // 2. 校验邮箱验证码是否正确且未过期
    const verifyRes = await dbClient.query(
      `SELECT code, expired_at FROM email_verifications 
       WHERE email = $1 
       ORDER BY created_at DESC 
       LIMIT 1`,
      [email]
    );

    if (verifyRes.rows.length === 0) {
      return res.status(400).json({ error: '请先获取验证码' });
    }

    const verification = verifyRes.rows[0];
    if (verification.code !== code) {
      return res.status(400).json({ error: '验证码错误' });
    }

    if (new Date() > new Date(verification.expired_at)) {
      return res.status(400).json({ error: '验证码已过期，请重新获取' });
    }

    // 3. 将新密码进行哈希处理并更新入库
    const passwordHash = await bcrypt.hash(password, 10);
    await dbClient.query(
      'UPDATE users SET password = $1 WHERE email = $2',
      [passwordHash, email]
    );

    // 4. 清理已用掉的验证码记录
    await dbClient.query('DELETE FROM email_verifications WHERE email = $1', [email]);

    return res.status(200).json({
      success: true,
      message: '密码重置成功，请重新登录！'
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  } finally {
    dbClient.release();
  }
}
