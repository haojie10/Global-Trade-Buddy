import { GetServerSidePropsContext } from 'next';
import { PoolClient } from 'pg';
import { getSession, Session } from './auth';

export interface SsrAuthResult {
  userId: string | null;
  userRole: string;
  freeQuota: number;
  nickname: string;
  session: Session | null;
}

/**
 * 统一的 SSR 会话解析入口
 * 从经过 HMAC 签名的 gtb_session cookie 中读取用户身份，
 * 取代原先直接信任明文 user_id cookie 的不安全方式。
 */
export async function resolveSsrAuth(
  context: GetServerSidePropsContext,
  dbClient: PoolClient
): Promise<SsrAuthResult> {
  const session = getSession(context.req as any);

  if (!session) {
    return { userId: null, userRole: 'guest', freeQuota: 0, nickname: '', session: null };
  }

  try {
    const userRes = await dbClient.query(
      'SELECT id, role, free_quota, nickname FROM users WHERE id = $1',
      [session.userId]
    );
    if (userRes.rows.length === 0) {
      return { userId: null, userRole: 'guest', freeQuota: 0, nickname: '', session: null };
    }
    const user = userRes.rows[0];
    return {
      userId: user.id,
      userRole: user.role,
      freeQuota: user.free_quota || 0,
      nickname: user.nickname || '',
      session
    };
  } catch {
    return { userId: null, userRole: 'guest', freeQuota: 0, nickname: '', session: null };
  }
}
