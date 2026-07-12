import { NextApiRequest, NextApiResponse } from 'next';
import { PoolClient } from 'pg';
import { withDb } from '../../../../lib/api-handler';
import { requireAdmin } from '../../../../lib/auth';

async function userStatsHandler(req: NextApiRequest, res: NextApiResponse, dbClient: PoolClient) {
  const session = requireAdmin(req);
  if (!session) {
    return res.status(403).json({ error: '权限不足，仅管理员可访问' });
  }

  // 1. 注册增长趋势
  const userGrowthRes = await dbClient.query(
    `SELECT TO_CHAR(created_at, 'YYYY-MM-DD') as name, COUNT(*)::int as value
     FROM users
     GROUP BY name
     ORDER BY name ASC`
  );
  const userGrowth = userGrowthRes.rows;

  // 2. 行为排行榜 (浏览、解锁)
  const userLeaderboardRes = await dbClient.query(
    `SELECT u.id, COALESCE(u.nickname, u.email) as name, u.email,
            COUNT(DISTINCT pv.id)::int as views,
            COUNT(DISTINCT un.id)::int as unlocks
     FROM users u
     LEFT JOIN page_views pv ON u.id = pv.user_id
     LEFT JOIN unlocks un ON u.id = un.user_id
     GROUP BY u.id, u.email, u.nickname
     ORDER BY views DESC, unlocks DESC
     LIMIT 15`
  );
  const userLeaderboard = userLeaderboardRes.rows;

  // 3. 高频搜索关键词
  const searchTermsRes = await dbClient.query(
    `SELECT query as name, COUNT(*)::int as value
     FROM search_logs
     GROUP BY query
     ORDER BY value DESC
     LIMIT 10`
  );
  const searchTerms = searchTermsRes.rows;

  // 4. 用户列表及其活跃度分层
  const userSegmentsListRes = await dbClient.query(
    `WITH last_activity AS (
       SELECT user_id, MAX(created_at) as last_seen
       FROM page_views
       GROUP BY user_id
     )
     SELECT u.id, u.email, u.nickname, u.created_at, la.last_seen,
            CASE 
              WHEN la.last_seen >= NOW() - INTERVAL '7 days' THEN '高活跃'
              WHEN la.last_seen >= NOW() - INTERVAL '30 days' AND la.last_seen < NOW() - INTERVAL '7 days' THEN '中活跃'
              ELSE '沉默'
            END as segment
     FROM users u
     LEFT JOIN last_activity la ON u.id = la.user_id
     ORDER BY la.last_seen DESC NULLS LAST
     LIMIT 50`
  );
  const userList = userSegmentsListRes.rows;

  return res.status(200).json({
    userGrowth,
    userLeaderboard,
    searchTerms,
    userList
  });
}

export default withDb(userStatsHandler, {
  methods: ['GET']
});
