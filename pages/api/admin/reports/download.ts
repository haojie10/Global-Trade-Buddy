import { NextApiRequest, NextApiResponse } from 'next';
import { PoolClient } from 'pg';
import { withDb } from '../../../../lib/api-handler';
import { requireAdmin } from '../../../../lib/auth';

async function downloadReportHandler(req: NextApiRequest, res: NextApiResponse, dbClient: PoolClient) {
  const session = requireAdmin(req);
  if (!session) {
    return res.status(403).json({ error: '权限不足，仅管理员可执行此操作' });
  }

  const { id } = req.query;
  if (!id || typeof id !== 'string') {
    return res.status(400).json({ error: '缺少报告 id 参数' });
  }

  try {
    const reportRes = await dbClient.query(
      'SELECT id, title, content_html FROM reports WHERE id = $1',
      [id]
    );

    if (reportRes.rows.length === 0) {
      return res.status(404).json({ error: '未找到指定报告' });
    }

    const report = reportRes.rows[0];
    const rawTitle = report.title || 'report';
    // 过滤文件名中的非法字符
    const sanitizedTitle = rawTitle.replace(/[\\/:*?"<>|]/g, '_').trim();
    const fileName = `${sanitizedTitle}.html`;

    const contentHtml = report.content_html || '';

    // 设置下载响应头，支持 UTF-8 文件名编码
    const encodedFileName = encodeURIComponent(fileName);
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${encodedFileName}"; filename*=UTF-8''${encodedFileName}`
    );

    return res.status(200).send(contentHtml);
  } catch (err: any) {
    console.error('Download report error:', err);
    return res.status(500).json({ error: '下载失败: ' + err.message });
  }
}

export default withDb(downloadReportHandler);
