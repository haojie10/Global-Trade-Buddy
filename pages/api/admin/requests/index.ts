import { NextApiRequest, NextApiResponse } from 'next';
import { PoolClient } from 'pg';
import { withDb } from '../../../../lib/api-handler';
import { requireAdmin } from '../../../../lib/auth';

const CREATE_TABLE_SQL = `
CREATE TABLE IF NOT EXISTS custom_report_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  contact_email VARCHAR(255) NOT NULL,
  request_type VARCHAR(50) NOT NULL,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  status VARCHAR(20) NOT NULL DEFAULT 'pending',
  report_id UUID REFERENCES reports(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_custom_report_requests_status ON custom_report_requests(status);
`;

async function requestsHandler(req: NextApiRequest, res: NextApiResponse, dbClient: PoolClient) {
  const session = requireAdmin(req);
  if (!session) {
    return res.status(403).json({ error: '权限不足，仅管理员可访问' });
  }

  // 确保表存在
  try {
    await dbClient.query(CREATE_TABLE_SQL);
  } catch (err) {
    console.warn('[admin/requests] table check:', err);
  }

  if (req.method === 'GET') {
    const status = (req.query.status as string || 'all').trim();
    const type = (req.query.type as string || 'all').trim();
    const search = (req.query.search as string || '').trim();

    const whereConditions: string[] = [];
    const params: any[] = [];
    let pIndex = 1;

    if (status && status !== 'all') {
      whereConditions.push(`r.status = $${pIndex}`);
      params.push(status);
      pIndex++;
    }

    if (type && type !== 'all') {
      whereConditions.push(`r.request_type = $${pIndex}`);
      params.push(type);
      pIndex++;
    }

    if (search) {
      whereConditions.push(`(
        r.contact_email ILIKE $${pIndex}
        OR r.payload::text ILIKE $${pIndex}
        OR u.nickname ILIKE $${pIndex}
      )`);
      params.push(`%${search}%`);
      pIndex++;
    }

    const whereSql = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';

    // 查询列表
    const listRes = await dbClient.query(`
      SELECT 
        r.id,
        r.user_id,
        r.contact_email,
        r.request_type,
        r.payload,
        r.status,
        r.report_id,
        r.created_at,
        r.updated_at,
        u.nickname as user_nickname,
        u.role as user_role,
        rep.title as linked_report_title
      FROM custom_report_requests r
      LEFT JOIN users u ON r.user_id = u.id
      LEFT JOIN reports rep ON r.report_id = rep.id
      ${whereSql}
      ORDER BY r.created_at DESC
      LIMIT 100
    `, params);

    // 查询统计概览
    const statsRes = await dbClient.query(`
      SELECT 
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE status = 'pending') as pending_count,
        COUNT(*) FILTER (WHERE status = 'processing') as processing_count,
        COUNT(*) FILTER (WHERE status = 'completed') as completed_count,
        COUNT(*) FILTER (WHERE status = 'failed') as failed_count,
        COUNT(*) FILTER (WHERE request_type = 'feedback') as feedback_count,
        COUNT(*) FILTER (WHERE request_type IN ('category_insight', 'company_insight')) as custom_count
      FROM custom_report_requests
    `);

    const stats = statsRes.rows[0] || {
      total: 0,
      pending_count: 0,
      processing_count: 0,
      completed_count: 0,
      failed_count: 0,
      feedback_count: 0,
      custom_count: 0
    };

    return res.status(200).json({
      success: true,
      requests: listRes.rows,
      stats: {
        total: parseInt(stats.total, 10),
        pending: parseInt(stats.pending_count, 10),
        processing: parseInt(stats.processing_count, 10),
        completed: parseInt(stats.completed_count, 10),
        failed: parseInt(stats.failed_count, 10),
        feedbackCount: parseInt(stats.feedback_count, 10),
        customCount: parseInt(stats.custom_count, 10)
      }
    });
  }

  if (req.method === 'PATCH') {
    const { id, status, report_id } = req.body;
    if (!id || !status) {
      return res.status(400).json({ error: '缺少 id 或 status 参数' });
    }

    const validStatuses = ['pending', 'processing', 'completed', 'failed'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ error: '无效的状态值' });
    }

    const updateRes = await dbClient.query(`
      UPDATE custom_report_requests
      SET 
        status = $1,
        report_id = COALESCE($2, report_id),
        updated_at = NOW()
      WHERE id = $3
      RETURNING *
    `, [status, report_id || null, id]);

    if (updateRes.rowCount === 0) {
      return res.status(404).json({ error: '未找到指定的需求或反馈记录' });
    }

    return res.status(200).json({
      success: true,
      request: updateRes.rows[0]
    });
  }

  return res.status(405).json({ error: 'Method Not Allowed' });
}

export default withDb(requestsHandler, {
  methods: ['GET', 'PATCH']
});
