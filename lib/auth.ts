import { NextApiRequest, NextApiResponse } from 'next';
import { serialize } from 'cookie';

export interface Session {
  userId: string;
  role: string;
}

// 从 httpOnly Cookie 中解析会话信息
export function getSession(req: NextApiRequest): Session | null {
  const raw = req.cookies?.['gtb_session'];
  if (!raw) return null;
  try {
    const decoded = Buffer.from(raw, 'base64').toString('utf8');
    return JSON.parse(decoded) as Session;
  } catch {
    return null;
  }
}

// 将会话编码为 base64 Cookie 值
export function encodeSession(session: Session): string {
  return Buffer.from(JSON.stringify(session)).toString('base64');
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
