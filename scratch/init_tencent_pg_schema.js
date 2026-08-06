process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
const fs = require('fs');
const path = require('path');
const { Client } = require('pg');

const connectionString = 'postgresql://postgres:Shj553551@124.222.201.143:5432/postgres';

async function initSchema() {
  const client = new Client({
    connectionString,
    connectionTimeoutMillis: 10000
  });

  try {
    console.log("Connecting to Tencent Cloud PostgreSQL...");
    await client.connect();
    console.log("Connected!");

    const sqlPath = path.join(__dirname, '../init_tencent_db.sql');
    const sql = fs.readFileSync(sqlPath, 'utf8');

    console.log("Executing init_tencent_db.sql...");
    await client.query(sql);
    console.log("Schema initialized successfully!");

    const tablesRes = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
    `);
    console.log("\nNew Tables created:", tablesRes.rows.map(r => r.table_name));

    const userRes = await client.query("SELECT id, phone_number, email, role, nickname FROM users");
    console.log("\nDefault Admin Users:", userRes.rows);

  } catch (err) {
    console.error("Init Error:", err);
  } finally {
    await client.end();
  }
}

initSchema();
