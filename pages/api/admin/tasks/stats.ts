import { NextApiRequest, NextApiResponse } from 'next';
import { PoolClient } from 'pg';
import { withDb } from '../../../../lib/api-handler';
import { requireAdmin } from '../../../../lib/auth';

async function tasksStatsHandler(req: NextApiRequest, res: NextApiResponse, dbClient: PoolClient) {
  const admin = requireAdmin(req);
  if (!admin) {
    return res.status(403).json({ error: 'Forbidden: Admin access required' });
  }

  try {
    // 1. 各状态聚合统计
    const statusCountsRes = await dbClient.query(`
      SELECT 
        status,
        COUNT(*)::int AS count
      FROM research_tasks
      GROUP BY status
    `);

    const statusMap: Record<string, number> = {
      pending: 0,
      running: 0,
      completed: 0,
      failed: 0,
      paused: 0
    };

    let total = 0;
    for (const row of statusCountsRes.rows) {
      statusMap[row.status] = row.count;
      total += row.count;
    }

    // 2. 超时任务统计 (running 超过 30 分钟)
    const timeoutRes = await dbClient.query(`
      SELECT COUNT(*)::int AS count 
      FROM research_tasks 
      WHERE status = 'running' AND locked_at < NOW() - INTERVAL '30 minutes'
    `);
    const timeoutCount = timeoutRes.rows[0]?.count || 0;

    // 3. 来源渠道聚合统计
    const sourceRes = await dbClient.query(`
      SELECT 
        source_type,
        COUNT(*)::int AS count
      FROM research_tasks
      GROUP BY source_type
    `);

    const sourceMap: Record<string, number> = {
      manual: 0,
      batch_import: 0,
      competitor_discovery: 0
    };
    for (const row of sourceRes.rows) {
      sourceMap[row.source_type || 'manual'] = row.count;
    }

    // 4. 当前活跃运行中的 Worker 机器及当前任务
    const activeWorkersRes = await dbClient.query(`
      SELECT 
        assigned_worker,
        company_name,
        country,
        seq_no,
        locked_at,
        ROUND(EXTRACT(EPOCH FROM (NOW() - locked_at)) / 60) AS running_minutes,
        CASE WHEN locked_at < NOW() - INTERVAL '30 minutes' THEN true ELSE false END AS is_timeout
      FROM research_tasks
      WHERE status = 'running'
      ORDER BY locked_at ASC
    `);

    const progressPercent = total > 0 ? ((statusMap.completed / total) * 100).toFixed(1) + '%' : '0.0%';

    return res.status(200).json({
      success: true,
      stats: {
        total,
        completed: statusMap.completed,
        running: statusMap.running,
        pending: statusMap.pending,
        failed: statusMap.failed,
        paused: statusMap.paused,
        timeoutCount,
        progressPercent,
        sourceBreakdown: sourceMap,
        activeWorkers: activeWorkersRes.rows
      }
    });
  } catch (err: any) {
    console.error('Error fetching tasks statistics:', err);
    return res.status(500).json({ error: 'Failed to fetch task stats', details: err.message });
  }
}

export default withDb(tasksStatsHandler, { methods: ['GET'] });
