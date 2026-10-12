import { NextApiRequest, NextApiResponse } from 'next';
import { PoolClient } from 'pg';
import { withDb } from '../../../lib/api-handler';
import { getSession } from '../../../lib/auth';
import { localizeReportHtml } from '../../../lib/localize-report-assets';

export function buildStandaloneHtml(report: {
  title: string;
  category: string;
  market_region: string;
  summary: string;
  content_html: string;
  created_at: string;
}): string {
  const rawHtml = report.content_html || '';
  const isFullHtml = /<!DOCTYPE\s+html/i.test(rawHtml) || /<html\b/i.test(rawHtml);

  // 1. 若报告本身已是完整独立的 HTML 文档，直接保留其完整的原汁原味设计，绝不二次嵌套
  if (isFullHtml) {
    // 经过本地化保护：去除境外阻塞字体、注入 lucide 容错 shim 及图表重试逻辑
    let fullHtml = localizeReportHtml(rawHtml);

    // 关键修复：将 /vendor/ 相对根路径升级为绝对公网 HTTPS 路径，确保用户在本地以 file:/// 双击打开时资源 100% 成功加载
    fullHtml = fullHtml.replace(
      /(<script\b[^>]*?\bsrc=["'])\/vendor\//gi,
      '$1https://marketgraphic.cn/vendor/'
    );

    // 补全站内图片路径（若有）
    fullHtml = fullHtml.replace(
      /(<img\b[^>]*?\bsrc=["'])\/images\//gi,
      '$1https://marketgraphic.cn/images/'
    );

    // 优雅注入导出标识（保持与原文档和谐共存）
    const watermarkNote = `
<!-- Exported by GlobalTradeBuddy (https://marketgraphic.cn) -->
<div style="text-align: center; padding: 24px 0 16px 0; font-size: 12px; color: #7a756f; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
  本文档由 GlobalTradeBuddy (https://marketgraphic.cn) 导出生成 · 专属于外贸出海决策的战略情报助手
</div>
`;
    if (/<\/body>/i.test(fullHtml)) {
      fullHtml = fullHtml.replace(/<\/body>/i, `${watermarkNote}\n</body>`);
    } else {
      fullHtml += watermarkNote;
    }

    return fullHtml;
  }

  // 2. 若是片段 HTML（如测试数据或轻量内容），采用与平台视觉规范完全一致的「暖沙乳白底」模板包裹，杜绝暗黑冲突
  const categoryLabel = report.category === 'customer' ? '买家/客户调研' : '品类/行业洞察';
  const region = report.market_region || '全球市场';
  const formattedDate = new Date(report.created_at || Date.now()).toLocaleDateString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  });

  const localizedContent = localizeReportHtml(rawHtml);

  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${report.title} - GlobalTradeBuddy 出海深度研报</title>
  <script src="https://marketgraphic.cn/vendor/tailwind.min.js"></script>
  <script src="https://marketgraphic.cn/vendor/echarts.min.js"></script>
  <script src="https://marketgraphic.cn/vendor/lucide.min.js"></script>
  <script>
    window.lucide = window.lucide || { createIcons: function() {} };
  </script>
  <style>
    :root {
      --bg-main: #fdfbf7;
      --bg-sub: #f6f3ec;
      --color-accent: #ff641e;
      --color-text: #3c3935;
      --color-muted: #7a756f;
      --radius-card: 22px;
      --radius-sub: 16px;
      --shadow-default: 0 4px 12px rgba(160, 109, 68, 0.04);
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      background-color: var(--bg-main);
      color: var(--color-text);
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
      line-height: 1.65;
      padding: 30px 16px;
    }
    .report-wrapper {
      max-width: 1100px;
      margin: 0 auto;
    }
    .report-card {
      background: var(--bg-sub);
      border: 1px solid rgba(160, 109, 68, 0.08);
      border-radius: var(--radius-card);
      box-shadow: var(--shadow-default);
      padding: 36px;
      margin-bottom: 24px;
    }
    .header-tag {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 4px 12px;
      border-radius: 9999px;
      font-size: 13px;
      font-weight: 500;
      background: rgba(255, 100, 30, 0.08);
      color: var(--color-accent);
      border: 1px solid rgba(255, 100, 30, 0.2);
      margin-bottom: 14px;
    }
    h1.report-title {
      font-size: 26px;
      font-weight: 700;
      line-height: 1.35;
      color: var(--color-text);
      margin-bottom: 14px;
    }
    .meta-bar {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 16px;
      font-size: 13px;
      color: var(--color-muted);
      padding-bottom: 20px;
      border-bottom: 1px solid rgba(160, 109, 68, 0.08);
      margin-bottom: 24px;
    }
    .summary-box {
      background: #ffffff;
      border-left: 4px solid var(--color-accent);
      padding: 16px 20px;
      border-radius: 8px;
      margin-bottom: 28px;
      color: var(--color-text);
      font-size: 14.5px;
      border: 1px solid rgba(160, 109, 68, 0.06);
    }
    .summary-title {
      font-weight: 600;
      color: var(--color-accent);
      margin-bottom: 6px;
    }
    .report-body {
      font-size: 15.5px;
      color: var(--color-text);
    }
    .report-body h2 {
      font-size: 20px;
      color: var(--color-text);
      margin: 28px 0 14px 0;
      padding-bottom: 6px;
      border-bottom: 1px solid rgba(160, 109, 68, 0.1);
    }
    .report-body h3 {
      font-size: 17px;
      color: var(--color-text);
      margin: 20px 0 10px 0;
    }
    .report-body p { margin-bottom: 14px; }
    .report-body ul, .report-body ol { margin: 10px 0 16px 20px; }
    .report-body li { margin-bottom: 6px; }
    .report-body img {
      max-width: 100%;
      height: auto;
      border-radius: 12px;
      margin: 16px 0;
    }
    .report-body table {
      width: 100%;
      border-collapse: collapse;
      margin: 20px 0;
    }
    .report-body th, .report-body td {
      border: 1px solid rgba(160, 109, 68, 0.12);
      padding: 10px 14px;
      text-align: left;
    }
    .report-body th {
      background: rgba(160, 109, 68, 0.05);
      color: var(--color-text);
      font-weight: 600;
    }
    .footer-watermark {
      text-align: center;
      font-size: 12px;
      color: var(--color-muted);
      margin-top: 16px;
    }
  </style>
</head>
<body>
  <div class="report-wrapper">
    <div class="report-card">
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
