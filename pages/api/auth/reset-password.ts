import { NextApiRequest, NextApiResponse } from 'next';
import bcrypt from 'bcryptjs';
import pool from '../../../lib/db';
import { checkRateLimit } from '../../../lib/rate-limit';

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

  // IP 级限流：1 分钟最多 5 次重置尝试
  if (checkRateLimit(req, res, { windowMs: 60 * 1000, max: 5 })) return;

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

    // 2. 按邮箱维度统计近 10 分钟失败次数（防止重新请求新码绕过单条记录 attempts 限制）
    const failCountRes = await dbClient.query(
      `SELECT COALESCE(SUM(attempts), 0)::int AS total_failures
       FROM email_verifications
       WHERE email = $1 AND created_at > NOW() - INTERVAL '10 minutes'`,
      [email]
    );
    if (failCountRes.rows[0].total_failures >= 10) {
      return res.status(429).json({ error: '尝试次数过多，请 10 分钟后再试' });
    }

    // 3. 校验邮箱验证码是否正确且未过期
    const verifyRes = await dbClient.query(
      `SELECT id, code, expired_at, attempts FROM email_verifications
       WHERE email = $1
       ORDER BY created_at DESC
       LIMIT 1`,
      [email]
    );

    if (verifyRes.rows.length === 0) {
      return res.status(400).json({ error: '请先获取验证码' });
    }

    const verification = verifyRes.rows[0];
    if (verification.attempts >= 5) {
      return res.status(400).json({ error: '验证码已失效（尝试次数过多），请重新获取' });
    }

    if (verification.code !== code) {
      await dbClient.query(
        'UPDATE email_verifications SET attempts = attempts + 1 WHERE id = $1',
        [verification.id]
      );
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
    const safeMsg = process.env.NODE_ENV === 'production' ? '服务器内部错误' : err.message;
    return res.status(500).json({ error: safeMsg });
  } finally {
    dbClient.release();
  }
}
