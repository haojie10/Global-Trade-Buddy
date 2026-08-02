import cloudbase from '@cloudbase/node-sdk';
import { createClient } from '@supabase/supabase-js';

/**
 * 统一的图片上传入口
 * 优先上传到 CloudBase 云存储；若未配置 CloudBase，
 * 则降级到 Supabase Storage；两者都未配置时保存到本地 public/uploads（仅供开发）。
 *
 * 环境变量：
 *   TCB_ENV_ID        必填，CloudBase 环境 ID，如 marketgraphic-d1g82tv7y3a8c6800
 *   TCB_SECRET_ID     腾讯云 API 密钥 SecretId（云托管内运行时可不填）
 *   TCB_SECRET_KEY    腾讯云 API 密钥 SecretKey（云托管内运行时可不填）
 *   TCB_BUCKET        存储桶名（可选），用于构造 fileID，如 marketgraphic-images
 *
 * NOTE: 旧数据中 content_html 内的图片仍是 Supabase URL，
 * 因此删除图片时会同时尝试 CloudBase 与 Supabase，避免残留孤儿图片。
 */

let tcbApp: ReturnType<typeof cloudbase.init> | null = null;

// 缓存上传返回的真实 fileID 前缀（cloud://env.bucket/ 或 cloud://env/），
// 删除时优先用它构造 fileID，避免桶名不确定导致删除不匹配。
let cachedCloudFilePrefix: string | null = null;

function getCloudBaseApp() {
  if (tcbApp) return tcbApp;
  const initOptions: { env: string; secretId?: string; secretKey?: string } = {
    env: process.env.TCB_ENV_ID!,
  };
  if (process.env.TCB_SECRET_ID && process.env.TCB_SECRET_KEY) {
    initOptions.secretId = process.env.TCB_SECRET_ID;
    initOptions.secretKey = process.env.TCB_SECRET_KEY;
  }
  tcbApp = cloudbase.init(initOptions);
  return tcbApp;
}

function cloudbaseEnabled(): boolean {
  return Boolean(process.env.TCB_ENV_ID);
}

/** 由 cloudPath 构造 fileID：优先使用缓存的真实前缀，否则按 TCB_BUCKET 推断 */
function cloudbaseFileId(cloudPath: string): string {
  if (cachedCloudFilePrefix) return `${cachedCloudFilePrefix}${cloudPath}`;
  const envId = process.env.TCB_ENV_ID!;
  const bucket = process.env.TCB_BUCKET;
  return bucket ? `cloud://${envId}.${bucket}/${cloudPath}` : `cloud://${envId}/${cloudPath}`;
}

/** 删除一批 CloudBase 文件（每批 100），失败仅告警不抛出 */
async function deleteCloudBaseFiles(fileNames: string[]): Promise<void> {
  if (!cloudbaseEnabled() || fileNames.length === 0) return;
  const app = getCloudBaseApp();
  const BATCH_SIZE = 100;
  for (let i = 0; i < fileNames.length; i += BATCH_SIZE) {
    const batch = fileNames
      .slice(i, i + BATCH_SIZE)
      .map(f => cloudbaseFileId(`report-images/${f}`));
    try {
      const { fileList } = await app.deleteFile({ fileList: batch });
      const failed = (fileList || []).filter((it: any) => it.code !== 'SUCCESS');
      if (failed.length > 0) {
        console.error('[WARN] CloudBase 删除部分文件失败:', failed);
      } else {
        console.log(`[INFO] CloudBase 已删除 ${batch.length} 张图片`);
      }
    } catch (err: any) {
      console.error('[WARN] CloudBase 删除文件异常:', err.message);
    }
  }
}

