/**
 * gc-storage.js — Storage 孤儿图片垃圾回收脚本（Mark-and-Sweep）
 *
 * 用法：
 *   node bin/gc-storage.js             # 执行清理
 *   node bin/gc-storage.js --dry-run   # 仅预览孤儿文件，不实际删除
 *
 * 工作原理：
 *   1. Mark 阶段：全量扫描数据库中所有包含图片引用的字段
 *      (reports.content_html / news.content / articles.content_html)
 *      汇总出所有"被引用"的文件名集合 referencedSet
 *   2. Sweep 阶段：列举存储桶中的所有文件（腾讯云 COS / CloudBase / Supabase）
 *      找出不在 referencedSet 中的孤儿文件
 *   3. Delete 阶段：批量删除孤儿文件（--dry-run 时仅打印不删除）
 */

const { Pool } = require('pg');
require('dotenv').config();

const isDryRun = process.argv.includes('--dry-run');

// ============================================================
// 从 HTML 字符串中提取所有 report-images 的文件名
// ============================================================
function extractStorageFileNames(html) {
  if (!html) return [];
  const regex = /report-images\/([a-zA-Z0-9_\-\.]+)/g;
  const files = [];
  let match;
  while ((match = regex.exec(html)) !== null) {
    files.push(match[1]);
  }
  return files;
}

function resolveProvider() {
  if (process.env.COS_BUCKET && process.env.COS_REGION && (process.env.COS_SECRET_ID || process.env.TCB_SECRET_ID)) {
    return 'cos';
  }
  if (process.env.TCB_ENV_ID && process.env.TCB_SECRET_ID && process.env.TCB_SECRET_KEY) {
    return 'cloudbase';
  }
  if (process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return 'supabase';
  }
  return null;
}

// ============================================================
// 腾讯云 COS 存储操作
// ============================================================
async function cosListAllFiles() {
  const COS = require('cos-nodejs-sdk-v5');
  const cos = new COS({
    SecretId: process.env.COS_SECRET_ID || process.env.TCB_SECRET_ID,
    SecretKey: process.env.COS_SECRET_KEY || process.env.TCB_SECRET_KEY,
  });
  const Bucket = process.env.COS_BUCKET;
  const Region = process.env.COS_REGION;

  let allFiles = [];
  let marker = undefined;
  let isTruncated = true;

  while (isTruncated) {
    const data = await new Promise((resolve, reject) => {
      cos.getBucket({
        Bucket,
        Region,
        Prefix: 'report-images/',
        MaxKeys: 1000,
        Marker: marker
      }, (err, res) => {
        if (err) return reject(err);
        resolve(res);
      });
    });

    if (data.Contents && data.Contents.length > 0) {
      for (const item of data.Contents) {
        if (item.Key && item.Key.startsWith('report-images/')) {
          const fileName = item.Key.slice('report-images/'.length);
          if (fileName) allFiles.push(fileName);
        }
      }
    }
    isTruncated = data.IsTruncated === 'true' || data.IsTruncated === true;
    marker = data.NextMarker;
  }
  return allFiles;
}

async function cosDeleteFiles(fileNames) {
  const COS = require('cos-nodejs-sdk-v5');
  const cos = new COS({
    SecretId: process.env.COS_SECRET_ID || process.env.TCB_SECRET_ID,
    SecretKey: process.env.COS_SECRET_KEY || process.env.TCB_SECRET_KEY,
  });
  const Bucket = process.env.COS_BUCKET;
  const Region = process.env.COS_REGION;

  const BATCH_SIZE = 100;
  let deletedCount = 0;
  for (let i = 0; i < fileNames.length; i += BATCH_SIZE) {
    const batch = fileNames.slice(i, i + BATCH_SIZE).map(f => ({ Key: `report-images/${f}` }));
    await new Promise((resolve, reject) => {
      cos.deleteMultipleObject({
        Bucket,
        Region,
        Objects: batch
      }, (err, data) => {
        if (err) {
          console.error(`   ❌ 第 ${Math.floor(i / BATCH_SIZE) + 1} 批删除失败: ${err.message}`);
          return reject(err);
        }
        deletedCount += batch.length;
        console.log(`   ✅ 第 ${Math.floor(i / BATCH_SIZE) + 1} 批 ${batch.length} 张已删除`);
        resolve(data);
      });
    });
  }
  return deletedCount;
}

