import { NextApiRequest, NextApiResponse } from 'next';
import { PoolClient } from 'pg';
import { withDb } from '../../../../lib/api-handler';
import { requireAdmin } from '../../../../lib/auth';

async function resetTasksHandler(req: NextApiRequest, res: NextApiResponse, dbClient: PoolClient) {
  const admin = requireAdmin(req);
  if (!admin) {
    return res.status(403).json({ error: 'Forbidden: Admin access required' });
  }

  const { task_ids = [], reset_all_timeout = false } = req.body || {};

  try {
    let resetRes;

    if (reset_all_timeout) {
      // 一键重置所有超时 30 分钟的任务
      resetRes = await dbClient.query(
        `UPDATE research_tasks
         SET status = 'pending',
             assigned_worker = NULL,
             locked_at = NULL,
             updated_at = NOW()
         WHERE status = 'running' 
           AND locked_at < NOW() - INTERVAL '30 minutes'
         RETURNING id, seq_no, company_name, status`
      );
    } else if (Array.isArray(task_ids) && task_ids.length > 0) {
      // 重置指定的任务列表
      resetRes = await dbClient.query(
        `UPDATE research_tasks
         SET status = 'pending',
             assigned_worker = NULL,
             locked_at = NULL,
             updated_at = NOW()
         WHERE id = ANY($1::uuid[])
         RETURNING id, seq_no, company_name, status`,
        [task_ids]
      );
    } else {
      return res.status(400).json({ error: 'Please provide task_ids or set reset_all_timeout to true' });
    }

    return res.status(200).json({
      success: true,
      message: `成功重置 ${resetRes.rows.length} 条任务为待调研状态`,
      resetCount: resetRes.rows.length,
      tasks: resetRes.rows
    });
  } catch (err: any) {
    console.error('Error resetting research tasks:', err);
    return res.status(500).json({ error: 'Failed to reset tasks', details: err.message });
  }
}

export default withDb(resetTasksHandler, { methods: ['POST'] });
