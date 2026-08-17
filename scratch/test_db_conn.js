const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  connectionTimeoutMillis: 10000,
  keepAlive: true
});

async function main() {
  console.log('Connecting to DATABASE_URL:', process.env.DATABASE_URL.replace(/:[^:]+@/, ':***@'));
  try {
    const res = await pool.query('SELECT count(*) FROM users;');
    console.log('✅ Connection Success! User count:', res.rows[0].count);
  } catch (err) {
    console.error('❌ Connection Failed:', err.message);
  } finally {
    await pool.end();
  }
}

main();
