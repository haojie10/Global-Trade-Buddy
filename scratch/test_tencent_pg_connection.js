process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
const { Client } = require('pg');

const connectionString = 'postgresql://postgres:Shj553551@124.222.201.143:5432/postgres';

async function test() {
  const client = new Client({
    connectionString,
    connectionTimeoutMillis: 5000
  });

  try {
    console.log("Connecting to Tencent Cloud PostgreSQL...");
    await client.connect();
    console.log("Connected successfully!");

    const tablesRes = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
    `);
    console.log("Tables in database:", tablesRes.rows.map(r => r.table_name));

    const userCountRes = await client.query('SELECT COUNT(*) FROM users');
    console.log("Users count in DB:", userCountRes.rows[0].count);

  } catch (err) {
    console.error("Connection error:", err.message);
  } finally {
    await client.end();
  }
}

test();
