const fs = require('fs');
const path = require('path');

const API_BASE = 'http://124.222.201.143:3000';
const TASK_ID = '3bff63bf-8bf8-48f3-ac33-4e721bfc41b2';
const AGENT_KEY = 'automation_agent_secret';

async function main() {
  const htmlPath = path.join(__dirname, 'liverpool-company-insight-report.html');
  const htmlContent = fs.readFileSync(htmlPath, 'utf8');

  console.log('1. 正在将《家用电器-El Puerto de Liverpool-墨西哥-企业洞察报告》发布至 GlobalTradeBuddy 平台...');
  
  const pubRes = await fetch(`${API_BASE}/api/agent/publish`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${AGENT_KEY}`,
      'x-agent-key': AGENT_KEY
    },
    body: JSON.stringify({
      type: 'report',
      title: '家用电器-El Puerto de Liverpool-墨西哥-企业洞察报告',
      contentHtml: htmlContent,
      summary: '墨西哥百年零售巨头 El Puerto de Liverpool (LIVEPOL) 360°企业战略情报洞察报告。深度穿透其2148亿比索营收、Liverpool中高端百货与Suburbia大众平价双业态、Haus等自有品牌矩阵、NOM认证与SMETA合规准入及中国供应商出海合作路径。',
      category: 'customer',
      country: '墨西哥',
      region: '墨西哥',
      industry: '家用电器',
      tags: ['家用电器', '餐厨器皿', '家居用品', '男女装', '箱包']
    })
  });

  const pubData = await pubRes.json();
  if (pubRes.ok && pubData.success) {
    const reportId = pubData.reportId || pubData.id;
    console.log(`🎉 研报已成功以 report 类型发布上线！Report ID: ${reportId}`);

    console.log('2. 正在更新 Task 状态为 completed 且写入 reportId...');
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
      console.log('✉️ Task 状态已更新并同步成功！邮件通知已发送。');
    } else {
      console.error('Task 状态更新失败:', patchData);
    }
  } else {
    console.error('发布失败:', pubData);
  }
}

main();
