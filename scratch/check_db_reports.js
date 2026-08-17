const { Pool } = require('pg');

const pool = new Pool({
  connectionString: 'postgresql://postgres:Shj553551@124.222.201.143:5432/postgres'
});

async function check() {
  try {
    const res = await pool.query("SELECT id, title, category, market_region, created_at FROM reports WHERE title ILIKE '%Liverpool%' OR title ILIKE '%电饭锅%' ORDER BY created_at DESC");
    console.log('Reports in DB:', JSON.stringify(res.rows, null, 2));

    const reqRes = await pool.query("SELECT id, contact_email, request_type, status, report_id FROM custom_report_requests ORDER BY created_at DESC LIMIT 5");
    console.log('Custom Requests in DB:', JSON.stringify(reqRes.rows, null, 2));
  } catch (e) {
    console.error('Query error:', e);
  } finally {
    await pool.end();
  }
}

check();
