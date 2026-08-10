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

    // 3. 获取最新的一条验证码记录（仅查询 id, code, expired_at，保证 100% 数据库兼容性）
    const verifyRes = await dbClient.query(
      `SELECT id, code, expired_at
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

    // 比对验证码
    if (verification.code !== cleanCode) {
      return res.status(400).json({ error: '验证码输入错误，请重新核对' });
    }

    // 校验验证码是否过期
    const now = new Date();
    const expiredAt = new Date(verification.expired_at);
    if (isNaN(expiredAt.getTime()) || now > expiredAt) {
      return res.status(400).json({ error: '验证码已过期，请重新发送验证码' });
    }

    // 4. 哈希加密新密码并更新数据库
    const passwordHash = await bcrypt.hash(password, 10);
    await dbClient.query(
      'UPDATE users SET password = $1 WHERE LOWER(email) = LOWER($2)',
      [passwordHash, cleanEmail]
    );

    // 5. 成功重置后物理清理该邮箱的旧验证码记录
    await dbClient.query(
      'DELETE FROM email_verifications WHERE LOWER(email) = LOWER($1)',
      [cleanEmail]
    );

    return res.status(200).json({
      success: true,
      message: '密码重置成功，请直接登录！'
    });
  } catch (err: any) {
    console.error('[reset-password] 接口处理失败:', err);
    return res.status(400).json({
      error: err.message || '重置密码处理失败，请重试'
    });
  }
}

export default withDb(resetPasswordHandler, {
  methods: ['POST'],
  requiredBody: ['email', 'password', 'code']
});