// ============================================================
// CloudBase 存储操作（兼容旧环境）
// ============================================================
async function cloudbaseListAllFiles() {
  const CloudBase = require('@cloudbase/manager-node');
  const { storage } = new CloudBase({
    secretId: process.env.TCB_SECRET_ID,
    secretKey: process.env.TCB_SECRET_KEY,
    envId: process.env.TCB_ENV_ID,
  });
  const items = await storage.listDirectoryFiles('report-images');
  const names = [];
  for (const item of items || []) {
    const key = item.Key || item.key || item.cloudPath || item.name;
    if (key && key.startsWith('report-images/')) {
      names.push(key.slice('report-images/'.length));
    }
  }
  return names;
}

async function cloudbaseDeleteFiles(fileNames) {
  const CloudBase = require('@cloudbase/manager-node');
  const { storage } = new CloudBase({
    secretId: process.env.TCB_SECRET_ID,
    secretKey: process.env.TCB_SECRET_KEY,
    envId: process.env.TCB_ENV_ID,
  });
  const BATCH_SIZE = 100;
  let deletedCount = 0;
  for (let i = 0; i < fileNames.length; i += BATCH_SIZE) {
    const batch = fileNames.slice(i, i + BATCH_SIZE).map(f => `report-images/${f}`);
    try {
      await storage.deleteFile(batch);
      deletedCount += batch.length;
      console.log(`   ✅ 第 ${Math.floor(i / BATCH_SIZE) + 1} 批 ${batch.length} 张已删除`);
    } catch (err) {
      console.error(`   ❌ 第 ${Math.floor(i / BATCH_SIZE) + 1} 批删除失败: ${err.message}`);
    }
  }
  return deletedCount;
}

// ============================================================
// Supabase 存储操作（兼容旧环境）
// ============================================================
function getSupabaseClient() {
  const { createClient } = require('@supabase/supabase-js');
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { persistSession: false } }
  );
}

async function supabaseListAllFiles() {
  const supabase = getSupabaseClient();
  const allFiles = [];
  let offset = 0;
  const pageSize = 100;

  while (true) {
    const { data: files, error: listError } = await supabase
      .storage
      .from('report-images')
      .list('', { limit: pageSize, offset, sortBy: { column: 'name', order: 'asc' } });

    if (listError) {
      throw new Error(`列举 Storage 文件失败: ${listError.message}`);
    }
    if (!files || files.length === 0) break;

    allFiles.push(...files.map(f => f.name).filter(Boolean));
    if (files.length < pageSize) break;
    offset += pageSize;
  }
  return allFiles;
}

async function supabaseDeleteFiles(fileNames) {
  const supabase = getSupabaseClient();
  let deletedCount = 0;
  const BATCH_SIZE = 100;

  for (let i = 0; i < fileNames.length; i += BATCH_SIZE) {
    const batch = fileNames.slice(i, i + BATCH_SIZE);
    const { error: removeError } = await supabase
      .storage
      .from('report-images')
      .remove(batch);

    if (removeError) {
      console.error(`   ❌ 第 ${Math.floor(i / BATCH_SIZE) + 1} 批删除失败: ${removeError.message}`);
    } else {
      deletedCount += batch.length;
      console.log(`   ✅ 第 ${Math.floor(i / BATCH_SIZE) + 1} 批 ${batch.length} 张已删除`);
    }
  }
  return deletedCount;
}

async function listFiles(provider) {
  if (provider === 'cos') return await cosListAllFiles();
  if (provider === 'cloudbase') return await cloudbaseListAllFiles();
  if (provider === 'supabase') return await supabaseListAllFiles();
  return [];
}

async function deleteFiles(provider, fileNames) {
  if (provider === 'cos') return await cosDeleteFiles(fileNames);
  if (provider === 'cloudbase') return await cloudbaseDeleteFiles(fileNames);
  if (provider === 'supabase') return await supabaseDeleteFiles(fileNames);
  return 0;
}

