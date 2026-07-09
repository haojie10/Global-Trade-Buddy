const { Client } = require('pg');
require('dotenv').config();

async function main() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL
  });

  await client.connect();
  console.log('====== 开始修复数据库 constraints 约束 ======');

  try {
    // 1. 去重 relations 表里的历史重复数据，防止添加 UNIQUE 唯一约束失败
    console.log('1. 正在去重 relations 表中的历史冲突行...');
    const deleteDupRes = await client.query(`
      DELETE FROM relations 
      WHERE ctid NOT IN (
        SELECT MIN(ctid) 
        FROM relations 
        GROUP BY report_id_a, report_id_b, relation_key
      );
    `);
    console.log(`   去重成功，删除了 ${deleteDupRes.rowCount || 0} 行冗余冲突行。`);

    // 2. 为 relations 表加上唯一约束 relations_unique
    console.log('2. 正在为 relations 表添加 relations_unique (report_id_a, report_id_b, relation_key) 唯一约束...');
    
    // 先检查是否已经存在了该约束，如果存在就先删了重建，确保万无一失
    await client.query('ALTER TABLE relations DROP CONSTRAINT IF EXISTS relations_unique');
    await client.query(`
      ALTER TABLE relations 
      ADD CONSTRAINT relations_unique 
      UNIQUE (report_id_a, report_id_b, relation_key);
    `);
    console.log('   唯一约束 relations_unique 建立完毕！');

    console.log('🎉 数据库约束修复大获成功！');
  } catch (err) {
    console.error('❌ 修复失败，错误信息:', err.message);
  } finally {
    await client.end();
  }
}

main();
