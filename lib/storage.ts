import COS from 'cos-nodejs-sdk-v5';

/**
 * 统一的图片上传入口
 * 优先上传到 腾讯云 COS 对象存储；若未配置时保存到本地 public/uploads（仅供开发）。
 *
 * 环境变量（COS）：
 *   COS_BUCKET        必填，腾讯云 COS 存储桶全称（例：marketgraphic-image-1302276463）
 *   COS_REGION        必填，存储桶地域（例：ap-shanghai）
 *   COS_SECRET_ID     腾讯云 API 密钥 SecretId
 *   COS_SECRET_KEY    腾讯云 API 密钥 SecretKey
 *   COS_DOMAIN        可选，存储访问/EdgeOne加速域名，例：https://marketgraphic-image-1302276463.cos.ap-shanghai.myqcloud.com
 */

let cosInstance: COS | null = null;

function cosEnabled(): boolean {
  return Boolean(process.env.COS_BUCKET && process.env.COS_REGION);
}

function getCOSInstance(): COS {
  if (cosInstance) return cosInstance;
  const secretId = process.env.COS_SECRET_ID;
  const secretKey = process.env.COS_SECRET_KEY;

  if (!secretId || !secretKey) {
    throw new Error('未配置 COS_SECRET_ID / COS_SECRET_KEY');
  }

  cosInstance = new COS({ SecretId: secretId, SecretKey: secretKey });
  return cosInstance;
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

  // 2. 本地开发降级方案：仅当未配置云存储时启用
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
 * diff 清理孤儿图片：同时清理 COS
 */
export async function cleanOrphanedImages(oldHtml: string, newHtml: string): Promise<void> {
  const oldFiles = extractStorageFileNames(oldHtml);
  if (oldFiles.length === 0) return;

  const newFileSet = new Set(extractStorageFileNames(newHtml));
  const orphaned = oldFiles.filter(f => !newFileSet.has(f));
  if (orphaned.length === 0) return;

  // 1. COS 清理
  await deleteCOSFiles(orphaned);

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

/**
 * 规范化并清洗行业百科静态资源路径键，先白名单清洗字符，再彻底剔除 `..` 段防止组合绕过
 * @param safeKeyName 原始相对文件名或子路径
 * @returns 安全的相对路径键（非空、不含前导 `/` 与 `..`）
 */
export function sanitizeWikiAssetKey(safeKeyName: string): string {
  // 1. 先统一分隔符并执行字符白名单清洗，杜绝 ". ./" 或 ".@./" 在后续拼接复活出 ".."
  const whitelisted = String(safeKeyName || '')
    .replace(/\\/g, '/')
    .replace(/[^a-zA-Z0-9._/-]/g, '');

  // 2. 按路径段切分，递归剔除任意 ".." 序列并过滤空段与 "." / ".."
  const segments = whitelisted
    .split('/')
    .map((segment) => {
      let cleaned = segment;
      while (cleaned.includes('..')) {
        cleaned = cleaned.replace(/\.{2,}/g, '');
      }
      return cleaned;
    })
    .filter((segment) => segment.length > 0 && segment !== '.' && segment !== '..');

  const sanitized = segments.join('/').replace(/^\/+/, '');
  if (!sanitized || sanitized.split('/').some((seg) => seg === '..' || seg.includes('..'))) {
    throw new Error('无效的百科资产路径 key');
  }
  return sanitized;
}

/**
 * 上传行业百科专用静态资源（如企业 Logo、封面图、短视频）到腾讯云 COS 的 wiki-assets/ 目录；
 * 若未配置 COS，则降级写入本地 public/uploads/wiki-assets/。
 * @param buffer 文件二进制内容
 * @param mime MIME 类型
 * @param safeKeyName 目标相对路径键
 * @returns 可访问的资源 URL 或站内相对路径
 */
export async function uploadWikiAsset(buffer: Buffer, mime: string, safeKeyName: string): Promise<string> {
  const sanitizedKey = sanitizeWikiAssetKey(safeKeyName);
  if (!sanitizedKey) {
    throw new Error('无效的百科资产路径 key');
  }

  const cloudPath = `wiki-assets/${sanitizedKey}`;

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
        (err) => {
          if (err) {
            console.error('[COS] 上传百科资产失败:', err);
            return reject(new Error(`COS 上传百科资源失败: ${err.message || JSON.stringify(err)}`));
          }
          const domain = process.env.COS_DOMAIN
            ? process.env.COS_DOMAIN.replace(/\/$/, '')
            : `https://${Bucket}.cos.${Region}.myqcloud.com`;
          resolve(`${domain}/${cloudPath}`);
        }
      );
    });
  }

  const fs = require('fs');
  const path = require('path');
  const baseDir = path.resolve(process.cwd(), 'public', 'uploads', 'wiki-assets');
  const localPath = path.resolve(baseDir, sanitizedKey);
  // 防御性路径边界校验，确保绝不越出 wiki-assets 目录
  if (localPath !== baseDir && !localPath.startsWith(baseDir + path.sep)) {
    throw new Error('检测到越权百科资产存储路径');
  }
  fs.mkdirSync(path.dirname(localPath), { recursive: true });
  fs.writeFileSync(localPath, buffer);
  return `/uploads/wiki-assets/${sanitizedKey}`;
}
