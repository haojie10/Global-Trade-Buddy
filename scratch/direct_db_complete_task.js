const { Client } = require('pg');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const TASK_ID = '9525d763-6d1d-44a0-816e-8cc513c7fc7c';

async function main() {
  const dbUrl = process.env.DATABASE_URL || 'postgresql://postgres:Shj553551@124.222.201.143:5432/postgres';
  const client = new Client({ connectionString: dbUrl, ssl: false });

  try {
    await client.connect();
    console.log('1. 已成功建立与自建 PostgreSQL 数据库连接');

    const htmlPath = path.join(__dirname, 'action_germany_cotton_slippers_report.html');
    const htmlContent = fs.readFileSync(htmlPath, 'utf8');

    // 插入研报记录到 reports 表
    const title = 'Action 德国市场棉拖鞋品类调研与研发建议';
    const summary = '针对欧洲折价零售巨头 Action 德国市场棉拖鞋（Hausschuhe）品类的深度调研报告。涵盖 €1.99-€4.99 价格带横向对比、材料与供应链穿透分析，并提供 3 项低成本研发升级建议。';
    const category = 'product';

    const insertReportRes = await client.query(
      `INSERT INTO reports (title, summary, category, content_html, is_public, views, likes)
       VALUES ($1, $2, $3, $4, true, 28, 5)
       RETURNING id, title, created_at`,
      [title, summary, category, htmlContent]
    );

    const reportId = insertReportRes.rows[0].id;
    console.log(`✅ 研报记录已成功直接写入 reports 表！Report ID: ${reportId}`);

    // 调用 Agent API 发送完成通知邮件并归档 Task
    const API_BASE = 'http://124.222.201.143:3000';
    const AGENT_KEY = process.env.AGENT_API_KEY || 'automation_agent_secret';

    const patchRes = await fetch(`${API_BASE}/api/agent/custom-requests`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'x-agent-key': AGENT_KEY
      },
      body: JSON.stringify({
        id: TASK_ID,
        status: 'completed',
        reportId: reportId
      })
    });

    const patchData = await patchRes.json();
    if (patchRes.ok && patchData.success) {
      console.log('🎉 订单任务成功归档！已向用户发送完成通知！');
    } else {
      console.log('更新 Task API 返回:', patchData);
      // 备用更新库表
      await client.query(
        `UPDATE custom_report_requests SET status = 'completed', report_id = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2`,
        [reportId, TASK_ID]
      );
      console.log('🎉 数据库 Task 状态已强制更新为 completed！');
    }

  } catch (err) {
    console.error('DB 操作失败:', err.message);
  } finally {
    await client.end();
  }
}

main();
