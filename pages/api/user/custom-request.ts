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
  report_id VARCHAR(255),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_custom_report_requests_status ON custom_report_requests(status);
`;

async function customRequestHandler(
  req: NextApiRequest,
  res: NextApiResponse,
  dbClient: PoolClient
) {
  // 1. 确保目标数据库表已安全创建（Self-Healing 机制）
  try {
    await dbClient.query(CREATE_TABLE_SQL);
  } catch (tableErr) {
    console.warn('[custom-request] Table creation check:', tableErr);
  }

  const { requestType, contactEmail, payload } = req.body;
  const cleanEmail = (contactEmail || '').trim();

  if (!requestType || !cleanEmail || !payload) {
    return res.status(400).json({ error: '请填写完整的请求类型、联系邮箱与需求信息' });
  }

  const validTypes = ['category_insight', 'company_insight', 'feedback'];
  if (!validTypes.includes(requestType)) {
    return res.status(400).json({ error: '不合法的请求类型' });
  }

  // 获取当前登录用户 ID（若未登录则为 null）
  const session = getSession(req);
  const userId = session?.userId || null;

  // 插入定制/反馈请求入库
  const insertRes = await dbClient.query(
    `INSERT INTO custom_report_requests (user_id, contact_email, request_type, payload, status)
     VALUES ($1, $2, $3, $4, 'pending')
     RETURNING id, request_type, status, created_at`,
    [userId, cleanEmail, requestType, JSON.stringify(payload)]
  );

  const newRecord = insertRes.rows[0];

  return res.status(200).json({
    success: true,
    message: '需求已提交！AI 智能体已接单，完成后您将收到邮件通知。',
    request: newRecord
  });
}

export default withDb(customRequestHandler, {
  methods: ['POST'],
  requiredBody: ['requestType', 'contactEmail', 'payload']
});
