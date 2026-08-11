import { NextApiRequest, NextApiResponse } from 'next';
import { PoolClient } from 'pg';
import { withDb } from '../../../../lib/api-handler';
import { requireAdmin } from '../../../../lib/auth';

async function userDetailHandler(req: NextApiRequest, res: NextApiResponse, dbClient: PoolClient) {
  const session = requireAdmin(req);
  if (!session) {
    return res.status(403).json({ error: '权限不足，仅管理员可访问' });
  }

  const userId = req.query.userId as string;
  if (!userId) {
    return res.status(400).json({ error: '缺少用户 ID (userId)' });
  }

  // 1. 查询用户已解锁的报告
  const unlocksRes = await dbClient.query(
    `SELECT u.report_id, u.unlocked_at, r.title, r.category, r.market_region
     FROM unlocks u
     JOIN reports r ON u.report_id = r.id
     WHERE u.user_id = $1
     ORDER BY u.unlocked_at DESC`,
    [userId]
  );

  // 2. 查询该用户邀请的下线列表
  const referralsRes = await dbClient.query(
    `SELECT id, email, nickname, created_at
     FROM users
     WHERE invited_by = $1
     ORDER BY created_at DESC`,
    [userId]
  );

  return res.status(200).json({
    unlockedReports: unlocksRes.rows,
    referrals: referralsRes.rows
  });
}

export default withDb(userDetailHandler, {
  methods: ['GET']
});
