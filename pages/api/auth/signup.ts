import { NextApiRequest, NextApiResponse } from 'next';
import bcrypt from 'bcryptjs';
import pool from '../../../lib/db';
import { setSessionCookie } from '../../../lib/auth';
import { checkRateLimit } from '../../../lib/rate-limit';

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

  // IP 级限流：1 分钟最多 5 次注册尝试
  if (checkRateLimit(req, res, { windowMs: 60 * 1000, max: 5 })) return;

  const { nickname, email, password, code } = req.body;
  if (!email || !password || !nickname) {
    return res.status(400).json({ error: '请填入完整的注册信息（含昵称）' });
  }

  // 昵称字节长度校验：使用 UTF-8 真实字节数（兼容 emoji）
  const nicknameByteLen = Buffer.byteLength(nickname, 'utf8');
  if (nicknameByteLen > 10) {
    return res.status(400).json({ error: '昵称不能超过 10 个字节 (5 个汉字)' });
  }

  // 昵称特殊字符校验：只允许中文、英文、数字
  if (!/^[a-zA-Z0-9\u4e00-\u9fa5]+$/.test(nickname)) {
    return res.status(400).json({ error: '昵称只能包含中文、英文和数字，不能带特殊符号' });
  }

  // 密码强度校验
  const passwordError = validatePassword(password);
  if (passwordError) {
    return res.status(400).json({ error: passwordError });
  }

  const dbClient = await pool.connect();

  try {
    // 邮箱验证码核验
    if (email) {
      if (!code) {
        return res.status(400).json({ error: '请输入邮箱验证码' });
      }

      // 按邮箱维度统计近 10 分钟失败次数（防止重新请求新码绕过单条记录 attempts 限制）
      const failCountRes = await dbClient.query(
        `SELECT COALESCE(SUM(attempts), 0)::int AS total_failures
         FROM email_verifications
         WHERE email = $1 AND created_at > NOW() - INTERVAL '10 minutes'`,
        [email]
      );
      if (failCountRes.rows[0].total_failures >= 10) {
        return res.status(429).json({ error: '尝试次数过多，请 10 分钟后再试' });
      }

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
    }
    // NOTE: 角色强制为 'user'，管理员只能通过数据库手动分配，防止注册自封管理员
    const selectedRole = 'user';
    const quota = 3;

    // 对密码进行 bcrypt 哈希处理（cost factor = 10）
    const passwordHash = await bcrypt.hash(password, 10);

    const signupRes = await dbClient.query(
      `INSERT INTO users (email, password, role, free_quota, nickname) 
       VALUES ($1, $2, $3, $4, $5) 
       RETURNING id, email, role, free_quota, nickname`,
      [email, passwordHash, selectedRole, quota, nickname]
    );

    const user = signupRes.rows[0];

    // 注册成功后自动登录，设置 httpOnly Cookie
    setSessionCookie(res, { userId: user.id, role: user.role });

    return res.status(200).json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        freeQuota: user.free_quota,
        nickname: user.nickname
      },
    });
  } catch (err: any) {
    if (err.code === '23505') {
      return res.status(400).json({ error: '该邮箱已被注册' });
    }
    const safeMsg = process.env.NODE_ENV === 'production' ? '服务器内部错误' : err.message;
    return res.status(500).json({ error: safeMsg });
  } finally {
    dbClient.release();
  }
}
