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
    task_ids,
    action,
    seq_no,
    priority,
    status,
    company_name,
    country,
    website,
    industry,
    tag
  } = req.body || {};

  if (!task_id && (!task_ids || !Array.isArray(task_ids) || task_ids.length === 0)) {
    return res.status(400).json({ error: 'Missing required parameter: task_id or task_ids' });
  }

  try {
    await dbClient.query('ALTER TABLE research_tasks ADD COLUMN IF NOT EXISTS tag VARCHAR(50);').catch(() => {});
    let updateRes;

    if (action === 'batch_set_tag') {
      // 批量设置调度标签
      const finalTag = tag && String(tag).trim() ? String(tag).trim() : null;
      updateRes = await dbClient.query(
        `UPDATE research_tasks
         SET tag = $1, updated_at = NOW()
         WHERE id = ANY($2::uuid[]) RETURNING *`,
        [finalTag, task_ids || [task_id]]
      );
      return res.status(200).json({
        success: true,
        message: `已成功为 ${updateRes.rows.length} 条任务更新调度标签`,
        updatedCount: updateRes.rows.length
      });
    } else if (action === 'set_tag') {
      // 单条设置调度标签
      const finalTag = tag && String(tag).trim() ? String(tag).trim() : null;
      updateRes = await dbClient.query(
        `UPDATE research_tasks
         SET tag = $1, updated_at = NOW()
         WHERE id = $2 RETURNING *`,
        [finalTag, task_id]
      );
    } else if (action === 'pin') {
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
      const finalTag = tag !== undefined ? (tag && String(tag).trim() ? String(tag).trim() : null) : undefined;
      updateRes = await dbClient.query(
        `UPDATE research_tasks
         SET company_name = COALESCE($1, company_name),
             country = COALESCE($2, country),
             website = COALESCE($3, website),
             industry = COALESCE($4, industry),
             priority = COALESCE($5, priority),
             seq_no = COALESCE($6, seq_no),
             status = COALESCE($7, status),
             tag = CASE WHEN $8::boolean THEN $9 ELSE tag END,
             updated_at = NOW()
         WHERE id = $10 RETURNING *`,
        [company_name, country, website, industry, priority, seq_no, status, finalTag !== undefined, finalTag || null, task_id]
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
