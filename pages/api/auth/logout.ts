import { NextApiRequest, NextApiResponse } from 'next';
import { clearSessionCookie } from '../../../lib/auth';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST' && req.method !== 'GET') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  // 通过 HTTP Response Header 彻底擦除 httpOnly Cookie 'gtb_session'
  clearSessionCookie(res);

  // 同时也清除兼容性旧 Cookie
  res.setHeader('Set-Cookie', [
    'gtb_session=; Path=/; Max-Age=0; HttpOnly; SameSite=Lax',
    'user_id=; Path=/; Max-Age=0',
    'user_role=; Path=/; Max-Age=0'
  ]);

  return res.status(200).json({ success: true, message: '已成功退出登录' });
}
