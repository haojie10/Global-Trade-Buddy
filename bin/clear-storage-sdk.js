const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

async function main() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;

  console.log('====== 开始使用 Supabase SDK 执行图片清空任务 ======');

  // 1. 清理本地 uploads 目录
  try {
    const localUploadsDir = path.join(process.cwd(), 'public', 'uploads');
    if (fs.existsSync(localUploadsDir)) {
      const files = fs.readdirSync(localUploadsDir);
      let count = 0;
      for (const file of files) {
        if (file !== '.gitkeep') {
          fs.unlinkSync(path.join(localUploadsDir, file));
          count++;
        }
      }
      console.log(`✅ 已成功清理本地开发环境图片数量: ${count} 张`);
    }
  } catch (err) {
    console.error('⚠️ 清理本地 uploads 目录失败:', err.message);
  }

  // 2. 清理云端 Supabase Storage
  if (!supabaseUrl || !supabaseKey) {
    console.log('💡 未配置 Supabase 环境变量，跳过云端清理。');
    console.log('====================================================');
    return;
  }

  const supabase = createClient(supabaseUrl, supabaseKey, {
    auth: { persistSession: false }
  });

  try {
    // 2.1 列出桶内所有文件
    const { data: files, error: listError } = await supabase
      .storage
      .from('report-images')
      .list('', { limit: 100, sortBy: { column: 'name', order: 'asc' } });

    if (listError) {
      throw listError;
    }

    if (!files || files.length === 0) {
      console.log('✅ Supabase Storage 储存桶 report-images 已经是空的！');
      console.log('====================================================');
      return;
    }

    const fileNames = files.map(f => f.name).filter(Boolean);
    console.log(`正在从储存桶中物理删除以下文件 (${fileNames.length} 个):`, fileNames);

    // 2.2 使用 SDK 删除文件
    const { data: removed, error: removeError } = await supabase
      .storage
      .from('report-images')
      .remove(fileNames);

    if (removeError) {
      throw removeError;
    }

    console.log('🎉 批量物理删除成功，云端已同步！');
    console.log('🎉 成功彻底清空 Supabase 储存桶 report-images 中的所有图片！');

  } catch (err) {
    console.error('❌ 清理储存桶失败，错误详情:', err.message || err);
  }

  console.log('====================================================');
}

main();
