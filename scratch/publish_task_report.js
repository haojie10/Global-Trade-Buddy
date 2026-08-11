const fs = require('fs');
const path = require('path');

const API_BASE = 'http://124.222.201.143:3000';
const TASK_ID = '9525d763-6d1d-44a0-816e-8cc513c7fc7c';
const AGENT_KEY = 'automation_agent_secret';

async function main() {
  const htmlPath = path.join(__dirname, 'action_germany_cotton_slippers_report.html');
  const htmlContent = fs.readFileSync(htmlPath, 'utf8');

  console.log('1. 正在将《Action 德国市场棉拖鞋品类调研与研发建议》正确以 report 类型发布至 GlobalTradeBuddy 平台...');
  
  const pubRes = await fetch(`${API_BASE}/api/agent/publish`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${AGENT_KEY}`,
      'x-agent-key': AGENT_KEY
    },
    body: JSON.stringify({
      type: 'report', // 必须显式声明为 report 研报类型
      title: 'Action 德国市场棉拖鞋品类调研与研发建议',
      contentHtml: htmlContent,
      summary: '针对欧洲折价零售巨头 Action 德国市场棉拖鞋（Hausschuhe）品类的深度调研报告。涵盖 €1.99-€4.99 价格带横向对比、材料与供应链穿透分析，并提供 3 项低成本研发升级建议。',
      category: 'product',
      country: '德国',
      region: '欧洲',
      tags: ['Action', '棉拖鞋', '德国', '品类洞察']
    })
  });

  const pubData = await pubRes.json();
  if (pubRes.ok && pubData.success) {
    const reportId = pubData.reportId || pubData.id;
    console.log(`🎉 研报已成功以 report 类型发布上线！Report ID: ${reportId}`);

    console.log('2. 正在更新 Task 状态为 completed...');
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
      console.log('✉️ Task 状态已更新并同步！');
    } else {
      console.error('Task 状态更新失败:', patchData);
    }
  } else {
    console.error('发布失败:', pubData);
  }
}

main();
