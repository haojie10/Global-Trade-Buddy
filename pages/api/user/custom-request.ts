import { NextApiRequest, NextApiResponse } from 'next';
import { PoolClient } from 'pg';
import { withDb } from '../../../lib/api-handler';
import { getSession } from '../../../lib/auth';
import { sendMail } from '../../../lib/email';

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

  const requestType = (req.body.request_type || req.body.requestType || '').trim();
  const contactEmail = (req.body.user_email || req.body.contactEmail || '').trim();
  const payload = req.body.payload || {};

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
  let finalEmail = contactEmail;

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

  // 方案 A：即时向管理员邮箱发送邮件提醒
  const adminEmail = process.env.ADMIN_NOTIFICATION_EMAIL || process.env.SMTP_USER;
  if (adminEmail) {
    let typeTitle = '用户需求';
    let detailHtml = '';

    if (requestType === 'category_insight') {
      typeTitle = '【品类调研定制】';
      detailHtml = `
        <p style="margin: 6px 0;"><strong>目标销售渠道：</strong>${payload.target_channel || payload.channel || '未填写'}</p>
        <p style="margin: 6px 0;"><strong>具体产品品类：</strong>${payload.product_name || payload.productName || '未填写'}</p>
        <p style="margin: 6px 0;"><strong>目标国家市场：</strong>${payload.category_market || payload.market || '未填写'}</p>
      `;
    } else if (requestType === 'company_insight') {
      typeTitle = '【企业战略洞察定制】';
      detailHtml = `
        <p style="margin: 6px 0;"><strong>目标企业名称：</strong>${payload.company_name || payload.companyName || '未填写'}</p>
        <p style="margin: 6px 0;"><strong>企业官方网址：</strong>${payload.company_url || payload.companyUrl || '未提供'}</p>
        <p style="margin: 6px 0;"><strong>主要运营市场：</strong>${payload.company_market || payload.market || '未填写'}</p>
      `;
    } else {
      typeTitle = '【产品问题与建议反馈】';
      detailHtml = `
        <p style="margin: 6px 0;"><strong>反馈分类：</strong><span style="background: #f1f5f9; padding: 2px 8px; border-radius: 4px;">${payload.category || '通用建议'}</span></p>
        <p style="margin: 6px 0;"><strong>反馈详细内容：</strong></p>
        <div style="background: #ffffff; border: 1px solid #e2e8f0; padding: 12px; border-radius: 6px; white-space: pre-wrap; font-size: 14px; color: #334155;">${payload.content || '无具体内容'}</div>
      `;
    }

    const siteUrl = process.env.GTB_API_URL || process.env.NEXT_PUBLIC_SITE_URL || 'https://marketgraphic.cn';
    const adminManageUrl = `${siteUrl.replace(/\/+$/, '')}/admin/requests`;

    sendMail({
      to: adminEmail,
      subject: `【GTB 管理员提醒】收到新${typeTitle}`,
      html: `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 12px; background: #ffffff;">
          <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 16px;">
            <h2 style="color: #0f172a; margin: 0; font-size: 1.25rem;">🔔 收到新的${typeTitle}</h2>
          </div>
          <div style="background: #f8fafc; border-left: 4px solid #ff641e; padding: 16px 20px; margin: 18px 0; border-radius: 6px; font-size: 14px; line-height: 1.6;">
            ${detailHtml}
            <hr style="border: none; border-top: 1px dashed #cbd5e1; margin: 14px 0;" />
            <p style="margin: 4px 0; color: #64748b; font-size: 13px;">
              <strong>提交用户：</strong>${finalEmail}
            </p>
            <p style="margin: 4px 0; color: #64748b; font-size: 13px;">
              <strong>提交时间：</strong>${new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' })}
            </p>
          </div>
          <div style="margin: 24px 0; text-align: center;">
            <a href="${adminManageUrl}" style="background: #ff641e; color: #ffffff; padding: 12px 28px; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 14px; display: inline-block;">
              进入后台查看与处理 ➔
            </a>
          </div>
          <hr style="border: none; border-top: 1px solid #f1f5f9; margin: 20px 0;" />
          <p style="color: #94a3b8; font-size: 12px; text-align: center; margin: 0;">
            Market Graphic 外贸智友 · 系统自动化提醒
          </p>
        </div>
      `
    }).catch((mailErr) => {
      console.error('[custom-request] 管理员提醒邮件发送异常:', mailErr);
    });
  }

  return res.status(200).json({
    success: true,
    message: requestType === 'feedback'
      ? '感谢您的宝贵反馈！管理员已收到通知。'
      : '定制需求已提交！管理员与 AI 智能体已接单。',
    request: newRecord
  });
}

export default withDb(handler);
