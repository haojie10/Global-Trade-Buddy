import { NextApiRequest, NextApiResponse } from 'next';
import { PoolClient } from 'pg';
import { withDb } from '../../../../lib/api-handler';
import { requireAdmin } from '../../../../lib/auth';
import { sendMail } from '../../../../lib/email';

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

    const page = Math.max(1, parseInt((req.query.page as string) || '1', 10));
    const pageSize = Math.max(1, Math.min(100, parseInt((req.query.pageSize as string) || '20', 10)));
    const offset = (page - 1) * pageSize;

    // 查询当前筛选条件下的总记录数
    const countRes = await dbClient.query(`
      SELECT COUNT(*) as filtered_total
      FROM custom_report_requests r
      LEFT JOIN users u ON r.user_id = u.id
      ${whereSql}
    `, params);
    const filteredTotal = parseInt(countRes.rows[0]?.filtered_total || '0', 10);

    // 查询列表
    const listParams = [...params, pageSize, offset];
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
      LEFT JOIN reports rep ON r.report_id::text = rep.id::text
      ${whereSql}
      ORDER BY r.created_at DESC
      LIMIT $${pIndex} OFFSET $${pIndex + 1}
    `, listParams);

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
      pagination: {
        page,
        pageSize,
        total: filteredTotal,
        totalPages: Math.ceil(filteredTotal / pageSize) || 1
      },
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

    const updatedRecord = updateRes.rows[0];

    // 如果状态更新为 completed 且提供了有效 report_id，自动给定制用户发送上线通知邮件
    if (status === 'completed' && updatedRecord.contact_email && updatedRecord.report_id) {
      try {
        const payloadObj = updatedRecord.payload || {};
        let reportTitle = 'AI 调研报告';
        if (updatedRecord.request_type === 'category_insight') {
          const channel = payloadObj.target_channel || payloadObj.channel || '';
          const product = payloadObj.product_name || payloadObj.productName || '';
          reportTitle = `《${channel} ${product} 品类洞察报告》`;
        } else if (updatedRecord.request_type === 'company_insight') {
          const company = payloadObj.company_name || payloadObj.companyName || '';
          reportTitle = `《${company} 企业战略情报洞察报告》`;
        }

        const siteUrl = 'https://marketgraphic.cn';
        const reportUrl = `${siteUrl}/reports/${updatedRecord.report_id}`;

        const emailSubject = `【GlobalTradeBuddy】您定制的 ${reportTitle} 已完成并上线！`;
        const emailHtml = `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 12px; background: #ffffff;">
            <h2 style="color: #0f172a; margin-bottom: 16px;">🎉 您好，您定制的 AI 研报已完成！</h2>
            <p style="color: #475569; font-size: 15px; line-height: 1.6;">
              您此前在 GlobalTradeBuddy 平台提交的定制研报需求：<strong>${reportTitle}</strong> 已经由管理员跟进生成完毕并正式上线。
            </p>
            <div style="margin: 28px 0; text-align: center;">
              <a href="${reportUrl}" style="background: #2563eb; color: #ffffff; padding: 14px 28px; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 16px; display: inline-block;">
                查看完整研报详情 ➔
              </a>
            </div>
            <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 24px 0;" />
            <p style="color: #94a3b8; font-size: 13px; text-align: center;">
              GlobalTradeBuddy 出海贸易洞察平台
            </p>
          </div>
        `;

        await sendMail({
          to: updatedRecord.contact_email,
          subject: emailSubject,
          html: emailHtml
        });
        console.log(`[admin/requests] 已发送研报完成邮件给: ${updatedRecord.contact_email}`);
      } catch (emailErr) {
        console.error('[admin/requests] 发送完成通知邮件失败:', emailErr);
      }
    }

    return res.status(200).json({
      success: true,
      request: updatedRecord
    });
  }

  return res.status(405).json({ error: 'Method Not Allowed' });
}

export default withDb(requestsHandler, {
  methods: ['GET', 'PATCH']
});
