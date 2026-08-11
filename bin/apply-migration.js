const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');
require('dotenv').config();

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  console.error('[ERROR] .env 中未找到 DATABASE_URL，无法连接到数据库');
  process.exit(1);
}

console.log('Connecting to Database...');

const pool = new Pool({
  connectionString,
  ssl: undefined
});

async function run() {
  // 获取指定的 migration 文件名称（默认为最新的 20260804000000_database_cleanup_and_aggregation.sql）
  const targetFileName = process.argv[2] || '20260804000000_database_cleanup_and_aggregation.sql';
  const sqlPath = path.join(__dirname, '../supabase/migrations', targetFileName);

  if (!fs.existsSync(sqlPath)) {
    console.error(`[ERROR] 找不到指定的 Migration 文件: ${sqlPath}`);
    process.exit(1);
  }

  console.log(`Applying migration file [${targetFileName}] to database...`);
  const sql = fs.readFileSync(sqlPath, 'utf8');

  try {
    await pool.query(sql);
    console.log(`✅ 成功将 [${targetFileName}] 应用至生产数据库！`);
  } catch (err) {
    console.error('❌ 执行 Migration 失败:', err.message);
  } finally {
    await pool.end();
  }
}

run();
