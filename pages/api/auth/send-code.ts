import { NextApiRequest, NextApiResponse } from 'next';
import { PoolClient } from 'pg';
import crypto from 'crypto';
import { withDb } from '../../../lib/api-handler';
import { checkRateLimit } from '../../../lib/rate-limit';
import nodemailer from 'nodemailer';

async function sendCodeHandler(req: NextApiRequest, res: NextApiResponse, dbClient: PoolClient) {
  // IP 级限流：1 分钟最多 5 次（防止脚本批量轰炸 SMTP）
  if (checkRateLimit(req, res, { windowMs: 60 * 1000, max: 5 })) return;

  const { email } = req.body;
  if (!email || !/^[\w-\.]+@([\w-]+\.)+[\w-]{2,4}$/.test(email)) {
    return res.status(400).json({ error: '请输入有效的邮箱地址' });
  }

  // 频率限制: 同一邮箱 60 秒内只能发送一次验证码 (非测试环境)
  if (process.env.NODE_ENV !== 'test') {
    const recentRes = await dbClient.query(
      `SELECT id FROM email_verifications
       WHERE email = $1 AND created_at > NOW() - INTERVAL '60 seconds'
       LIMIT 1`,
      [email]
    );
    if (recentRes.rows.length > 0) {
      return res.status(429).json({ error: '请求过于频繁，请 60 秒后再试' });
    }
  }

  // 1. 使用密码学安全随机数生成 6 位验证码（取代 Math.random）
  const code = crypto.randomInt(100000, 1000000).toString();
  const expiredAt = new Date(Date.now() + 10 * 60 * 1000); // 10分钟后过期

  // 2. 存入数据库前，顺便清理数据库中所有已经过期的历史验证码（惰性自打扫机制，保持表轻量）
  try {
    await dbClient.query('DELETE FROM email_verifications WHERE expired_at < NOW()');
  } catch (err) {
    console.error('[WARN] 自动清理过期验证码失败:', err);
  }

  await dbClient.query(
    'INSERT INTO email_verifications (email, code, expired_at) VALUES ($1, $2, $3)',
    [email, code, expiredAt]
  );

  // 3. 读取 SMTP 配置
  const host = process.env.SMTP_HOST;
  const port = process.env.SMTP_PORT ? parseInt(process.env.SMTP_PORT) : 465;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  // 4. 发送邮件（包含假发信回退逻辑）
  if (host && user && pass) {
    try {
      const transporter = nodemailer.createTransport({
        host,
        port,
        secure: port === 465,
        auth: { user, pass }
      });

      const mailOptions = {
        from: `"外贸智友" <${user}>`,
        to: email,
        subject: '【外贸智友】您的注册验证码',
        html: `
          <div style="font-family: system-ui, -apple-system, sans-serif; padding: 24px; color: #1e293b; background-color: #f8fafc; border-radius: 8px;">
            <h2 style="color: #ff641e; font-weight: 500; margin-bottom: 16px;">欢迎注册外贸智友！</h2>
            <p style="font-size: 0.95rem; line-height: 1.6; color: #475569;">您好，感谢您选择外贸智友。您的账户注册验证码如下：</p>
            <div style="margin: 24px 0; padding: 16px; background-color: #ffffff; border: 1px solid #e2e8f0; text-align: center; border-radius: 6px;">
              <span style="font-size: 2rem; font-weight: 600; letter-spacing: 4px; color: #0f172a;">${code}</span>
            </div>
            <p style="font-size: 0.85rem; color: #64748b; line-height: 1.6;">验证码 10 分钟内有效，请勿泄露给他人。如果您没有请求此验证码，请忽略本邮件。</p>
          </div>
        `
      };

      await transporter.sendMail(mailOptions);
      return res.status(200).json({ success: true, message: '验证码已发送至您的邮箱' });
    } catch (err: any) {
      console.error('发送 SMTP 邮件失败:', err.message);
      // 生产环境严格失败，禁止把验证码打到日志；开发环境降级打印仅供本地调试
      if (process.env.NODE_ENV === 'production') {
        return res.status(500).json({ error: '邮件服务暂时不可用，请稍后再试' });
      }
      console.log(`[DEV SMTP FALLBACK] Verification code for ${email} is: ${code}`);
      return res.status(200).json({
        success: true,
        message: '验证码已发送至您的邮箱（开发回退模式）',
        devMode: true
      });
    }
  } else {
    // 未配置 SMTP：生产环境直接失败，开发环境降级打印
    if (process.env.NODE_ENV === 'production') {
      return res.status(500).json({ error: '邮件服务未配置，请联系管理员' });
    }
    console.log(`[DEV NO SMTP] Verification code for ${email} is: ${code}`);
    return res.status(200).json({
      success: true,
      message: '验证码已发送至您的邮箱（开发测试模式）',
      devMode: true
    });
  }
}

export default withDb(sendCodeHandler, {
  methods: ['POST'],
  requiredBody: ['email']
});
