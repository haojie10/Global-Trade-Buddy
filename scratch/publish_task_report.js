const fs = require('fs');
const path = require('path');

const API_BASE = 'http://124.222.201.143:3000';
const TASK_ID = '9525d763-6d1d-44a0-816e-8cc513c7fc7c';
const AGENT_KEY = 'automation_agent_secret';

async function main() {
  const htmlPath = path.join(__dirname, 'action_germany_cotton_slippers_report.html');
  const htmlContent = fs.readFileSync(htmlPath, 'utf8');

  console.log('1. 正在调用全新 publish-custom-report 接口发布《Action 德国市场棉拖鞋品类调研与研发建议》...');

  const pubRes = await fetch(`${API_BASE}/api/agent/publish-custom-report`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-agent-key': AGENT_KEY
    },
    body: JSON.stringify({
      taskId: TASK_ID,
      title: 'Action 德国市场棉拖鞋品类调研与研发建议',
      category: 'product',
      marketRegion: '德国',
      summary: '针对欧洲折价零售巨头 Action 德国市场棉拖鞋（Hausschuhe）品类的深度调研报告。涵盖 €1.99-€4.99 价格带横向对比、材料与供应链穿透分析，并提供 3 项低成本研发升级建议。',
      contentHtml: htmlContent
    })
  });

  const pubData = await pubRes.json();
  if (pubRes.ok && pubData.success) {
    console.log(`🎉 研报已成功落库并发布上线！Report ID: ${pubData.reportId}`);
    console.log('✉️ 研报完成通知邮件已成功投递至 838048181@qq.com！');
  } else {
    console.error('发布接口返回:', pubData);
  }
}

main();
