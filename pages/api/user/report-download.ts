import { NextApiRequest, NextApiResponse } from 'next';
import { PoolClient } from 'pg';
import { withDb } from '../../../lib/api-handler';
import { getSession } from '../../../lib/auth';
import { localizeReportHtml } from '../../../lib/localize-report-assets';

function buildStandaloneHtml(report: {
  title: string;
  category: string;
  market_region: string;
  summary: string;
  content_html: string;
  created_at: string;
}): string {
  const categoryLabel = report.category === 'customer' ? '买家/客户调研' : '品类/行业洞察';
  const region = report.market_region || '全球市场';
  const formattedDate = new Date(report.created_at || Date.now()).toLocaleDateString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  });

  const localizedContent = localizeReportHtml(report.content_html) || '<p>暂无内容</p>';

  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${report.title} - GlobalTradeBuddy 出海深度研报</title>
  <style>
    :root {
      --bg: #090d16;
      --card-bg: #111827;
      --border: #1f293d;
      --text-main: #f3f4f6;
      --text-muted: #9ca3af;
      --primary: #3b82f6;
      --primary-light: #60a5fa;
      --accent: #10b981;
      --accent-bg: rgba(16, 185, 129, 0.1);
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      background-color: var(--bg);
      color: var(--text-main);
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
      line-height: 1.75;
      padding: 40px 20px;
    }
    .report-container {
      max-width: 900px;
      margin: 0 auto;
      background: var(--card-bg);
      border: 1px solid var(--border);
      border-radius: 16px;
      padding: 48px;
      box-shadow: 0 20px 40px rgba(0,0,0,0.5);
    }
    .header-tag {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 4px 12px;
      border-radius: 9999px;
      font-size: 13px;
      font-weight: 600;
      background: var(--accent-bg);
      color: var(--accent);
      border: 1px solid rgba(16, 185, 129, 0.25);
      margin-bottom: 16px;
    }
    h1.report-title {
      font-size: 30px;
      font-weight: 800;
      line-height: 1.35;
      color: #ffffff;
      margin-bottom: 16px;
    }
    .meta-bar {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 16px;
      font-size: 14px;
      color: var(--text-muted);
      padding-bottom: 24px;
      border-bottom: 1px solid var(--border);
      margin-bottom: 28px;
    }
    .summary-box {
      background: rgba(59, 130, 246, 0.08);
      border-left: 4px solid var(--primary);
      padding: 18px 22px;
      border-radius: 8px;
      margin-bottom: 36px;
      color: #e2e8f0;
      font-size: 15px;
    }
    .summary-title {
      font-weight: 700;
      color: var(--primary-light);
      margin-bottom: 6px;
      display: flex;
      align-items: center;
      gap: 6px;
    }
    .report-body {
      font-size: 16px;
      color: #d1d5db;
    }
    .report-body h2 {
      font-size: 22px;
      color: #f9fafb;
      margin: 36px 0 16px 0;
      padding-bottom: 8px;
      border-bottom: 1px solid rgba(255,255,255,0.08);
    }
    .report-body h3 {
      font-size: 18px;
      color: #e5e7eb;
      margin: 24px 0 12px 0;
    }
    .report-body p { margin-bottom: 16px; }
    .report-body ul, .report-body ol { margin: 12px 0 18px 24px; }
    .report-body li { margin-bottom: 8px; }
    .report-body img {
      max-width: 100%;
      height: auto;
      border-radius: 10px;
      margin: 20px 0;
      border: 1px solid var(--border);
    }
    .report-body table {
      width: 100%;
      border-collapse: collapse;
      margin: 24px 0;
    }
    .report-body th, .report-body td {
      border: 1px solid var(--border);
      padding: 10px 14px;
      text-align: left;
    }
    .report-body th {
      background: rgba(255,255,255,0.04);
      color: #f3f4f6;
    }
    .footer-watermark {
      margin-top: 50px;
      padding-top: 24px;
      border-top: 1px solid var(--border);
      text-align: center;
      font-size: 13px;
      color: var(--text-muted);
    }
    @media print {
      body { background: #ffffff; color: #111827; padding: 0; }
      .report-container { box-shadow: none; border: none; padding: 0; max-width: 100%; }
      h1.report-title { color: #111827; }
      .summary-box { background: #f3f4f6; color: #1f2937; border-left-color: #2563eb; }
      .report-body { color: #1f2937; }
    }
  </style>
</head>
<body>
  <div class="report-container">
    <div class="header-tag">🌐 ${region} · ${categoryLabel}</div>
    <h1 class="report-title">${report.title}</h1>
    <div class="meta-bar">
      <span>📅 报告收录：${formattedDate}</span>
      <span>🏷️ 类别：${categoryLabel}</span>
      <span>🌍 区域：${region}</span>
    </div>

    ${report.summary ? `
    <div class="summary-box">
      <div class="summary-title">💡 报告战略摘要</div>
      <div>${report.summary}</div>
    </div>` : ''}

    <div class="report-body">
      ${localizedContent}
    </div>

    <div class="footer-watermark">
      本文档由 GlobalTradeBuddy (https://marketgraphic.cn) 导出生成 · 专属于外贸出海决策的战略情报助手
    </div>
  </div>
</body>
</html>`;
}

async function reportDownloadHandler(req: NextApiRequest, res: NextApiResponse, dbClient: PoolClient) {
  if (req.method !== 'GET' && req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const session = getSession(req);
  if (!session) {
    return res.status(401).json({ error: '未登录，请先登录后操作' });
  }

  const userId = session.userId;
  const userRole = session.role;
  const reportId = (req.query.reportId || req.body?.reportId) as string;

  if (!reportId) {
    return res.status(400).json({ error: '缺少 reportId 参数' });
  }

  // 1. 查询报告详情
  const reportRes = await dbClient.query(
    'SELECT id, title, category, market_region, summary, content_html, created_at FROM reports WHERE id = $1',
    [reportId]
  );

  if (reportRes.rows.length === 0) {
    return res.status(404).json({ error: '报告不存在' });
  }

  const report = reportRes.rows[0];

  // 2. 权限校验：如果是管理员，免扣额度免限制下载
  if (userRole !== 'admin') {
    // 检查是否已在线解锁
    const unlockCheck = await dbClient.query(
      'SELECT 1 FROM unlocks WHERE user_id = $1 AND report_id = $2',
      [userId, reportId]
    );

    if (unlockCheck.rows.length === 0) {
      return res.status(403).json({ error: '请先在线解锁该报告后方可下载离线版本' });
    }

    // 检查并扣除下载额度
    await dbClient.query('BEGIN');
    const userRes = await dbClient.query(
      'SELECT download_quota FROM users WHERE id = $1 FOR UPDATE',
      [userId]
    );

    if (userRes.rows.length === 0) {
      await dbClient.query('ROLLBACK');
      return res.status(404).json({ error: '用户不存在' });
    }

    const downloadQuota = userRes.rows[0].download_quota ?? 0;
    if (downloadQuota <= 0) {
      await dbClient.query('ROLLBACK');
      return res.status(400).json({ error: '您的离线 HTML 报告下载额度已用尽，邀请好友注册或升级 Pro 可获赠更多额度' });
    }

    // 扣减 1 次下载额度
    await dbClient.query(
      'UPDATE users SET download_quota = download_quota - 1 WHERE id = $1',
      [userId]
    );
    await dbClient.query('COMMIT');
  }

  // 3. 构建高保真独立 HTML
  const standaloneHtml = buildStandaloneHtml(report);

  // 4. 设置附件下载响应头
  const sanitizedTitle = (report.title || 'GTB_Report').replace(/[\/\\:*?"<>|]/g, '_').trim();
  const encodedFilename = encodeURIComponent(sanitizedTitle) + '.html';

  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${encodedFilename}"; filename*=UTF-8''${encodedFilename}`);
  return res.status(200).send(standaloneHtml);
}

export default withDb(reportDownloadHandler, {
  methods: ['GET', 'POST']
});
