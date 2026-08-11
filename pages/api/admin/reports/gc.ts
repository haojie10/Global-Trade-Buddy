import { NextApiRequest, NextApiResponse } from 'next';
import { PoolClient } from 'pg';
import COS from 'cos-nodejs-sdk-v5';
import { withDb } from '../../../../lib/api-handler';
import { requireAdmin } from '../../../../lib/auth';
import { extractStorageFileNames } from '../../../../lib/storage';

/**
 * 管理后台一键触发 Storage GC 端点 (支持 COS)
 * POST /api/admin/reports/gc
 * Body: { dryRun?: boolean }
 */
async function gcHandler(req: NextApiRequest, res: NextApiResponse, dbClient: PoolClient) {
  const adminSession = requireAdmin(req);
  if (!adminSession) {
    return res.status(403).json({ error: '权限不足，仅管理员可执行此操作' });
  }

  const dryRun: boolean = req.body?.dryRun === true;

  // ====================================================
  // Phase 1: MARK — 扫描所有表构建被引用图片文件名集合
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
    ).catch(() => ({ rows: [] })),
  ]);

  for (const row of reportsRes.rows)   extractStorageFileNames(row.content_html).forEach(f => referencedSet.add(f));
  for (const row of newsRes.rows)      extractStorageFileNames(row.content).forEach(f => referencedSet.add(f));
  for (const row of articlesRes.rows)  extractStorageFileNames(row.content_html).forEach(f => referencedSet.add(f));

  // ====================================================
  // Phase 2: SWEEP — 枚举当前生效存储桶中的所有文件
  // ====================================================
  const cosBucket = process.env.COS_BUCKET;
  const cosRegion = process.env.COS_REGION;
  const cosSecretId = process.env.COS_SECRET_ID;
  const cosSecretKey = process.env.COS_SECRET_KEY;

  let provider: 'cos' | null = null;
  if (cosBucket && cosRegion && cosSecretId && cosSecretKey) {
    provider = 'cos';
  }

  if (!provider) {
    return res.status(500).json({ error: '未检测到有效的对象存储配置（COS）' });
  }

  const allStorageFiles: string[] = [];

  if (provider === 'cos') {
    const cos = new COS({ SecretId: cosSecretId!, SecretKey: cosSecretKey! });
    try {
      let marker: string | undefined = undefined;
      do {
        const result: any = await new Promise((resolve, reject) => {
          cos.getBucket(
            {
              Bucket: cosBucket!,
              Region: cosRegion!,
              Prefix: 'report-images/',
              Marker: marker,
              MaxKeys: 1000,
            },
            (err, data) => (err ? reject(err) : resolve(data))
          );
        });

        const contents = result.Contents || [];
        for (const item of contents) {
          const key = item.Key; // 例: report-images/xxx.png
          if (key && key !== 'report-images/') {
            const fileName = key.replace('report-images/', '');
            if (fileName) allStorageFiles.push(fileName);
          }
        }
        marker = result.IsTruncated === 'true' || result.IsTruncated === true ? result.NextMarker : undefined;
      } while (marker);
    } catch (err: any) {
      return res.status(500).json({ error: `COS 枚举存储桶文件失败: ${err.message || JSON.stringify(err)}` });
    }
  }

  // ====================================================
  // Phase 3: 找出孤儿文件
  // ====================================================
  const orphaned = allStorageFiles.filter(f => !referencedSet.has(f));

  if (dryRun || orphaned.length === 0) {
    return res.status(200).json({
      success: true,
      dryRun,
      provider,
      totalStorage: allStorageFiles.length,
      referenced: referencedSet.size,
      orphaned: orphaned.length,
      orphanedFiles: orphaned,
      deleted: 0,
    });
  }

  // ====================================================
  // Phase 4: DELETE — 物理删除孤儿文件
  // ====================================================
  let deletedCount = 0;
  const errors: string[] = [];

  if (provider === 'cos') {
    const cos = new COS({ SecretId: cosSecretId!, SecretKey: cosSecretKey! });
    const BATCH_SIZE = 1000; // COS deleteMultipleObject 最多支持 1000 个对象
    for (let i = 0; i < orphaned.length; i += BATCH_SIZE) {
      const batch = orphaned.slice(i, i + BATCH_SIZE);
      const objects = batch.map(f => ({ Key: `report-images/${f}` }));
      try {
        await new Promise<void>((resolve, reject) => {
          cos.deleteMultipleObject(
            {
              Bucket: cosBucket!,
              Region: cosRegion!,
              Objects: objects,
            },
            (err) => (err ? reject(err) : resolve())
          );
        });
        deletedCount += batch.length;
      } catch (err: any) {
        errors.push(`COS 批量删除异常: ${err.message || JSON.stringify(err)}`);
      }
    }
  }

  return res.status(200).json({
    success: errors.length === 0,
    dryRun: false,
    provider,
    totalStorage: allStorageFiles.length,
    referenced: referencedSet.size,
    orphaned: orphaned.length,
    deleted: deletedCount,
    errors: errors.length > 0 ? errors : undefined,
  });
}

export default withDb(gcHandler, { methods: ['POST'] });
