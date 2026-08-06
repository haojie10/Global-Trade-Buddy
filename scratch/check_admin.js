require('dotenv').config();
const { Pool } = require('pg');

async function checkAdminUser() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: false
  });

  try {
    const client = await pool.connect();
    const res = await client.query('SELECT id, phone_number, email, role, nickname FROM users WHERE email = $1 OR role = $2', ['admin@gtb.com', 'admin']);
    console.log('--- Admin User Check ---');
    console.log(res.rows);
    client.release();
  } catch (err) {
    console.error('Database connection error:', err);
  } finally {
    await pool.end();
  }
}

checkAdminUser();
