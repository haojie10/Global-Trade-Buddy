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
