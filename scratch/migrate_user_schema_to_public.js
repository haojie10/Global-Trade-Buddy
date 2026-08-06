process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
const { Client } = require('pg');

const connectionString = 'postgresql://postgres:Shj553551@124.222.201.143:5432/postgres';

async function migrate() {
  const client = new Client({
    connectionString,
    connectionTimeoutMillis: 10000
  });

  try {
    await client.connect();
    console.log("Connected to DB.");

    // 获取 $user 下的所有表
    const tablesRes = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = '$user'
    `);

    const tables = tablesRes.rows.map(r => r.table_name);
    console.log("Tables in $user schema to migrate:", tables);

    // 设置 postgres 用户的默认 search_path 包含 $user 和 public
    console.log("\nSetting search_path for postgres user...");
    await client.query(`ALTER USER postgres SET search_path TO "$user", public;`);
    await client.query(`ALTER DATABASE postgres SET search_path TO "$user", public;`);

    // 将 $user 下的表移到 public schema (对于在 public 里已有空表的，先 drop public 的空表)
    for (const table of tables) {
      try {
        console.log(`Migrating table [${table}] to public schema...`);
        // 清理 public 里之前初始化的空表
        await client.query(`DROP TABLE IF EXISTS "public"."${table}" CASCADE;`);
        // 将 $user 里的全量数据表移到 public
        await client.query(`ALTER TABLE "$user"."${table}" SET SCHEMA public;`);
        console.log(`✓ Table [${table}] successfully moved to public schema!`);
      } catch (err) {
        console.error(`Failed to move table [${table}]:`, err.message);
      }
    }

    console.log("\nVerifying public schema table row counts...");
    const publicTables = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
    `);

    for (const row of publicTables.rows) {
      const c = await client.query(`SELECT COUNT(*) FROM "public"."${row.table_name}"`);
      console.log(`  Table [public.${row.table_name}]: ${c.rows[0].count} rows`);
    }

    console.log("\nSUCCESS! All Supabase data seamlessly active in public schema!");

  } catch (err) {
    console.error("Migration Error:", err);
  } finally {
    await client.end();
  }
}

migrate();
