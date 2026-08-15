#!/usr/bin/env node
// ============================================================================
// Agent 自主求报接单与轮询运行器 (bin/agent-poll-custom-requests.js)
// ----------------------------------------------------------------------------
// 逻辑：
// 1. 定时调用 GET /api/agent/custom-requests 获取 pending 状态的用户研报定制请求。
// 2. 拿取任务后，PATCH 更新状态为 processing (AI 接单中)。
// 3. 提取结构化参数 (渠道/产品名/目标公司/官网/目标市场)，精准唤醒对应的技能逻辑。
// 4. 报告自动化上传成功后，PATCH 更新状态为 completed 并写入 report_id。
// 5. 自动触发后端向用户发送邮件通知。
// ============================================================================

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const API_BASE = process.env.GTB_API_URL || 'http://124.222.201.143:3000';
const AGENT_KEY = process.env.AGENT_API_KEY || 'automation_agent_secret';
const POLL_INTERVAL_MS = 60 * 1000; // 每 60 秒轮询一次

async function pollOnce() {
  try {
    const fetchUrl = `${API_BASE}/api/agent/custom-requests?agent_key=${encodeURIComponent(AGENT_KEY)}&limit=3`;
    const res = await fetch(fetchUrl);
    if (!res.ok) {
      console.error(`[Agent Poll] HTTP 错误: ${res.status}`);
      return;
    }
    const data = await res.json();
    if (!data.success || !Array.isArray(data.requests) || data.requests.length === 0) {
      // 暂无待处理任务
      return;
    }

    console.log(`\n==================================================`);
    console.log(`[Agent Poll] 🚀 发现 ${data.requests.length} 条待处理的用户定制研报需求！`);
    console.log(`==================================================`);

    for (const reqItem of data.requests) {
      console.log(`\n[Agent Poll] 正在接单处理 Task ID: ${reqItem.id} | 类型: ${reqItem.request_type} | 邮箱: ${reqItem.contact_email}`);

      // 1. 更新状态为 processing
      await updateStatus(reqItem.id, 'processing');

      // 2. 提取结构化参数
      const payload = reqItem.payload || {};
      console.log(`[Agent Poll] 结构化入参对齐:`, JSON.stringify(payload, null, 2));

      if (reqItem.request_type === 'category_insight') {
        console.log(`[Agent Poll] 准备触发 [category-insight] 技能...`);
        console.log(`  - 目标渠道: ${payload.channel}`);
        console.log(`  - 具体产品: ${payload.productName}`);
        console.log(`  - 目标市场: ${payload.marketRegion}`);
      } else if (reqItem.request_type === 'company_insight') {
        console.log(`[Agent Poll] 准备触发 [company-insight-pro] 技能...`);
        console.log(`  - 目标公司: ${payload.companyName}`);
        console.log(`  - 官网地址: ${payload.companyUrl}`);
        console.log(`  - 目标市场: ${payload.marketRegion}`);
      } else if (reqItem.request_type === 'feedback') {
        console.log(`[Agent Poll] 收到平台改进意见: [${payload.category}] ${payload.content}`);
        // 意见类直接标记为已归档
        await updateStatus(reqItem.id, 'completed');
        continue;
      }

      // 注意：真实场景中在命令行由 Agent 调用对应技能生成文章并获取 uploadReportId
      // 这里提供自动接入的框架接口
    }
  } catch (err) {
    console.error(`[Agent Poll] 轮询网络异常:`, err.message);
  }
}

async function verifyReportOnline(reportId) {
  try {
    const checkUrl = `${API_BASE}/reports/${reportId}`;
    const res = await fetch(checkUrl);
    if (res.status === 200) {
      console.log(`[Agent Poll] ✅ 线上报告探活校验成功 (HTTP 200 OK): ${checkUrl}`);
      return true;
    }
    console.error(`[Agent Poll] ❌ 线上报告探活失败 (HTTP ${res.status}): ${checkUrl}`);
    return false;
  } catch (err) {
    console.error(`[Agent Poll] ❌ 探活网络异常:`, err.message);
    return false;
  }
}

async function updateStatus(id, status, reportId = null) {
  if (status === 'completed' && reportId) {
    console.log(`[Agent Poll] 🔍 正在对生成的 Report ID (${reportId}) 执行上线前探活校验...`);
    const isOnline = await verifyReportOnline(reportId);
    if (!isOnline) {
      console.error(`[Agent Poll] ⛔ 阻断更新：Report ID (${reportId}) 无法通过 HTTP 200 探活，拒绝触发完成通知邮件！`);
      return false;
    }
  }

  try {
    const res = await fetch(`${API_BASE}/api/agent/custom-requests`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'x-agent-key': AGENT_KEY
      },
      body: JSON.stringify({
        id,
        status,
        reportId
      })
    });
    const data = await res.json();
    if (res.ok && data.success) {
      console.log(`[Agent Poll] 🎉 状态成功更新为: ${status}${reportId ? ` (Report ID: ${reportId})` : ''}`);
      return true;
    } else {
      console.error(`[Agent Poll] ❌ 更新状态失败:`, data.error);
      return false;
    }
  } catch (err) {
    console.error(`[Agent Poll] 更新状态请求异常:`, err.message);
    return false;
  }
}

// 启动主轮询循环
console.log(`🤖 GlobalTradeBuddy Agent 自主研报接单服务已启动 (目标: ${API_BASE})`);
console.log(`⏱️ 轮询间隔: ${POLL_INTERVAL_MS / 1000} 秒...`);

pollOnce();
setInterval(pollOnce, POLL_INTERVAL_MS);
