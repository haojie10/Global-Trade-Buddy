process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
const { Client } = require('pg');

const baseConnStr = 'postgresql://postgres:Shj553551@124.222.201.143:5432';

async function scan() {
  const client = new Client({
    connectionString: `${baseConnStr}/postgres`,
    connectionTimeoutMillis: 5000
  });

  try {
    await client.connect();
    console.log("Connected to PostgreSQL server!");

    // 1. 扫描服务器上所有的 Databse 名称
    const dbsRes = await client.query("SELECT datname FROM pg_database WHERE datistemplate = false;");
    console.log("\nDatabases in Server:", dbsRes.rows.map(r => r.datname));

    // 2. 扫描当前数据库中所有的 Schemas
    const schemasRes = await client.query("SELECT schema_name FROM information_schema.schemata;");
    console.log("Schemas in postgres DB:", schemasRes.rows.map(r => r.schema_name));

    for (const dbRow of dbsRes.rows) {
      const dbName = dbRow.datname;
      const subClient = new Client({
        connectionString: `${baseConnStr}/${dbName}`,
        connectionTimeoutMillis: 5000
      });
      try {
        await subClient.connect();
        const tables = await subClient.query(`
          SELECT table_schema, table_name 
          FROM information_schema.tables 
          WHERE table_schema NOT IN ('pg_catalog', 'information_schema')
        `);
        console.log(`\n--- DB: [${dbName}] has ${tables.rows.length} tables ---`);
        for (const t of tables.rows) {
          try {
            const countRes = await subClient.query(`SELECT COUNT(*) FROM "${t.table_schema}"."${t.table_name}"`);
            console.log(`  Table [${t.table_schema}.${t.table_name}]: ${countRes.rows[0].count} rows`);
          } catch(e) {}
        }
      } catch(e) {
        console.log(`  Could not connect to DB [${dbName}]:`, e.message);
      } finally {
        await subClient.end();
      }
    }

  } catch (err) {
    console.error("Scan error:", err.message);
  } finally {
    await client.end();
  }
}

scan();
