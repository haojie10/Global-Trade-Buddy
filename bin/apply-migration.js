const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');
require('dotenv').config();

const connectionString = process.env.DATABASE_URL;
console.log('Connecting to:', connectionString ? 'Database URL found' : 'No Database URL');

const pool = new Pool({
  connectionString,
  ssl: { rejectUnauthorized: false }
});

async function run() {
  const sqlPath = path.join(__dirname, '../supabase/migrations/20260712000000_admin_dashboard_schema.sql');
  const sql = fs.readFileSync(sqlPath, 'utf8');

  console.log('Applying migration...');
  try {
    await pool.query(sql);
    console.log('Migration applied successfully!');
  } catch (err) {
    console.error('Error applying migration:', err);
  } finally {
    await pool.end();
  }
}

run();
