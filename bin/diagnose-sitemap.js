/**
 * Sitemap 数据库查询诊断脚本
 */
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

async function main() {
  console.log('--- 开始 Sitemap 数据库查询诊断 ---');
  console.log('DATABASE_URL 是否存在:', !!process.env.DATABASE_URL);
  
  let client;
  try {
    client = await pool.connect();
    console.log('✅ 数据库连接池成功连接！');

    const repCount = await client.query('SELECT count(*) FROM reports');
    console.log('📊 reports 表总记录数:', repCount.rows[0].count);

    const newsCount = await client.query('SELECT count(*) FROM news');
    console.log('📊 news 表总记录数:', newsCount.rows[0].count);

    const newsPubCount = await client.query("SELECT count(*) FROM news WHERE status = 'published'");
    console.log('📊 news (status=published) 记录数:', newsPubCount.rows[0].count);

    const reportsResult = await client.query('SELECT id, created_at FROM reports ORDER BY created_at DESC LIMIT 5');
    console.log('📋 reports 前 5 条数据示例:', reportsResult.rows);

  } catch (err) {
    console.error('❌ 查询发生错误:', err);
  } finally {
    if (client) client.release();
    await pool.end();
  }
}

main();
