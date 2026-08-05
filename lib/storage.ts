import COS from 'cos-nodejs-sdk-v5';
import cloudbase from '@cloudbase/node-sdk';
import { createClient } from '@supabase/supabase-js';

/**
 * 统一的图片上传入口
 * 优先上传到 腾讯云 COS 对象存储；若未配置，则依次降级到 CloudBase 云存储、
 * Supabase Storage；均未配置时保存到本地 public/uploads（仅供开发）。
 *
 * 环境变量（COS）：
 *   COS_BUCKET        必填，腾讯云 COS 存储桶全称（例：marketgraphic-image-1302276463）
 *   COS_REGION        必填，存储桶地域（例：ap-shanghai）
 *   COS_SECRET_ID     腾讯云 API 密钥 SecretId（如未配置，自动回退读取 TCB_SECRET_ID）
 *   COS_SECRET_KEY    腾讯云 API 密钥 SecretKey（如未配置，自动回退读取 TCB_SECRET_KEY）
 *   COS_DOMAIN        可选，存储访问/EdgeOne加速域名，例：https://marketgraphic-image-1302276463.cos.ap-shanghai.myqcloud.com
 */

let cosInstance: COS | null = null;
let tcbApp: ReturnType<typeof cloudbase.init> | null = null;
let cachedCloudFilePrefix: string | null = null;

function cosEnabled(): boolean {
  return Boolean(process.env.COS_BUCKET && process.env.COS_REGION);
}

function getCOSInstance(): COS {
  if (cosInstance) return cosInstance;
  const secretId = process.env.COS_SECRET_ID || process.env.TCB_SECRET_ID;
  const secretKey = process.env.COS_SECRET_KEY || process.env.TCB_SECRET_KEY;

  if (!secretId || !secretKey) {
    throw new Error('未配置 COS_SECRET_ID / COS_SECRET_KEY 或 TCB_SECRET_ID / TCB_SECRET_KEY');
  }

  cosInstance = new COS({ SecretId: secretId, SecretKey: secretKey });
  return cosInstance;
}

function getCloudBaseApp() {
  if (tcbApp) return tcbApp;
  const initOptions: { env: string; secretId?: string; secretKey?: string } = {
    env: process.env.TCB_ENV_ID!,
  };
  const secretId = process.env.TCB_SECRET_ID || process.env.COS_SECRET_ID;
  const secretKey = process.env.TCB_SECRET_KEY || process.env.COS_SECRET_KEY;
  if (secretId && secretKey) {
    initOptions.secretId = secretId;
    initOptions.secretKey = secretKey;
  }
  tcbApp = cloudbase.init(initOptions);
  return tcbApp;
}

function cloudbaseEnabled(): boolean {
  return Boolean(process.env.TCB_ENV_ID);
}

function cloudbaseFileId(cloudPath: string): string {
  if (cachedCloudFilePrefix) return `${cachedCloudFilePrefix}${cloudPath}`;
  const envId = process.env.TCB_ENV_ID!;
  const bucket = process.env.TCB_BUCKET;
  return bucket ? `cloud://${envId}.${bucket}/${cloudPath}` : `cloud://${envId}/${cloudPath}`;
}

/** 删除 COS 文件（每批 100） */
async function deleteCOSFiles(fileNames: string[]): Promise<void> {
  if (!cosEnabled() || fileNames.length === 0) return;
  const Bucket = process.env.COS_BUCKET!;
  const Region = process.env.COS_REGION!;
  const cos = getCOSInstance();

  const Objects = fileNames.map(f => ({ Key: `report-images/${f}` }));

  return new Promise((resolve) => {
    cos.deleteMultipleObject(
      {
        Bucket,
        Region,
        Objects,
      },
      (err, data) => {
        if (err) {
          console.error('[WARN] COS 删除批量文件失败:', err);
        } else {
          console.log(`[INFO] COS 已成功删除 ${fileNames.length} 张图片`);
        }
        resolve();
      }
    );
  });
}

/** 删除 CloudBase 文件 */
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

  // 1. 优先上传到 腾讯云 COS 对象存储
  if (cosEnabled()) {
    const Bucket = process.env.COS_BUCKET!;
    const Region = process.env.COS_REGION!;
    const cos = getCOSInstance();

    return new Promise((resolve, reject) => {
      cos.putObject(
        {
          Bucket,
          Region,
          Key: cloudPath,
          Body: buffer,
          ContentType: mime,
        },
        (err, data) => {
          if (err) {
            console.error('[COS] 上传图片失败:', err);
            return reject(new Error(`COS 上传失败: ${err.message || JSON.stringify(err)}`));
          }
          const domain = process.env.COS_DOMAIN
            ? process.env.COS_DOMAIN.replace(/\/$/, '')
            : `https://${Bucket}.cos.${Region}.myqcloud.com`;
          const url = `${domain}/${cloudPath}`;
          resolve(url);
        }
      );
    });
  }

  // 2. CloudBase 云存储（备用）
  if (cloudbaseEnabled()) {
    const app = getCloudBaseApp();
    const { fileID } = await app.uploadFile({ cloudPath, fileContent: buffer });
    if (!fileID) {
      throw new Error('CloudBase 上传失败：未返回 fileID');
    }
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

  // 3. Supabase Storage（兼容旧环境）
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

  // 4. 本地开发降级方案：仅当未配置云存储时启用
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
 * diff 清理孤儿图片：同时清理 COS、CloudBase 与 Supabase
 */
export async function cleanOrphanedImages(oldHtml: string, newHtml: string): Promise<void> {
  const oldFiles = extractStorageFileNames(oldHtml);
  if (oldFiles.length === 0) return;

  const newFileSet = new Set(extractStorageFileNames(newHtml));
  const orphaned = oldFiles.filter(f => !newFileSet.has(f));
  if (orphaned.length === 0) return;

  // 1. COS 清理
  await deleteCOSFiles(orphaned);

  // 2. CloudBase 清理
  await deleteCloudBaseFiles(orphaned);

  // 3. Supabase 清理
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;
  if (supabaseUrl && supabaseKey) {
    try {
      const supabase = createClient(supabaseUrl, supabaseKey, { auth: { persistSession: false } });
      await supabase.storage.from('report-images').remove(orphaned);
    } catch (err: any) {
      console.error('[WARN] cleanOrphanedImages Supabase 清理报错:', err.message);
    }
  }
}

/**
 * 从 content_html 中提取并物理删除所有引用的图片文件
 */
export async function deleteImagesFromContent(contentHtml: string): Promise<void> {
  const fs = require('fs');
  const path = require('path');

  const storageFiles = extractStorageFileNames(contentHtml);

  // COS 清理
  await deleteCOSFiles(storageFiles);

  // CloudBase 清理
  await deleteCloudBaseFiles(storageFiles);

  // Supabase 清理
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;
  if (storageFiles.length > 0 && supabaseUrl && supabaseKey) {
    try {
      const supabase = createClient(supabaseUrl, supabaseKey, { auth: { persistSession: false } });
      await supabase.storage.from('report-images').remove(storageFiles);
    } catch (err: any) {
      console.error('[WARN] Supabase 物理清除图片报错:', err.message);
    }
  }

  // 本地开发清理
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
        console.error(`[WARN] 清除本地图片 ${fileName} 失败:`, err);
      }
    }
  }
}