async function main() {
  const provider = resolveProvider();
  const dbUrl = process.env.DATABASE_URL;

  if (!provider) {
    console.error('❌ 缺少存储环境变量。请配置其一：');
    console.error('   - 腾讯云 COS: COS_BUCKET / COS_REGION / COS_SECRET_ID / COS_SECRET_KEY');
    console.error('   - CloudBase: TCB_ENV_ID / TCB_SECRET_ID / TCB_SECRET_KEY');
    console.error('   - Supabase : NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY');
    process.exit(1);
  }
  if (!dbUrl) {
    console.error('❌ 缺少数据库环境变量 (DATABASE_URL)');
    process.exit(1);
  }

  const providerNames = {
    cos: '腾讯云 COS 对象存储',
    cloudbase: '腾讯云 CloudBase 云存储',
    supabase: 'Supabase Storage'
  };

  console.log('');
  console.log('╔══════════════════════════════════════════════════════╗');
  console.log('║       Storage GC — 孤儿图片垃圾回收脚本              ║');
  console.log(`║       存储提供方: ${(providerNames[provider] || provider).padEnd(20)} ║`);
  console.log(`║       模式: ${isDryRun ? '🔍 DRY-RUN（仅预览）           ' : '🗑️  LIVE（正式删除）             '}║`);
  console.log('╚══════════════════════════════════════════════════════╝');
  console.log('');

  const pool = new Pool({
    connectionString: dbUrl,
    ssl: { rejectUnauthorized: false },
    max: 1,
  });

  let dbClient;
  try {
    dbClient = await pool.connect();

    // ====================================================
    // Phase 1: MARK — 扫描数据库，构建被引用文件集合
    // ====================================================
    console.log('📊 Phase 1: MARK — 扫描数据库中的图片引用...');
    const referencedSet = new Set();

    // 1a. reports.content_html
    const reportsRes = await dbClient.query(
      `SELECT content_html FROM reports WHERE content_html LIKE '%report-images/%'`
    );
    for (const row of reportsRes.rows) {
      for (const f of extractStorageFileNames(row.content_html)) {
        referencedSet.add(f);
      }
    }
    console.log(`   ✅ reports 表扫描完成，共 ${reportsRes.rows.length} 条记录含图片引用`);

    // 1b. news.content
    try {
      const newsRes = await dbClient.query(
        `SELECT content FROM news WHERE content LIKE '%report-images/%'`
      );
      for (const row of newsRes.rows) {
        for (const f of extractStorageFileNames(row.content)) {
          referencedSet.add(f);
        }
      }
      console.log(`   ✅ news 表扫描完成，共 ${newsRes.rows.length} 条记录含图片引用`);
    } catch (err) {
      // 表可能不存在，跳过
    }

    // 1c. articles.content_html
    try {
      const articlesRes = await dbClient.query(
        `SELECT content_html FROM articles WHERE content_html LIKE '%report-images/%'`
      );
      for (const row of articlesRes.rows) {
        for (const f of extractStorageFileNames(row.content_html)) {
          referencedSet.add(f);
        }
      }
      console.log(`   ✅ articles 表扫描完成，共 ${articlesRes.rows.length} 条记录含图片引用`);
    } catch (err) {
      // 表可能不存在，跳过
    }

    console.log(`\n   📌 数据库中被引用的图片总计: ${referencedSet.size} 张\n`);

    // ====================================================
    // Phase 2: SWEEP — 枚举 Storage 桶中的所有文件
    // ====================================================
    console.log('📦 Phase 2: SWEEP — 枚举 Storage 文件...');
    const allStorageFiles = await listFiles(provider);

    console.log(`   ✅ Storage 中文件总计: ${allStorageFiles.length} 张\n`);

    // ====================================================
    // Phase 3: 找出孤儿文件
    // ====================================================
    const orphaned = allStorageFiles.filter(f => !referencedSet.has(f));
    const kept = allStorageFiles.length - orphaned.length;

    console.log('📋 扫描结果汇总:');
    console.log(`   Storage 总图片数     : ${allStorageFiles.length}`);
    console.log(`   数据库有引用         : ${kept}`);
    console.log(`   孤儿图片（待清理）   : ${orphaned.length}`);
    console.log('');

    if (orphaned.length === 0) {
      console.log('🎉 太棒了！Storage 中没有孤儿图片，无需清理。');
      return;
    }

    // 列出所有孤儿文件
    console.log('🗂️  孤儿文件列表:');
    orphaned.forEach((f, i) => console.log(`   [${i + 1}] ${f}`));
    console.log('');

    if (isDryRun) {
      console.log('🔍 DRY-RUN 模式：以上文件将被删除，本次不执行任何实际操作。');
      console.log('   运行 node bin/gc-storage.js 执行正式清理。');
      return;
    }

    // ====================================================
    // Phase 4: DELETE — 分批删除孤儿文件
    // ====================================================
    console.log('🗑️  Phase 4: DELETE — 开始删除孤儿文件...');
    const deletedCount = await deleteFiles(provider, orphaned);

    console.log('');
    console.log(`🎉 GC 完成！共清理孤儿图片 ${deletedCount} / ${orphaned.length} 张`);

  } catch (err) {
    console.error('\n❌ GC 脚本执行出错:', err.message);
    process.exit(1);
  } finally {
    if (dbClient) dbClient.release();
    await pool.end();
  }
}

main();
