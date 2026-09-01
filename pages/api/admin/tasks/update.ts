import { NextApiRequest, NextApiResponse } from 'next';
import { PoolClient } from 'pg';
import { withDb } from '../../../../lib/api-handler';
import { requireAdmin } from '../../../../lib/auth';

async function updateTaskHandler(req: NextApiRequest, res: NextApiResponse, dbClient: PoolClient) {
  const admin = requireAdmin(req);
  if (!admin) {
    return res.status(403).json({ error: 'Forbidden: Admin access required' });
  }

  const {
    task_id,
    action,
    seq_no,
    priority,
    status,
    company_name,
    country,
    website,
    industry
  } = req.body || {};

  if (!task_id) {
    return res.status(400).json({ error: 'Missing required parameter: task_id' });
  }

  try {
    let updateRes;

    if (action === 'pin') {
      // 置顶: priority 设置为 999
      updateRes = await dbClient.query(
        `UPDATE research_tasks
         SET priority = 999, updated_at = NOW()
         WHERE id = $1 RETURNING *`,
        [task_id]
      );
    } else if (action === 'unpin') {
      // 取消置顶: 恢复为 50 (或按来源恢复)
      updateRes = await dbClient.query(
        `UPDATE research_tasks
         SET priority = CASE WHEN source_type = 'competitor_discovery' THEN 20 ELSE 80 END,
             updated_at = NOW()
         WHERE id = $1 RETURNING *`,
        [task_id]
      );
    } else if (action === 'set_seq' && seq_no !== undefined) {
      // 修改序号
      updateRes = await dbClient.query(
        `UPDATE research_tasks
         SET seq_no = $1, updated_at = NOW()
         WHERE id = $2 RETURNING *`,
        [Number(seq_no), task_id]
      );
    } else if (action === 'set_status' && status) {
      // 修改状态
      updateRes = await dbClient.query(
        `UPDATE research_tasks
         SET status = $1, updated_at = NOW()
         WHERE id = $2 RETURNING *`,
        [status, task_id]
      );
    } else if (action === 'edit') {
      // 综合编辑字段
      updateRes = await dbClient.query(
        `UPDATE research_tasks
         SET company_name = COALESCE($1, company_name),
             country = COALESCE($2, country),
             website = COALESCE($3, website),
             industry = COALESCE($4, industry),
             priority = COALESCE($5, priority),
             seq_no = COALESCE($6, seq_no),
             status = COALESCE($7, status),
             updated_at = NOW()
         WHERE id = $8 RETURNING *`,
        [company_name, country, website, industry, priority, seq_no, status, task_id]
      );
    } else {
      return res.status(400).json({ error: 'Invalid update action or parameters' });
    }

    if (updateRes.rows.length === 0) {
      return res.status(404).json({ error: 'Task not found' });
    }

    return res.status(200).json({
      success: true,
      message: '任务已成功更新',
      task: updateRes.rows[0]
    });
  } catch (err: any) {
    console.error('Error updating research task:', err);
    return res.status(500).json({ error: 'Failed to update task', details: err.message });
  }
}

export default withDb(updateTaskHandler, { methods: ['POST'] });
