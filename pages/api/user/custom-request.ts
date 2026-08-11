import { NextApiRequest, NextApiResponse } from 'next';
import { PoolClient } from 'pg';
import { withDb } from '../../../lib/api-handler';
import { getSession } from '../../../lib/auth';

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

async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
  dbClient: PoolClient
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // 1. 确保目标数据库表已安全创建（Self-Healing 机制）
  try {
    await dbClient.query(CREATE_TABLE_SQL);
  } catch (tableErr) {
    console.warn('[custom-request] Table creation check:', tableErr);
  }

  const { requestType, contactEmail, payload } = req.body;

  if (!requestType || !payload) {
    return res.status(400).json({ error: '请填写完整的研报定制或反馈需求信息' });
  }

  const validTypes = ['category_insight', 'company_insight', 'feedback'];
  if (!validTypes.includes(requestType)) {
    return res.status(400).json({ error: '不合法的请求类型' });
  }

  // 获取当前登录用户 ID 及注册邮箱
  const session = getSession(req);
  const userId = session?.userId || null;
  let finalEmail = (contactEmail || '').trim();

  // 如果前端未传来 contactEmail，直接从数据库主表中查出用户的真实注册邮箱
  if (!finalEmail && userId) {
    try {
      const uRes = await dbClient.query('SELECT email FROM users WHERE id = $1', [userId]);
      if (uRes.rows.length > 0 && uRes.rows[0].email) {
        finalEmail = uRes.rows[0].email;
      }
    } catch (err) {
      console.warn('[custom-request] Query user email error:', err);
    }
  }

  if (!finalEmail) {
    finalEmail = userId ? `${userId}@gtb.user` : 'guest@gtb.user';
  }

  // 插入定制/反馈请求入库
  const insertRes = await dbClient.query(
    `INSERT INTO custom_report_requests (user_id, contact_email, request_type, payload, status)
     VALUES ($1, $2, $3, $4, 'pending')
     RETURNING id, request_type, status, created_at`,
    [userId, finalEmail, requestType, JSON.stringify(payload)]
  );

  const newRecord = insertRes.rows[0];

  return res.status(200).json({
    success: true,
    message: '需求已提交！AI 智能体已接单，完成后您将收到邮件通知。',
    request: newRecord
  });
}

export default withDb(handler);