export async function uploadImage(buffer: Buffer, mime: string): Promise<string> {
  const ext = mime.split('/')[1] || 'png';
  const fileName = `img_${Date.now()}_${Math.floor(Math.random() * 1000)}.${ext}`;
  const cloudPath = `report-images/${fileName}`;

  // 1. CloudBase 云存储
  if (cloudbaseEnabled()) {
    const app = getCloudBaseApp();
    const { fileID } = await app.uploadFile({ cloudPath, fileContent: buffer });
    if (!fileID) {
      throw new Error('CloudBase 上传失败：未返回 fileID');
    }
    // 缓存真实 fileID 前缀，供后续删除操作构造 fileID
    const slashIdx = fileID.lastIndexOf('/');
    if (slashIdx > 0) {
      cachedCloudFilePrefix = fileID.slice(0, slashIdx + 1);
    }
    const { fileList } = await app.getTempFileURL({
      fileList: [{ fileID, maxAge: 86400 }],
    });
    const url = fileList?.[0]?.tempFileURL;
    if (!url) {
      throw new Error('CloudBase 上传后获取访问链接失败');
    }
    return url;
  }

  // 2. Supabase Storage（兼容旧环境）
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;
  if (supabaseUrl && supabaseKey) {
    const uploadUrl = `${supabaseUrl}/storage/v1/object/report-images/${fileName}`;
    const uploadRes = await fetch(uploadUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${supabaseKey}`,
        'Content-Type': mime,
        'x-upsert': 'true'
      },
      body: buffer as any
    });

    if (!uploadRes.ok) {
      const errText = await uploadRes.text();
      throw new Error(`Failed to upload image to Supabase Storage: ${errText}`);
    }

    return `${supabaseUrl}/storage/v1/object/public/report-images/${fileName}`;
  }

  // 3. 本地开发降级方案：仅当 CloudBase 与 Supabase 均未配置时启用
  const fs = require('fs');
  const path = require('path');
  const uploadDir = path.join(process.cwd(), 'public', 'uploads');
  if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
  }
  fs.writeFileSync(path.join(uploadDir, fileName), buffer);
  return `/uploads/${fileName}`;
}

/**
 * 从 HTML 字符串中提取所有 report-images 的文件名
 * CloudBase 与 Supabase 的图片 URL 均包含 report-images/ 路径段，正则通用
 * NOTE: 供 deleteImagesFromContent / cleanOrphanedImages / GC 脚本统一复用
 */
export function extractStorageFileNames(html: string): string[] {
  const regex = /report-images\/([a-zA-Z0-9_\-\.]+)/g;
  const files: string[] = [];
  let match;
  while ((match = regex.exec(html)) !== null) {
    files.push(match[1]);
  }
  return files;
}

/**
 * diff 清理：仅删除旧 HTML 中有、新 HTML 中没有的图片
 * 供报告/资讯更新接口在 UPDATE 事务提交后调用，防止覆盖更新产生孤儿图片
 *
 * @param oldHtml - UPDATE 前从数据库读取的旧 content_html
 * @param newHtml - UPDATE 后已写入数据库的新 content_html
 */
export async function cleanOrphanedImages(oldHtml: string, newHtml: string): Promise<void> {
  const oldFiles = extractStorageFileNames(oldHtml);
  if (oldFiles.length === 0) return;

  const newFileSet = new Set(extractStorageFileNames(newHtml));
  // 旧有但新无的文件才是真正的孤儿
  const orphaned = oldFiles.filter(f => !newFileSet.has(f));

  if (orphaned.length === 0) return;

  // CloudBase 清理
  await deleteCloudBaseFiles(orphaned);

  // Supabase 清理（兼容旧存储中的数据）
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;
  if (!supabaseUrl || !supabaseKey) return;

  try {
    const supabase = createClient(supabaseUrl, supabaseKey, {
      auth: { persistSession: false }
    });
    const { error } = await supabase.storage.from('report-images').remove(orphaned);
    if (error) {
      console.error('[WARN] cleanOrphanedImages: 删除孤儿图片失败:', error.message || error);
    } else {
      console.log(`[INFO] cleanOrphanedImages: 已清理 ${orphaned.length} 张孤儿图片:`, orphaned);
    }
  } catch (err: any) {
    console.error('[WARN] cleanOrphanedImages: 异常:', err.message);
  }
}

/**
 * 从 content_html 中提取并物理删除所有引用的图片文件
 * 供报告删除接口在数据库事务提交后调用
 */
export async function deleteImagesFromContent(contentHtml: string): Promise<void> {
  const fs = require('fs');
  const path = require('path');

  // 复用公共提取函数
  const storageFiles = extractStorageFileNames(contentHtml);

  // CloudBase 清理
  await deleteCloudBaseFiles(storageFiles);

  // Supabase 清理（兼容旧存储中的数据）
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;
  if (storageFiles.length > 0 && supabaseUrl && supabaseKey) {
    try {
      const supabase = createClient(supabaseUrl, supabaseKey, {
        auth: { persistSession: false }
      });
      const { error: removeError } = await supabase
        .storage
        .from('report-images')
        .remove(storageFiles);

      if (removeError) {
        console.error('[WARN] SDK 批量物理清除 Supabase 存储图片失败:', removeError.message || removeError);
      }
    } catch (err: any) {
      console.error('[WARN] SDK 物理清除 Supabase 存储图片报错:', err.message);
    }
  }

  // 物理清除本地开发环境上传文件
  const localImgRegex = /\/uploads\/([a-zA-Z0-9_\-\.]+)/g;
  const localFiles: string[] = [];
  let match;
  while ((match = localImgRegex.exec(contentHtml)) !== null) {
    localFiles.push(match[1]);
  }

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
}
