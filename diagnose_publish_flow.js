const { Client } = require('pg');
require('dotenv').config();

const client = new Client({ connectionString: process.env.DATABASE_URL });

async function diagnose() {
  await client.connect();

  console.log('=== LATEST REPORTS IN DB ===');
  const repRes = await client.query(`
    SELECT id, title, category, market_region, primary_entity_id, created_at
    FROM reports
    ORDER BY created_at DESC
    LIMIT 5
  `);
  console.table(repRes.rows);

  for (const r of repRes.rows) {
    console.log(`\n--- Report ID: ${r.id} ---`);
    console.log('Title:', r.title);
    console.log('Category:', r.category);
    console.log('Primary Entity ID:', r.primary_entity_id);

    const primaryEntRes = await client.query(`
      SELECT re.role, e.id AS entity_id, e.canonical_name, e.entity_type
      FROM report_entities re
      JOIN entities e ON re.entity_id = e.id
      WHERE re.report_id = $1 AND re.role = 'primary'
    `, [r.id]);
    console.log('Primary Entities in report_entities:', primaryEntRes.rows);
  }

  await client.end();
}

diagnose().catch(console.error);
