import { NextApiRequest, NextApiResponse } from 'next';
import { PoolClient } from 'pg';
import { withDb } from '../../../../lib/api-handler';
import { requireAdmin } from '../../../../lib/auth';

async function overviewHandler(req: NextApiRequest, res: NextApiResponse, dbClient: PoolClient) {
  // 1. 验证管理员权限
  const session = requireAdmin(req);
  if (!session) {
    return res.status(403).json({ error: '权限不足，仅管理员可访问' });
  }

  // 获取查询的时间范围，可选 7d, 30d, 90d
  const range = req.query.range === '30d' ? '30d' : req.query.range === '90d' ? '90d' : '7d';
  const intervalStr = range === '30d' ? '30 days' : range === '90d' ? '90 days' : '7 days';

  // 2. 并发执行核心指标查询（同一连接上的并发查询由 pg 驱动自动排队，但合并 SQL 可减少 RTT）
  // 将总报告数、新增报告数、总用户数、新增用户数合并为一条 SQL
  const basicKpiRes = await dbClient.query(
    `SELECT
       (SELECT COUNT(*) FROM reports)::int AS total_reports,
       (SELECT COUNT(*) FROM reports WHERE created_at >= NOW() - $1::interval)::int AS added_reports,
       (SELECT COUNT(*) FROM users)::int AS total_users,
       (SELECT COUNT(*) FROM users WHERE created_at >= NOW() - $1::interval)::int AS added_users`,
    [intervalStr]
  );
  const basicKpi = basicKpiRes.rows[0];
  const totalReports = basicKpi.total_reports || 0;
  const addedReports = basicKpi.added_reports || 0;
  const totalUsers = basicKpi.total_users || 0;
  const addedUsers = basicKpi.added_users || 0;

  // KPI 3: 浏览总次数
  const totalViewsRes = await dbClient.query(
    'SELECT COUNT(*) as count FROM page_views WHERE created_at >= NOW() - $1::interval',
    [intervalStr]
  );
  const totalViews = parseInt(totalViewsRes.rows[0].count, 10) || 0;

  const prevViewsRes = await dbClient.query(
    `SELECT COUNT(*) as count FROM page_views 
     WHERE created_at >= NOW() - 2 * $1::interval AND created_at < NOW() - $1::interval`,
    [intervalStr]
  );
  const prevViews = parseInt(prevViewsRes.rows[0].count, 10) || 0;
  const viewsDiff = totalViews - prevViews;
  const viewsChangeStr = viewsDiff >= 0 ? `+${viewsDiff}` : `${viewsDiff}`;

  // KPI 4: 平均停留时长
  const avgDurationRes = await dbClient.query(
    `SELECT COALESCE(AVG(duration_seconds), 0) as avg_dur 
     FROM page_views 
     WHERE created_at >= NOW() - $1::interval AND duration_seconds > 0`,
    [intervalStr]
  );
  const avgDurSeconds = Math.round(parseFloat(avgDurationRes.rows[0].avg_dur) || 0);
  const avgDurMinutesStr = `${Math.floor(avgDurSeconds / 60)}:${String(avgDurSeconds % 60).padStart(2, '0')}`;

  const prevAvgRes = await dbClient.query(
    `SELECT COALESCE(AVG(duration_seconds), 0) as avg_dur 
     FROM page_views 
     WHERE created_at >= NOW() - 2 * $1::interval AND created_at < NOW() - $1::interval AND duration_seconds > 0`,
    [intervalStr]
  );
  const prevAvgDur = Math.round(parseFloat(prevAvgRes.rows[0].avg_dur) || 0);
  const durDiff = avgDurSeconds - prevAvgDur;
  const durChangeStr = durDiff >= 0 ? `+${durDiff}秒` : `${durDiff}秒`;

  // KPI 5: 解锁率
  const reportViewsRes = await dbClient.query(
    `SELECT COUNT(*) as count FROM page_views 
     WHERE created_at >= NOW() - $1::interval AND content_type = 'report'`,
    [intervalStr]
  );
  const reportViews = parseInt(reportViewsRes.rows[0].count, 10) || 0;

  const unlocksRes = await dbClient.query(
    'SELECT COUNT(*) as count FROM unlocks WHERE unlocked_at >= NOW() - $1::interval',
    [intervalStr]
  );
  const unlocks = parseInt(unlocksRes.rows[0].count, 10) || 0;
  const unlockRateVal = reportViews > 0 ? Math.round((unlocks / reportViews) * 100) : 0;

  const prevReportViewsRes = await dbClient.query(
    `SELECT COUNT(*) as count FROM page_views 
     WHERE created_at >= NOW() - 2 * $1::interval AND created_at < NOW() - $1::interval AND content_type = 'report'`,
    [intervalStr]
  );
  const prevReportViews = parseInt(prevReportViewsRes.rows[0].count, 10) || 0;

  const prevUnlocksRes = await dbClient.query(
    `SELECT COUNT(*) as count FROM unlocks 
     WHERE unlocked_at >= NOW() - 2 * $1::interval AND unlocked_at < NOW() - $1::interval`,
    [intervalStr]
  );
  const prevUnlocks = parseInt(prevUnlocksRes.rows[0].count, 10) || 0;
  const prevUnlockRateVal = prevReportViews > 0 ? Math.round((prevUnlocks / prevReportViews) * 100) : 0;
  const rateDiff = unlockRateVal - prevUnlockRateVal;
  const rateChangeStr = rateDiff >= 0 ? `+${rateDiff}%` : `${rateDiff}%`;

  // KPI 6: 过期报告预警
  const expiredCountRes = await dbClient.query(
    "SELECT COUNT(*) as count FROM reports WHERE created_at < NOW() - INTERVAL '90 days'"
  );
  const expiredCount = parseInt(expiredCountRes.rows[0].count, 10) || 0;

  // 3. 浏览趋势（按日统计：融合实时日志与归档聚合表）
  const viewsTrendRes = await dbClient.query(
    `WITH raw_pv AS (
       SELECT TO_CHAR(created_at, 'YYYY-MM-DD') as name, COUNT(*)::int as value
       FROM page_views
       WHERE created_at >= NOW() - $1::interval
       GROUP BY name
     ),
     archived_pv AS (
       SELECT TO_CHAR(date, 'YYYY-MM-DD') as name, total_pv as value
       FROM daily_stats_summary
       WHERE date >= (NOW() - $1::interval)::date
     )
     SELECT name, SUM(value)::int as value
     FROM (
       SELECT name, value FROM raw_pv
       UNION ALL
       SELECT name, value FROM archived_pv
       WHERE name NOT IN (SELECT name FROM raw_pv)
     ) combined
     GROUP BY name
     ORDER BY name ASC`,
    [intervalStr]
  );
  const viewsTrend = viewsTrendRes.rows;

  // 4. 热门报告 Top 5
  const topReportsRes = await dbClient.query(
    `SELECT r.id, r.title, COUNT(pv.id)::int as value
     FROM page_views pv
     JOIN reports r ON pv.content_id = r.id
     WHERE pv.content_type = 'report' AND pv.created_at >= NOW() - $1::interval
     GROUP BY r.id, r.title
     ORDER BY value DESC
     LIMIT 5`,
    [intervalStr]
  );
  const topReports = topReportsRes.rows.map(row => ({
    name: row.title,
    value: row.value,
    id: row.id
  }));

  // 5. 搜索缺口 Top 5
  const searchGapsRes = await dbClient.query(
    `SELECT query as name, COUNT(*)::int as value
     FROM search_logs
     WHERE results_count = 0 AND created_at >= NOW() - $1::interval
     GROUP BY query
     ORDER BY value DESC
     LIMIT 5`,
    [intervalStr]
  );
  const searchGaps = searchGapsRes.rows;

  // 6. 过期报告列表 (加 age_days)
  const expiredListRes = await dbClient.query(
    `SELECT id, title, created_at, EXTRACT(DAY FROM NOW() - created_at)::int as age_days
     FROM reports
     WHERE created_at < NOW() - INTERVAL '90 days'
     ORDER BY created_at ASC
     LIMIT 5`
  );
  const expiredList = expiredListRes.rows.map(row => ({
    id: row.id,
    title: row.title,
    ageDays: row.age_days
  }));

  // 7. 用户活跃分层
  const userSegmentsRes = await dbClient.query(
    `WITH last_activity AS (
      SELECT user_id, MAX(created_at) as last_seen
      FROM page_views
      GROUP BY user_id
    )
    SELECT 
      COUNT(CASE WHEN last_seen >= NOW() - INTERVAL '7 days' THEN 1 END)::int as high,
      COUNT(CASE WHEN last_seen >= NOW() - INTERVAL '30 days' AND last_seen < NOW() - INTERVAL '7 days' THEN 1 END)::int as medium,
      COUNT(CASE WHEN last_seen < NOW() - INTERVAL '30 days' OR last_seen IS NULL THEN 1 END)::int as silent
    FROM users u
    LEFT JOIN last_activity la ON u.id = la.user_id`
  );
  const userSegmentsRaw = userSegmentsRes.rows[0];
  const userSegments = [
    { name: '高活跃', value: userSegmentsRaw.high || 0 },
    { name: '中活跃', value: userSegmentsRaw.medium || 0 },
    { name: '沉默用户', value: userSegmentsRaw.silent || 0 }
  ];

  return res.status(200).json({
    kpi: {
      totalReports: { value: totalReports, change: `+${addedReports}`, period: `近${range}` },
      totalUsers: { value: totalUsers, change: `+${addedUsers}`, period: `近${range}` },
      totalViews: { value: totalViews, change: viewsChangeStr, period: '环比' },
      avgDuration: { value: avgDurMinutesStr, change: durChangeStr, period: '环比' },
      unlockRate: { value: `${unlockRateVal}%`, change: rateChangeStr, period: '环比' },
      expiredReports: { value: expiredCount, label: '> 90天未更新' }
    },
    viewsTrend,
    topReports,
    searchGaps,
    expiredList,
    userSegments
  });
}

export default withDb(overviewHandler, {
  methods: ['GET']
});
