import { NextApiRequest, NextApiResponse } from 'next';
import { PoolClient } from 'pg';
import { withDb } from '../../../../lib/api-handler';

function validateAgentAuth(req: NextApiRequest): boolean {
  const authHeader = req.headers.authorization;
  const token = (authHeader && authHeader.split(' ')[1]) || (req.headers['x-agent-key'] as string);
  const isProd = process.env.NODE_ENV === 'production';
  const expectedToken = process.env.AGENT_API_KEY;

  if (isProd && !expectedToken) return false;
  return isProd
    ? (Boolean(token) && token === expectedToken)
    : (token === (expectedToken || 'automation_agent_secret') || token === 'automation_agent_secret');
}

async function failHandler(req: NextApiRequest, res: NextApiResponse, dbClient: PoolClient) {
  if (!validateAgentAuth(req)) {
    return res.status(401).json({ error: 'Unauthorized: Invalid Agent API Key' });
  }

  const { task_id, error_message } = req.body || {};

  if (!task_id) {
    return res.status(400).json({ error: 'Missing required parameter: task_id' });
  }

  try {
    const updateRes = await dbClient.query(
      `UPDATE research_tasks
       SET status = 'failed',
           error_message = $1,
           updated_at = NOW()
       WHERE id = $2
       RETURNING id, company_name, seq_no, status`,
      [error_message || '未知调研异常', task_id]
    );

    if (updateRes.rows.length === 0) {
      return res.status(404).json({ error: 'Task not found' });
    }

    return res.status(200).json({
      success: true,
      message: '任务异常已记录并归档',
      task: updateRes.rows[0]
    });
  } catch (err: any) {
    console.error('Error recording task failure:', err);
    return res.status(500).json({ error: 'Failed to record task failure', details: err.message });
  }
}

export default withDb(failHandler, { methods: ['POST'] });
