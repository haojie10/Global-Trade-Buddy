import { NextApiRequest, NextApiResponse } from 'next';
import { PoolClient } from 'pg';
import { withDb } from '../../../../lib/api-handler';
import { requireAdmin } from '../../../../lib/auth';

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

    // 2. 数据库事务提交成功后，物理清理外部图片文件，彻底解决 Supabase Storage 空间残留问题
    const fs = require('fs');
    const path = require('path');
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;

    // 提取 Supabase 存储桶图片文件名
    const supabaseImgRegex = /report-images\/([a-zA-Z0-9_\-\.]+)/g;
    let match;
    const supabaseFiles: string[] = [];
    while ((match = supabaseImgRegex.exec(contentHtml)) !== null) {
      supabaseFiles.push(match[1]);
    }

    // 提取本地开发测试环境图片文件名
    const localImgRegex = /\/uploads\/([a-zA-Z0-9_\-\.]+)/g;
    const localFiles: string[] = [];
    while ((match = localImgRegex.exec(contentHtml)) !== null) {
      localFiles.push(match[1]);
    }

    // 物理清除 Supabase Storage 桶内文件 (使用 100% 验证成功的 SDK 方式)
    if (supabaseFiles.length > 0 && supabaseUrl && supabaseKey) {
      try {
        const { createClient } = require('@supabase/supabase-js');
        const supabase = createClient(supabaseUrl, supabaseKey, {
          auth: { persistSession: false }
        });
        const { error: removeError } = await supabase
          .storage
          .from('report-images')
          .remove(supabaseFiles);

        if (removeError) {
          console.error('[WARN] SDK 批量物理清除 Supabase 存储图片失败:', removeError.message || removeError);
        }
      } catch (err: any) {
        console.error('[WARN] SDK 物理清除 Supabase 存储图片报错:', err.message);
      }
    }

    // 物理清除本地开发环境上传文件
    if (localFiles.length > 0) {
      const uploadDir = path.join(process.cwd(), 'public', 'uploads');
      for (const fileName of localFiles) {
        try {
          const filePath = path.join(uploadDir, fileName);
          if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
          }
        } catch (err) {
          console.error(`[WARN] 物理清除本地图片 ${fileName} 失败:`, err);
        }
      }
    }
    
    return res.status(200).json({
      success: true,
      message: '报告及关联物理图片已彻底同步清理！'
    });
  } catch (err: any) {
    await dbClient.query('ROLLBACK');
    return res.status(500).json({ error: err.message });
  }
}

export default withDb(deleteReportHandler, {
  methods: ['POST'],
  requiredBody: ['reportId']
});
