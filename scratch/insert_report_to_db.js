const { Client } = require('pg');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const TASK_ID = '9525d763-6d1d-44a0-816e-8cc513c7fc7c';

async function main() {
  const dbUrl = process.env.DATABASE_URL || 'postgresql://postgres:Shj553551@124.222.201.143:5432/postgres';
  const client = new Client({ connectionString: dbUrl, ssl: false, connectionTimeoutMillis: 10000 });

  try {
    await client.connect();
    console.log('1. 成功建立数据库连接...');

    const htmlPath = path.join(__dirname, 'action_germany_cotton_slippers_report.html');
    const htmlContent = fs.readFileSync(htmlPath, 'utf8');

    const title = 'Action 德国市场棉拖鞋品类调研与研发建议';
    const summary = '针对欧洲折价零售巨头 Action 德国市场棉拖鞋（Hausschuhe）品类的深度调研报告。涵盖 €1.99-€4.99 价格带横向对比、材料与供应链穿透分析，并提供 3 项低成本研发升级建议。';
    
    // 写入 reports 表
    const res = await client.query(
      `INSERT INTO reports (title, category, market_region, summary, content_html)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, title, created_at`,
      [title, 'product', '德国', summary, htmlContent]
    );

    const reportId = res.rows[0].id;
    console.log(`🎉 研报记录已成功落入 reports 主表！Report ID: ${reportId}`);

    // 更新 custom_report_requests 关联并归档
    await client.query(
      `UPDATE custom_report_requests
       SET status = 'completed', report_id = $1, updated_at = CURRENT_TIMESTAMP
       WHERE id = $2`,
      [reportId, TASK_ID]
    );

    console.log('✅ 定制需求 Task 已全自动更新为 completed 归档状态！');
  } catch (err) {
    console.error('DB 操作失败:', err);
  } finally {
    await client.end();
  }
}

main();
