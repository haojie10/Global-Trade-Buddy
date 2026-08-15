import { NextApiRequest, NextApiResponse } from 'next';
import { PoolClient } from 'pg';
import { withDb } from '../../../lib/api-handler';
import { sendMail } from '../../../lib/email';

const AGENT_SECRET = process.env.AGENT_API_KEY || 'automation_agent_secret';

async function agentCustomRequestsHandler(
  req: NextApiRequest,
  res: NextApiResponse,
  dbClient: PoolClient
) {
  // 简单的 Agent 秘钥校验（HTTP Header 或 Query）
  const authKey = req.headers['x-agent-key'] || req.query.agent_key;
  if (authKey !== AGENT_SECRET) {
    return res.status(401).json({ error: '未授权的 Agent 客户端访问' });
  }

  if (req.method === 'GET') {
    // 拉取等待处理的任务（默认拉取最先提交的 5 条）
    const limit = parseInt((req.query.limit as string) || '5', 10);
    const result = await dbClient.query(
      `SELECT id, user_id, contact_email, request_type, payload, status, created_at
       FROM custom_report_requests
       WHERE status = 'pending'
       ORDER BY created_at ASC
       LIMIT $1`,
      [limit]
    );

    return res.status(200).json({
      success: true,
      requests: result.rows
    });
  }

  if (req.method === 'PATCH') {
    const { id, status, reportId, errorMessage } = req.body;
    if (!id || !status) {
      return res.status(400).json({ error: '缺失必备参数 id 或 status' });
    }

    const validStatuses = ['pending', 'processing', 'completed', 'failed'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ error: '不合法的状态值' });
    }

    // 1. 先检索当前任务信息
    const curRecordRes = await dbClient.query(
      'SELECT id, request_type, report_id, contact_email FROM custom_report_requests WHERE id = $1',
      [id]
    );
    if (curRecordRes.rows.length === 0) {
      return res.status(404).json({ error: '未找到指定 ID 的定制请求' });
    }
    const curRecord = curRecordRes.rows[0];
    const targetReportId = reportId || curRecord.report_id;

    // 2. 🛡️ 强制防错拦截：研报类任务若标记为 completed，必须提供且存在于 reports 表中
    if (status === 'completed' && curRecord.request_type !== 'feedback') {
      if (!targetReportId) {
        return res.status(400).json({ error: '研报类定制任务标记 completed 时必须提供有效的 reportId' });
      }
      const checkReport = await dbClient.query('SELECT id FROM reports WHERE id = $1', [targetReportId]);
      if (checkReport.rows.length === 0) {
        return res.status(400).json({
          error: `指定的 reportId (${targetReportId}) 在数据库 reports 表中不存在，拒绝标记为已完成并阻断失效邮件发送`
        });
      }
    }

    const updateRes = await dbClient.query(
      `UPDATE custom_report_requests
       SET status = $1,
           report_id = COALESCE($2, report_id),
           updated_at = NOW()
       WHERE id = $3
       RETURNING id, contact_email, request_type, payload, status, report_id`,
      [status, reportId || null, id]
    );

    const updatedRecord = updateRes.rows[0];

    // 如果状态更新为 completed 且提供了 report_id，自动给用户发送通知邮件
    if (status === 'completed' && updatedRecord.contact_email && updatedRecord.report_id) {
      try {
        const payloadObj = updatedRecord.payload || {};
        let reportTitle = 'AI 调研报告';
        if (updatedRecord.request_type === 'category_insight') {
          reportTitle = `《${payloadObj.channel || ''} ${payloadObj.productName || ''} 品类洞察报告》`;
        } else if (updatedRecord.request_type === 'company_insight') {
          reportTitle = `《${payloadObj.companyName || ''} 企业战略情报洞察报告》`;
        }

        const getValidSiteUrl = (): string => {
          const envUrl = process.env.GTB_API_URL || process.env.NEXT_PUBLIC_SITE_URL || '';
          if (
            envUrl &&
            !envUrl.includes('edgeone') &&
            !envUrl.includes('vercel') &&
            !envUrl.includes('tcb.qcloud.la') &&
            !envUrl.includes('cloudbase')
          ) {
            return envUrl.replace(/\/+$/, '');
          }
          return 'https://marketgraphic.cn';
        };

        const siteUrl = getValidSiteUrl();
        const reportUrl = `${siteUrl}/reports/${updatedRecord.report_id}`;

        const emailSubject = `【GlobalTradeBuddy】您订购的 ${reportTitle} 已生成完毕！`;
        const emailHtml = `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 12px; background: #ffffff;">
            <h2 style="color: #0f172a; margin-bottom: 16px;">🎉 您好，您定制的 AI 研报已全自动生成完毕！</h2>
            <p style="color: #475569; font-size: 15px; line-height: 1.6;">
              您此前提交的定制调研需求：<strong>${reportTitle}</strong> 已经由平台的 AI 智能体通过自动化技能深度生成并成功上传发布。
            </p>
            <div style="margin: 28px 0; text-align: center;">
              <a href="${reportUrl}" style="background: #2563eb; color: #ffffff; padding: 14px 28px; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 16px; display: inline-block;">
                查看完整研报详情 ➔
              </a>
            </div>
            <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 24px 0;" />
            <p style="color: #94a3b8; font-size: 13px; text-align: center;">
              GlobalTradeBuddy 出海贸易洞察平台 · 自动化 Agent 机器人发送
            </p>
          </div>
        `;

        await sendMail({
          to: updatedRecord.contact_email,
          subject: emailSubject,
          html: emailHtml
        });
        console.log(`[agent-custom-requests] 已成功发送研报完成邮件给: ${updatedRecord.contact_email}`);
      } catch (emailErr) {
        console.error('[agent-custom-requests] 发送完成邮件失败:', emailErr);
      }
    }

    return res.status(200).json({
      success: true,
      request: updatedRecord
    });
  }

  return res.status(405).json({ error: 'Method Not Allowed' });
}

export default withDb(agentCustomRequestsHandler, {
  methods: ['GET', 'PATCH']
});
