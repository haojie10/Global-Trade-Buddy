const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const nodemailer = require('nodemailer');

const host = process.env.SMTP_HOST;
const port = process.env.SMTP_PORT ? parseInt(process.env.SMTP_PORT) : 465;
const user = process.env.SMTP_USER;
const pass = process.env.SMTP_PASS;

const transporter = nodemailer.createTransport({
  host,
  port,
  secure: port === 465,
  auth: { user, pass }
});

async function sendCorrectedEmails() {
  const targetEmail = '838048181@qq.com';
  const siteUrl = 'http://124.222.201.143:3000';

  const reports = [
    {
      title: '《Liverpool 电饭锅 品类洞察报告》',
      url: `${siteUrl}/reports/ffa7f3d4-e008-45e4-9e0c-a95cf785b3b0`,
      id: 'ffa7f3d4-e008-45e4-9e0c-a95cf785b3b0',
      type: '品类洞察'
    },
    {
      title: '《El Puerto de Liverpool 企业战略情报洞察报告》',
      url: `${siteUrl}/reports/72ade430-7446-42ef-ac8b-970da31bb25e`,
      id: '72ade430-7446-42ef-ac8b-970da31bb25e',
      type: '企业洞察'
    }
  ];

  for (const rep of reports) {
    const emailSubject = `【GlobalTradeBuddy】您订购的 ${rep.title} 正确查阅链接`;
    const emailHtml = `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 12px; background: #ffffff;">
        <div style="margin-bottom: 20px; border-bottom: 2px solid #ff641e; padding-bottom: 12px;">
          <h2 style="color: #0f172a; margin: 0 0 6px 0; font-size: 20px;">🎉 您定制的 AI 研报已更新正确查阅链接！</h2>
          <span style="font-size: 12px; color: #ff641e; font-weight: bold; background: #fff7ed; padding: 2px 8px; border-radius: 4px;">${rep.type}</span>
        </div>
        <p style="color: #475569; font-size: 15px; line-height: 1.6;">
          您此前提交的定制调研需求：<strong>${rep.title}</strong> 已经由平台的 AI 智能体完成深度生成并已上线生产服务器。
        </p>
        <div style="margin: 28px 0; text-align: center;">
          <a href="${rep.url}" style="background: #ff641e; color: #ffffff; padding: 14px 28px; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 16px; display: inline-block; box-shadow: 0 4px 12px rgba(255, 100, 30, 0.2);">
            点击直接在线查看完整研报 ➔
          </a>
        </div>
        <div style="background: #f8fafc; padding: 12px 16px; border-radius: 8px; font-size: 13px; color: #64748b; margin-top: 20px;">
          <strong>直接访问链接：</strong><br/>
          <a href="${rep.url}" style="color: #2563eb; word-break: break-all;">${rep.url}</a>
        </div>
        <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 24px 0;" />
        <p style="color: #94a3b8; font-size: 12px; text-align: center; margin: 0;">
          GlobalTradeBuddy 出海贸易洞察平台 · 生产服务器自动发送
        </p>
      </div>
    `;

    console.log(`正在发送修正邮件至 ${targetEmail} (${rep.title})...`);
    await transporter.sendMail({
      from: `"GlobalTradeBuddy 外贸智友" <${user}>`,
      to: targetEmail,
      subject: emailSubject,
      html: emailHtml
    });
    console.log(`✅ 成功发送至 ${targetEmail}: ${rep.title}`);
  }
}

sendCorrectedEmails().catch(console.error);
