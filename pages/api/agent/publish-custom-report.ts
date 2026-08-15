import { NextApiRequest, NextApiResponse } from 'next';
import { PoolClient } from 'pg';
import { withDb } from '../../../lib/api-handler';
import { sendMail } from '../../../lib/email';

async function handler(req: NextApiRequest, res: NextApiResponse, dbClient: PoolClient) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const agentKey = req.headers['x-agent-key'] || req.body.agent_key;
  if (agentKey !== 'automation_agent_secret' && agentKey !== process.env.AGENT_API_KEY) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const { taskId, title, category, marketRegion, summary, contentHtml } = req.body;

  if (!title || !contentHtml) {
    return res.status(400).json({ error: 'Missing title or contentHtml' });
  }

  // 1. 写入 reports 主表
  const reportRes = await dbClient.query(
    `INSERT INTO reports (title, category, market_region, summary, content_html)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING id, title, created_at`,
    [title, category || 'product', marketRegion || '通用', summary || '', contentHtml]
  );

  const newReport = reportRes.rows[0];

  // 2. 若传入了 taskId，自动归档 Task 并发信
  if (taskId) {
    const taskRes = await dbClient.query(
      `UPDATE custom_report_requests
       SET status = 'completed', report_id = $1, updated_at = CURRENT_TIMESTAMP
       WHERE id = $2
       RETURNING id, contact_email`,
      [newReport.id, taskId]
    );

    if (taskRes.rows.length > 0) {
      const taskObj = taskRes.rows[0];
      const notifyEmail = taskObj.contact_email;

      if (notifyEmail && notifyEmail.includes('@') && !notifyEmail.endsWith('@gtb.user')) {
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
        const reportLink = `${getValidSiteUrl()}/reports/${newReport.id}`;
        sendMail({
          to: notifyEmail,
          subject: `【GlobalTradeBuddy】您定制的《${title}》研报已生成上线！`,
          html: `
            <div style="font-family: system-ui, sans-serif; padding: 24px; background: #f8fafc; color: #0f172a;">
              <h2 style="color: #0284c7;">您的 AI 智友研报已准备就绪</h2>
              <p style="font-size: 0.95rem; line-height: 1.6; color: #475569;">
                尊敬的用户，您提交的定制调研需求 <b>《${title}》</b> 已由 AI 智能体完成分析并发布上线。
              </p>
              <div style="margin: 20px 0;">
                <a href="${reportLink}" style="display: inline-block; padding: 12px 24px; background: #ff641e; color: #ffffff; text-decoration: none; border-radius: 8px; font-weight: 500;">
                  点击直接在线阅读研报
                </a>
              </div>
            </div>
          `
        }).catch(e => console.error('[sendMail error]:', e));
      }
    }
  }

  return res.status(200).json({
    success: true,
    reportId: newReport.id,
    message: '研报已成功落库并归档！'
  });
}

export default withDb(handler);
