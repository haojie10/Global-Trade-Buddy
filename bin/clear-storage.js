const fs = require('fs');
const path = require('path');
require('dotenv').config();

async function main() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;

  console.log('====== 开始执行物理图片清空任务 ======');

  // 1. 清空本地开发测试 uploads 目录
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

  // 2. 清空 Supabase Storage 'report-images' 存储桶
  if (!supabaseUrl || !supabaseKey) {
    console.log('💡 未配置 Supabase 环境变量，跳过云端存储桶清理。');
    console.log('======================================');
    return;
  }

  try {
    const listUrl = `${supabaseUrl}/storage/v1/object/list/report-images`;
    
    // 2.1 获取桶内所有的文件列表
    const listRes = await fetch(listUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${supabaseKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        prefix: '',
        limit: 100,
        offset: 0,
        sortBy: { column: 'name', order: 'asc' }
      })
    });

    if (!listRes.ok) {
      throw new Error(`获取储存桶文件列表失败，状态码: ${listRes.status}`);
    }

    const files = await listRes.json();
    if (!Array.isArray(files) || files.length === 0) {
      console.log('✅ Supabase Storage 储存桶 report-images 目前已经是空的，无需清理！');
      console.log('======================================');
      return;
    }

    const fileNames = files.map(f => f.name).filter(Boolean);
    console.log(`正在从 Supabase 储存桶中清理以下文件 (${fileNames.length} 个):`, fileNames);

    // 2.2 批量调用 REST API 删除文件
    const deleteUrl = `${supabaseUrl}/storage/v1/object/remove/report-images`;
    const deleteRes = await fetch(deleteUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${supabaseKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        prefixes: fileNames
      })
    });

    if (!deleteRes.ok) {
      const errText = await deleteRes.text();
      throw new Error(`删除储存桶文件请求失败: ${errText}`);
    }

    console.log(`🎉 成功彻底清空 Supabase 储存桶 report-images 里的所有图片！`);

  } catch (err) {
    console.error('❌ 清理 Supabase 储存桶失败，详情:', err.message);
  }

  console.log('======================================');
}

main();
