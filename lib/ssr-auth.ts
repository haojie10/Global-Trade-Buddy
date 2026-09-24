import { GetServerSidePropsContext } from 'next';
import { PoolClient } from 'pg';
import { getSession, Session } from './auth';

export interface SsrAuthResult {
  userId: string | null;
  userRole: string;
  freeQuota: number;
  downloadQuota: number;
  memberType: string;
  nickname: string;
  email: string;
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
  let session: Session | null = null;

  try {
    session = getSession(context.req as any);
  } catch {
    // SESSION_SECRET 未配置或签名验证失败时，静默降级为访客
    return { userId: null, userRole: 'guest', freeQuota: 0, downloadQuota: 0, memberType: 'free', nickname: '', email: '', session: null };
  }

  if (!session) {
    return { userId: null, userRole: 'guest', freeQuota: 0, downloadQuota: 0, memberType: 'free', nickname: '', email: '', session: null };
  }

  try {
    const userRes = await dbClient.query(
      'SELECT id, role, free_quota, download_quota, member_type, pro_cycle_expires_at, nickname, email FROM users WHERE id = $1',
      [session.userId]
    );
    if (userRes.rows.length === 0) {
      return { userId: null, userRole: 'guest', freeQuota: 0, downloadQuota: 0, memberType: 'free', nickname: '', email: '', session: null };
    }
    const user = userRes.rows[0];

    // Pro 会员自然月周期自动充能逻辑
    if (user.member_type === 'pro' && user.pro_cycle_expires_at) {
      const now = new Date();
      const expiresAt = new Date(user.pro_cycle_expires_at);
      if (now >= expiresAt) {
        await dbClient.query(
          `UPDATE users 
           SET free_quota = 50, 
               download_quota = 10, 
               pro_cycle_expires_at = pro_cycle_expires_at + INTERVAL '1 month' 
           WHERE id = $1`,
          [user.id]
        );
        user.free_quota = 50;
        user.download_quota = 10;
      }
    }

    return {
      userId: user.id,
      userRole: user.role,
      freeQuota: user.free_quota || 0,
      downloadQuota: user.download_quota || 0,
      memberType: user.member_type || 'free',
      nickname: user.nickname || '',
      email: user.email || '',
      session
    };
  } catch {
    return { userId: null, userRole: 'guest', freeQuota: 0, downloadQuota: 0, memberType: 'free', nickname: '', email: '', session: null };
  }
}
