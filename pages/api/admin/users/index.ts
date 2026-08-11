import { NextApiRequest, NextApiResponse } from 'next';
import { PoolClient } from 'pg';
import { withDb } from '../../../../lib/api-handler';
import { requireAdmin } from '../../../../lib/auth';

async function usersHandler(req: NextApiRequest, res: NextApiResponse, dbClient: PoolClient) {
  const session = requireAdmin(req);
  if (!session) {
    return res.status(403).json({ error: '权限不足，仅管理员可访问' });
  }

  // 1. 平滑保证 users 表字段存在
  await dbClient.query(`
    ALTER TABLE users ADD COLUMN IF NOT EXISTS subscription_expires_at TIMESTAMP WITH TIME ZONE;
    ALTER TABLE users ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'active';
  `);

  const page = Math.max(1, parseInt(req.query.page as string, 10) || 1);
  const pageSize = Math.max(1, parseInt(req.query.pageSize as string, 10) || 20);
  const offset = (page - 1) * pageSize;

  const search = (req.query.search as string || '').trim();
  const memberType = req.query.memberType as string || 'All';
  const role = req.query.role as string || 'All';
  const status = req.query.status as string || 'All';

  // 2. 构建动态查询条件
  const whereClauses: string[] = [];
  const queryParams: any[] = [];
  let paramIndex = 1;

  if (search) {
    whereClauses.push(`(u.email ILIKE $${paramIndex} OR u.nickname ILIKE $${paramIndex})`);
    queryParams.push(`%${search}%`);
    paramIndex++;
  }

  if (memberType && memberType !== 'All') {
    whereClauses.push(`u.member_type = $${paramIndex}`);
    queryParams.push(memberType);
    paramIndex++;
  }

  if (role && role !== 'All') {
    whereClauses.push(`u.role = $${paramIndex}`);
    queryParams.push(role);
    paramIndex++;
  }

  if (status && status !== 'All') {
    whereClauses.push(`COALESCE(u.status, 'active') = $${paramIndex}`);
    queryParams.push(status);
    paramIndex++;
  }

  const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

  // 3. 查询总用户数
  const countRes = await dbClient.query(
    `SELECT COUNT(*)::int as total FROM users u ${whereSql}`,
    queryParams
  );
  const totalUsers = countRes.rows[0]?.total || 0;
  const totalPages = Math.ceil(totalUsers / pageSize) || 1;

  // 4. 查询当前页用户列表及画像数据
  const listQueryParams = [...queryParams, pageSize, offset];
  const listRes = await dbClient.query(
    `WITH last_activity AS (
       SELECT user_id, MAX(created_at) as last_seen
       FROM page_views
       GROUP BY user_id
     ),
     user_unlocks AS (
       SELECT user_id, COUNT(DISTINCT report_id)::int as unlock_count
       FROM unlocks
       GROUP BY user_id
     ),
     user_referrals AS (
       SELECT invited_by, COUNT(id)::int as invite_count
       FROM users
       WHERE invited_by IS NOT NULL
       GROUP BY invited_by
     )
     SELECT u.id, u.email, u.nickname, u.role, u.free_quota, u.member_type,
            u.subscription_expires_at, COALESCE(u.status, 'active') as status,
            u.created_at, la.last_seen,
            COALESCE(un.unlock_count, 0) as unlock_count,
            COALESCE(ref.invite_count, 0) as referral_count
     FROM users u
     LEFT JOIN last_activity la ON u.id = la.user_id
     LEFT JOIN user_unlocks un ON u.id = un.user_id
     LEFT JOIN user_referrals ref ON u.id = ref.invited_by
     ${whereSql}
     ORDER BY u.created_at DESC
     LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
    listQueryParams
  );

  // 5. 查询顶部数据总览统计
  const statsRes = await dbClient.query(`
    SELECT 
      COUNT(*)::int as total_users,
      COUNT(CASE WHEN created_at >= NOW() - INTERVAL '1 day' THEN 1 END)::int as today_new_users,
      COUNT(CASE WHEN member_type IN ('pro', 'enterprise') OR subscription_expires_at > NOW() THEN 1 END)::int as vip_users,
      COUNT(CASE WHEN id IN (SELECT DISTINCT user_id FROM page_views WHERE created_at >= NOW() - INTERVAL '7 days') THEN 1 END)::int as active_7d_users
    FROM users
  `);
  const stats = statsRes.rows[0] || {
    total_users: 0,
    today_new_users: 0,
    vip_users: 0,
    active_7d_users: 0
  };

  return res.status(200).json({
    users: listRes.rows,
    totalUsers,
    totalPages,
    currentPage: page,
    pageSize,
    stats
  });
}

export default withDb(usersHandler, {
  methods: ['GET']
});
