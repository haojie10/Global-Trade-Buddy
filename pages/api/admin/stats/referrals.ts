import { NextApiRequest, NextApiResponse } from 'next';
import { PoolClient } from 'pg';
import { withDb } from '../../../../lib/api-handler';
import { requireAdmin } from '../../../../lib/auth';

async function referralsStatsHandler(req: NextApiRequest, res: NextApiResponse, dbClient: PoolClient) {
  const session = requireAdmin(req);
  if (!session) {
    return res.status(403).json({ error: '权限不足，仅管理员可访问' });
  }

  // 1. 邀请漏斗数据
  // 步骤 1: 参与邀请的用户数
  const step1Res = await dbClient.query('SELECT COUNT(DISTINCT invited_by)::int as value FROM users WHERE invited_by IS NOT NULL');
  const invitorsCount = step1Res.rows[0].value || 0;

  // 步骤 2: 被邀请并注册成功的用户数
  const step2Res = await dbClient.query('SELECT COUNT(*)::int as value FROM users WHERE invited_by IS NOT NULL');
  const referredRegCount = step2Res.rows[0].value || 0;

  // 步骤 3: 被邀请并成功解锁过报告的激活用户数
  const step3Res = await dbClient.query(
    `SELECT COUNT(DISTINCT un.user_id)::int as value
     FROM users u
     JOIN unlocks un ON u.id = un.user_id
     WHERE u.invited_by IS NOT NULL`
  );
  const referredActiveCount = step3Res.rows[0].value || 0;

  const funnelData = [
    { name: '参与发起邀请用户数', value: invitorsCount },
    { name: '被邀请注册成功用户数', value: referredRegCount },
    { name: '已解锁报告的活跃被邀请者', value: referredActiveCount }
  ];

  // 2. 邀请排行榜
  const referrerLeaderboardRes = await dbClient.query(
    `SELECT COALESCE(u.nickname, u.email) as name, u.email, COUNT(r.id)::int as value
     FROM users u
     JOIN users r ON u.id = r.invited_by
     GROUP BY u.id, u.email, u.nickname
     ORDER BY value DESC
     LIMIT 15`
  );
  const leaderboard = referrerLeaderboardRes.rows;

  return res.status(200).json({
    funnelData,
    leaderboard
  });
}

export default withDb(referralsStatsHandler, {
  methods: ['GET']
});
