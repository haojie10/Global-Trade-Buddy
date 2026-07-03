import { NextApiRequest, NextApiResponse } from 'next';
import { serialize } from 'cookie';
import crypto from 'crypto';

export interface Session {
  userId: string;
  role: string;
}

/**
 * 获取会话签名密钥
 * NOTE: 生产环境必须通过 SESSION_SECRET 环境变量配置，否则拒绝启动
 */
function getSessionSecret(): string {
  const secret = process.env.SESSION_SECRET;
  if (!secret) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('SESSION_SECRET 环境变量未设置，生产环境不可启动');
    }
    // 开发/测试环境使用默认值，仅供本地调试
    return 'dev-only-insecure-secret-do-not-use-in-prod';
  }
  return secret;
}

/**
 * 使用 HMAC-SHA256 对 payload 进行签名
 * @param payload Base64 编码后的会话数据
 * @returns 十六进制签名字符串
 */
function sign(payload: string): string {
  const secret = getSessionSecret();
  return crypto.createHmac('sha256', secret).update(payload).digest('hex');
}

/**
 * 从 httpOnly Cookie 中解析并验证会话信息
 * NOTE: 使用 timingSafeEqual 防止时序攻击推断签名内容
 */
export function getSession(req: NextApiRequest): Session | null {
  const raw = req.cookies?.['gtb_session'];
  if (!raw) return null;

  try {
    const dotIndex = raw.lastIndexOf('.');
    if (dotIndex === -1) return null;

    const payload = raw.substring(0, dotIndex);
    const signature = raw.substring(dotIndex + 1);

    // 重新计算签名并用恒定时间比较防止时序攻击
    const expectedSig = sign(payload);
    const sigBuffer = Buffer.from(signature, 'hex');
    const expectedBuffer = Buffer.from(expectedSig, 'hex');

    if (sigBuffer.length !== expectedBuffer.length) return null;
    if (!crypto.timingSafeEqual(sigBuffer, expectedBuffer)) return null;

    const decoded = Buffer.from(payload, 'base64').toString('utf8');
    return JSON.parse(decoded) as Session;
  } catch {
    return null;
  }
}

/**
 * 将会话编码并签名为 Cookie 值
 * 格式: base64(payload).hmac_sha256_hex
 */
export function encodeSession(session: Session): string {
  const payload = Buffer.from(JSON.stringify(session)).toString('base64');
  const signature = sign(payload);
  return `${payload}.${signature}`;
}

// 设置登录 Cookie
export function setSessionCookie(res: NextApiResponse, session: Session): void {
  const value = encodeSession(session);
  res.setHeader(
    'Set-Cookie',
    serialize('gtb_session', value, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 24 * 7, // 7 天
    })
  );
}

// 清除登录 Cookie
export function clearSessionCookie(res: NextApiResponse): void {
  res.setHeader(
    'Set-Cookie',
    serialize('gtb_session', '', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 0,
    })
  );
}

/**
 * 从请求中提取已签名验证的用户会话
 * @returns 通过验证的 Session 或 null（未登录/签名无效）
 */
export function requireUser(req: NextApiRequest): Session | null {
  return getSession(req);
}

/**
 * 从请求中提取已签名验证的管理员会话
 * @returns 通过验证且 role === 'admin' 的 Session 或 null
 */
export function requireAdmin(req: NextApiRequest): Session | null {
  const session = getSession(req);
  if (!session || session.role !== 'admin') return null;
  return session;
}
