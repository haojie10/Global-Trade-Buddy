import { createClient } from '@supabase/supabase-js';

/**
 * 统一的图片上传入口
 * 优先上传到 Supabase Storage；若未配置环境变量，
 * 则降级保存到本地 public/uploads 目录（仅供开发环境使用）。
 *
 * 消除了 pages/api/admin/reports/upload.ts、pages/api/agent/publish.ts、
 * pages/api/admin/articles/create.ts 三处重复的 mockUpload 实现。
 */
export async function uploadImage(buffer: Buffer, mime: string): Promise<string> {
  const ext = mime.split('/')[1] || 'png';
  const fileName = `img_${Date.now()}_${Math.floor(Math.random() * 1000)}.${ext}`;

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  // 服务端上传必须使用 SERVICE_ROLE_KEY，权限收敛到后端
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

  // 本地开发降级方案：仅当未配置 Supabase 时启用
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
 * 从 HTML 字符串中提取所有 report-images bucket 的文件名
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
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) return;

  const oldFiles = extractStorageFileNames(oldHtml);
  if (oldFiles.length === 0) return;

  const newFileSet = new Set(extractStorageFileNames(newHtml));
  // 旧有但新无的文件才是真正的孤儿
  const orphaned = oldFiles.filter(f => !newFileSet.has(f));

  if (orphaned.length === 0) return;

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
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;

  // 复用公共提取函数
  const supabaseFiles = extractStorageFileNames(contentHtml);

  // 提取本地开发测试环境图片文件名
  const localImgRegex = /\/uploads\/([a-zA-Z0-9_\-\.]+)/g;
  const localFiles: string[] = [];
  let match;
  while ((match = localImgRegex.exec(contentHtml)) !== null) {
    localFiles.push(match[1]);
  }

  // 物理清除 Supabase Storage 桶内文件
  if (supabaseFiles.length > 0 && supabaseUrl && supabaseKey) {
    try {
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
}
