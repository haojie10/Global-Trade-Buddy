import { NextApiRequest, NextApiResponse } from 'next';
import { PoolClient } from 'pg';
import { withDb } from '../../../../lib/api-handler';

/**
 * 校验 Agent 密钥
 */
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

async function claimHandler(req: NextApiRequest, res: NextApiResponse, dbClient: PoolClient) {
  if (!validateAgentAuth(req)) {
    return res.status(401).json({ error: 'Unauthorized: Invalid Agent API Key' });
  }

  const {
    worker_name = 'Anonymous-Worker',
    min_seq = null,
    max_seq = null,
    batch_name = null,
    source_type = null
  } = req.body || {};

  const minSeqVal = min_seq !== null && min_seq !== undefined && !isNaN(Number(min_seq)) ? Number(min_seq) : null;
  const maxSeqVal = max_seq !== null && max_seq !== undefined && !isNaN(Number(max_seq)) ? Number(max_seq) : null;
  const batchVal = batch_name && String(batch_name).trim() ? String(batch_name).trim() : null;
  const sourceVal = source_type && String(source_type).trim() ? String(source_type).trim() : null;

  try {
    await dbClient.query('BEGIN');

    // 核心行级排他锁原子抢单 SQL
    // 严格只抢占 status = 'pending' 的任务，不自动篡改 running 状态（超时由后台手动处理）
    const claimRes = await dbClient.query(
      `UPDATE research_tasks
       SET status = 'running',
           assigned_worker = $1,
           locked_at = NOW(),
           updated_at = NOW()
       WHERE id = (
           SELECT id FROM research_tasks
           WHERE status = 'pending'
             AND ($2::int IS NULL OR seq_no >= $2)
             AND ($3::int IS NULL OR seq_no <= $3)
             AND ($4::varchar IS NULL OR batch_name = $4)
             AND ($5::varchar IS NULL OR source_type = $5)
           ORDER BY priority DESC, seq_no ASC
           FOR UPDATE SKIP LOCKED
           LIMIT 1
       )
       RETURNING id, seq_no, batch_name, company_name, country, website, industry, priority, source_type, source_company_name`,
      [String(worker_name).trim(), minSeqVal, maxSeqVal, batchVal, sourceVal]
    );

    await dbClient.query('COMMIT');

    if (claimRes.rows.length === 0) {
      return res.status(200).json({
        success: true,
        hasTask: false,
        message: '当前队列中无符合条件的待调研任务'
      });
    }

    const task = claimRes.rows[0];
    return res.status(200).json({
      success: true,
      hasTask: true,
      task
    });
  } catch (err: any) {
    await dbClient.query('ROLLBACK');
    console.error('Error claiming research task:', err);
    return res.status(500).json({ error: 'Failed to claim research task', details: err.message });
  }
}

export default withDb(claimHandler, { methods: ['POST'] });
