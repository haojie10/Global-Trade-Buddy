import { NextApiRequest, NextApiResponse } from 'next';
import { PoolClient } from 'pg';
import bcrypt from 'bcryptjs';
import { withDb } from '../../../lib/api-handler';

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

async function resetPasswordHandler(
  req: NextApiRequest,
  res: NextApiResponse,
  dbClient: PoolClient
) {
  try {
    const { email, password, code } = req.body;
    const cleanEmail = (email || '').trim().toLowerCase();
    const cleanCode = (code || '').trim();

    if (!cleanEmail || !password || !cleanCode) {
      return res.status(400).json({ error: '请填写完整的注册邮箱、验证码和新密码' });
    }

    // 1. 密码强度校验
    const passwordError = validatePassword(password);
    if (passwordError) {
      return res.status(400).json({ error: passwordError });
    }

    // 2. 核对该邮箱是否已在平台注册
    const userRes = await dbClient.query(
      'SELECT id FROM users WHERE LOWER(email) = LOWER($1)',
      [cleanEmail]
    );
    if (userRes.rows.length === 0) {
      return res.status(400).json({ error: '该邮箱尚未在平台注册' });
    }

    // 3. 统计近 10 分钟内该邮箱的验证码失败重试次数，防止暴力枚举
    try {
      const failCountRes = await dbClient.query(
        `SELECT COALESCE(SUM(attempts), 0)::int AS total_failures
         FROM email_verifications
         WHERE LOWER(email) = LOWER($1) AND created_at > NOW() - INTERVAL '10 minutes'`,
        [cleanEmail]
      );
      if ((failCountRes.rows[0]?.total_failures || 0) >= 10) {
        return res.status(429).json({ error: '尝试次数过多，请 10 分钟后再试' });
      }
    } catch (rateLimitErr) {
      console.warn('[reset-password] 统计验证码失败频次警告(忽略继续):', rateLimitErr);
    }

    // 4. 获取最新的一条验证码记录
    const verifyRes = await dbClient.query(
      `SELECT id, code, expired_at, COALESCE(attempts, 0)::int AS attempts
       FROM email_verifications
       WHERE LOWER(email) = LOWER($1)
       ORDER BY created_at DESC
       LIMIT 1`,
      [cleanEmail]
    );

    if (verifyRes.rows.length === 0) {
      return res.status(400).json({ error: '找不到验证码记录，请重新发送验证码' });
    }

    const verification = verifyRes.rows[0];

    // 校验该验证码的重试次数
    if (verification.attempts >= 5) {
      return res.status(400).json({ error: '验证码尝试次数过多已失效，请重新发送验证码' });
    }

    // 比对验证码
    if (verification.code !== cleanCode) {
      await dbClient.query(
        'UPDATE email_verifications SET attempts = COALESCE(attempts, 0) + 1 WHERE id = $1',
        [verification.id]
      );
      return res.status(400).json({ error: '验证码输入错误，请重新核对' });
    }

    // 校验验证码是否过期
    const now = new Date();
    const expiredAt = new Date(verification.expired_at);
    if (isNaN(expiredAt.getTime()) || now > expiredAt) {
      return res.status(400).json({ error: '验证码已过期，请重新发送验证码' });
    }

    // 5. 哈希加密新密码并更新数据库
    const passwordHash = await bcrypt.hash(password, 10);
    await dbClient.query(
      'UPDATE users SET password = $1 WHERE LOWER(email) = LOWER($2)',
      [passwordHash, cleanEmail]
    );

    // 6. 成功重置后物理清理该邮箱的旧验证码记录
    await dbClient.query(
      'DELETE FROM email_verifications WHERE LOWER(email) = LOWER($1)',
      [cleanEmail]
    );

    return res.status(200).json({
      success: true,
      message: '密码重置成功，请直接登录！'
    });
  } catch (err: any) {
    console.error('[reset-password] 接口捕获到内部未处理异常:', err);
    return res.status(400).json({
      error: err.message || '重置密码处理失败，请重试'
    });
  }
}

export default withDb(resetPasswordHandler, {
  methods: ['POST'],
  requiredBody: ['email', 'password', 'code']
});
