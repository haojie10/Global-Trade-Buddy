const fs = require('fs');
const path = require('path');

const API_BASE = 'http://124.222.201.143:3000';
const AGENT_KEY = 'automation_agent_secret';
const TASK_ID = '9525d763-6d1d-44a0-816e-8cc513c7fc7c';

async function main() {
  try {
    const htmlPath = path.join(__dirname, 'action_germany_cotton_slippers_report.html');
    const htmlContent = fs.readFileSync(htmlPath, 'utf8');

    console.log('1. 正在将 HTML 研报发布到 GlobalTradeBuddy 线上平台...');
    const pubRes = await fetch(`${API_BASE}/api/agent/publish`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-agent-key': AGENT_KEY
      },
      body: JSON.stringify({
        title: 'Action 德国市场棉拖鞋品类调研与研发建议',
        htmlContent,
        metadata: {
          category: 'product',
          summary: '针对欧洲折价零售巨头 Action 德国市场棉拖鞋（Hausschuhe）品类的深度调研报告。涵盖 €1.99-€4.99 价格带横向对比、材料与供应链穿透分析，并提供 3 项低成本研发升级建议。',
          company_name: 'Action Retail Netherlands B.V.',
          company_aliases: 'Action, Action Deutschland',
          company_website: 'www.action.com',
          competitors: 'Action, Deichmann, Kik, Primark',
          products: '棉拖鞋, 保暖家居鞋, 室内拖鞋',
          regions: '德国, 欧洲',
          channels: 'Action'
        }
      })
    });

    const pubData = await pubRes.json();
    if (!pubRes.ok || !pubData.success) {
      console.error('发布失败:', pubData.error);
      return;
    }

    const reportId = pubData.reportId || pubData.id;
    console.log('✅ 研报已成功发布至平台！Report ID:', reportId);

    console.log('2. 正在更新 Task 状态为 completed，并向 838048181@qq.com 发送完成通知邮件...');
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
      console.error('更新 Task 失败:', patchData.error);
    }
  } catch (err) {
    console.error('执行异常:', err.message);
  }
}

main();
