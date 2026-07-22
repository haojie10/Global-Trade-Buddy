import { NextApiRequest, NextApiResponse } from 'next';
import { PoolClient } from 'pg';
import { createClient } from '@supabase/supabase-js';
import { withDb } from '../../../../lib/api-handler';
import { requireAdmin } from '../../../../lib/auth';
import { extractStorageFileNames } from '../../../../lib/storage';

/**
 * 管理后台一键触发 Storage GC 端点
 * 与 bin/gc-storage.js 使用相同的 mark-and-sweep 逻辑
 *
 * POST /api/admin/reports/gc
 * Body: { dryRun?: boolean }
 *
 * Response:
 *   { success, totalStorage, referenced, orphaned, deleted, dryRun }
 */
async function gcHandler(req: NextApiRequest, res: NextApiResponse, dbClient: PoolClient) {
  const adminSession = requireAdmin(req);
  if (!adminSession) {
    return res.status(403).json({ error: '权限不足，仅管理员可执行此操作' });
  }

  const dryRun: boolean = req.body?.dryRun === true;

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) {
    return res.status(500).json({ error: 'Supabase 环境变量未配置，无法执行 GC' });
  }

  const supabase = createClient(supabaseUrl, supabaseKey, {
    auth: { persistSession: false }
  });

  // ====================================================
  // Phase 1: MARK — 扫描三张表构建被引用文件集合
  // ====================================================
  const referencedSet = new Set<string>();

  const [reportsRes, newsRes, articlesRes] = await Promise.all([
    dbClient.query<{ content_html: string }>(
      `SELECT content_html FROM reports WHERE content_html LIKE '%report-images/%'`
    ),
    dbClient.query<{ content: string }>(
      `SELECT content FROM news WHERE content LIKE '%report-images/%'`
    ),
    dbClient.query<{ content_html: string }>(
      `SELECT content_html FROM articles WHERE content_html LIKE '%report-images/%'`
    ),
  ]);

  for (const row of reportsRes.rows)   extractStorageFileNames(row.content_html).forEach(f => referencedSet.add(f));
  for (const row of newsRes.rows)      extractStorageFileNames(row.content).forEach(f => referencedSet.add(f));
  for (const row of articlesRes.rows)  extractStorageFileNames(row.content_html).forEach(f => referencedSet.add(f));

  // ====================================================
  // Phase 2: SWEEP — 分页枚举 Storage 桶中的全部文件
  // ====================================================
  const allStorageFiles: string[] = [];
  let offset = 0;
  const PAGE_SIZE = 100;

  while (true) {
    const { data: files, error: listError } = await supabase
      .storage
      .from('report-images')
      .list('', { limit: PAGE_SIZE, offset, sortBy: { column: 'name', order: 'asc' } });

    if (listError) {
      return res.status(500).json({ error: `枚举 Storage 文件失败: ${listError.message}` });
    }
    if (!files || files.length === 0) break;

    allStorageFiles.push(...files.map(f => f.name).filter(Boolean));
    if (files.length < PAGE_SIZE) break;
    offset += PAGE_SIZE;
  }

  // ====================================================
  // Phase 3: 找出孤儿文件
  // ====================================================
  const orphaned = allStorageFiles.filter(f => !referencedSet.has(f));

  // dryRun 模式：仅返回统计，不执行删除
  if (dryRun || orphaned.length === 0) {
    return res.status(200).json({
      success: true,
      dryRun,
      totalStorage: allStorageFiles.length,
      referenced: referencedSet.size,
      orphaned: orphaned.length,
      orphanedFiles: orphaned,
      deleted: 0,
    });
  }

  // ====================================================
  // Phase 4: DELETE — 分批删除孤儿文件（每批最多 100 个）
  // ====================================================
  let deletedCount = 0;
  const errors: string[] = [];
  const BATCH_SIZE = 100;

  for (let i = 0; i < orphaned.length; i += BATCH_SIZE) {
    const batch = orphaned.slice(i, i + BATCH_SIZE);
    const { error: removeError } = await supabase
      .storage
      .from('report-images')
      .remove(batch);

    if (removeError) {
      errors.push(`批次 ${Math.floor(i / BATCH_SIZE) + 1}: ${removeError.message}`);
      console.error(`[WARN] gc: 删除批次失败:`, removeError.message);
    } else {
      deletedCount += batch.length;
    }
  }

  console.log(`[INFO] gc: 孤儿图片清理完毕，共删除 ${deletedCount} / ${orphaned.length} 张`);

  return res.status(200).json({
    success: errors.length === 0,
    dryRun: false,
    totalStorage: allStorageFiles.length,
    referenced: referencedSet.size,
    orphaned: orphaned.length,
    deleted: deletedCount,
    errors: errors.length > 0 ? errors : undefined,
  });
}

export default withDb(gcHandler, { methods: ['POST'] });
