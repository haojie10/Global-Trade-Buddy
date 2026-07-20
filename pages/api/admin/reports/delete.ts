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

  const { reportId } = req.body;
  if (!reportId) {
    return res.status(400).json({ error: '缺少报告 ID 参数' });
  }

  try {
    // 1. 在删除前先查询 content_html，分析出所有图片的物理链接，以供事务成功后清理
    const reportRes = await dbClient.query('SELECT content_html FROM reports WHERE id = $1', [reportId]);
    if (reportRes.rows.length === 0) {
      return res.status(404).json({ error: '未找到指定报告，可能已被删除' });
    }
    const contentHtml = reportRes.rows[0].content_html || '';

    await dbClient.query('BEGIN');

    // 级联关系：由于 db-schema 中 relations、unlocks、favorites 的 report_id 外键均建有 ON DELETE CASCADE，
    // 所以直接删除 reports 记录，相关联的解锁、收藏、拓扑关系会自动被安全清理。
    const deleteRes = await dbClient.query('DELETE FROM reports WHERE id = $1', [reportId]);
    
    if (deleteRes.rowCount === 0) {
      await dbClient.query('ROLLBACK');
      return res.status(404).json({ error: '未找到指定报告，可能已被删除' });
    }

    await dbClient.query('COMMIT');

    // 2. 数据库事务提交成功后，物理清理外部图片文件
    await deleteImagesFromContent(contentHtml);

    return res.status(200).json({
      success: true,
      message: '报告及关联物理图片已彻底同步清理！'
    });
  } catch (err: any) {
    await dbClient.query('ROLLBACK');
    const safeMsg = process.env.NODE_ENV === 'production' ? '服务器内部错误' : err.message;
    return res.status(500).json({ error: safeMsg });
  }
}

export default withDb(deleteReportHandler, {
  methods: ['POST'],
  requiredBody: ['reportId']
});
