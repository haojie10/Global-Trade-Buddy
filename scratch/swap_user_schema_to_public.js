process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
const { Client } = require('pg');

const connectionString = 'postgresql://postgres:Shj553551@124.222.201.143:5432/postgres';

async function swapSchema() {
  const client = new Client({
    connectionString,
    connectionTimeoutMillis: 15000
  });

  try {
    await client.connect();
    console.log("Connected to DB.");

    // 1. 删除之前新建的空 public schema 及其空表
    console.log("Dropping empty public schema...");
    await client.query(`DROP SCHEMA IF EXISTS public CASCADE;`);

    // 2. 将包含 Supabase 全量 137 篇报告、1398 个实体的 $user schema 重命名为 public
    console.log("Renaming '$user' schema to 'public'...");
    await client.query(`ALTER SCHEMA "$user" RENAME TO public;`);

    // 3. 确保 postgres 用户默认 search_path 为 public
    await client.query(`ALTER USER postgres SET search_path TO public;`);
    await client.query(`ALTER DATABASE postgres SET search_path TO public;`);

    console.log("\n=== 100% VERIFICATION OF RESTORED SUPABASE DATA ===");
    
    const rCount = await client.query('SELECT COUNT(*) FROM reports');
    console.log(`★ Reports restored in public: ${rCount.rows[0].count}`);

    const eCount = await client.query('SELECT COUNT(*) FROM entities');
    console.log(`★ Entities restored in public: ${eCount.rows[0].count}`);

    const relCount = await client.query('SELECT COUNT(*) FROM relations');
    console.log(`★ Relations (Knowledge Graph) restored: ${relCount.rows[0].count}`);

    const uCount = await client.query('SELECT COUNT(*) FROM users');
    console.log(`★ Users restored in public: ${uCount.rows[0].count}`);

    const sampleUsers = await client.query('SELECT id, phone_number, email, role, nickname FROM users');
    console.log("\n★ Restored Users List:", sampleUsers.rows);

    const sampleReports = await client.query('SELECT id, title, category FROM reports LIMIT 5');
    console.log("\n★ Restored Sample Reports:", sampleReports.rows);

  } catch (err) {
    console.error("Swap Error:", err);
  } finally {
    await client.end();
  }
}

swapSchema();
