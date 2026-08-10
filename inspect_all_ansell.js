const { Client } = require('pg');
require('dotenv').config();

const client = new Client({ connectionString: process.env.DATABASE_URL });

async function inspectAll() {
  await client.connect();

  console.log('=== CURRENT ALL ANSELL REPORTS IN DATABASE ===');
  const repRes = await client.query(`
    SELECT id, title, category, market_region, primary_entity_id, created_at
    FROM reports
    WHERE title LIKE '%Ansell%' OR summary LIKE '%Ansell%'
    ORDER BY created_at ASC
  `);
  console.table(repRes.rows);

  for (const r of repRes.rows) {
    console.log(`\n--- Report ID: ${r.id} ---`);
    console.log('Title:', r.title);
    console.log('Category:', r.category);
    console.log('Primary Entity ID:', r.primary_entity_id);
    
    // 查询该报告关联的 role='primary' 的实体
    const primaryEntRes = await client.query(`
      SELECT re.role, e.id AS entity_id, e.canonical_name, e.entity_type
      FROM report_entities re
      JOIN entities e ON re.entity_id = e.id
      WHERE re.report_id = $1 AND re.role = 'primary'
    `, [r.id]);
    console.log('Primary Entities in report_entities:', primaryEntRes.rows);

    // 查询该报告关联的所有实体 count
    const allEnts = await client.query(`
      SELECT re.role, e.canonical_name
      FROM report_entities re
      JOIN entities e ON re.entity_id = e.id
      WHERE re.report_id = $1
    `, [r.id]);
    console.log('All Entities count:', allEnts.rows.length);
  }

  await client.end();
}

inspectAll().catch(console.error);
