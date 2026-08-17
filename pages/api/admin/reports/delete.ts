import { NextApiRequest, NextApiResponse } from 'next';
import { PoolClient } from 'pg';
import { withDb } from '../../../../lib/api-handler';
import { requireAdmin } from '../../../../lib/auth';
import { deleteImagesFromContent } from '../../../../lib/storage';

async function deleteReportHandler(req: NextApiRequest, res: NextApiResponse, dbClient: PoolClient) {
  // 强安全权限拦截：只允许管理员操作
  const adminSession = requireAdmin(req);
  if (!adminSession) {
    return res.status(403).json({ error: '权限不足，仅管理员可执行此操作' });
  }

  const { reportId, reportIds } = req.body;

  // 兼容单个 ID 和 批量 ID 数组
  let targetIds: string[] = [];
  if (Array.isArray(reportIds) && reportIds.length > 0) {
    targetIds = reportIds.filter(Boolean);
  } else if (reportId) {
    targetIds = [reportId];
  }

  if (targetIds.length === 0) {
    return res.status(400).json({ error: '缺少需要删除的报告 ID 参数 (reportId 或 reportIds)' });
  }

  try {
    // 1. 在删除前查询这些报告的 content_html，分析出所有图片的物理链接，以供事务成功后物理清理
    const reportRes = await dbClient.query(
      'SELECT id, content_html FROM reports WHERE id = ANY($1)',
      [targetIds]
    );

    if (reportRes.rows.length === 0) {
      return res.status(404).json({ error: '未找到指定报告，可能已被删除' });
    }

    const htmlContents = reportRes.rows.map(r => r.content_html || '');

    await dbClient.query('BEGIN');

    // 级联关系：由于 db-schema 中 relations、unlocks、favorites 的 report_id 外键均建有 ON DELETE CASCADE，
    // 所以直接删除 reports 记录，相关联的解锁、收藏、拓扑关系会自动被安全清理。
    const deleteRes = await dbClient.query(
      'DELETE FROM reports WHERE id = ANY($1)',
      [targetIds]
    );

    await dbClient.query('COMMIT');

    // 2. 数据库事务提交成功后，并发清理所有相关外部 COS 图片文件
    Promise.all(htmlContents.map(html => deleteImagesFromContent(html))).catch(err => {
      console.error('COS 图片物理清理后台异常:', err);
    });

    return res.status(200).json({
      success: true,
      message: `成功删除 ${deleteRes.rowCount} 篇报告及关联物理资产！`,
      deletedCount: deleteRes.rowCount
    });
  } catch (err: any) {
    await dbClient.query('ROLLBACK');
    const safeMsg = process.env.NODE_ENV === 'production' ? '服务器内部错误' : err.message;
    return res.status(500).json({ error: safeMsg });
  }
}

export default withDb(deleteReportHandler, {
  methods: ['POST']
});
