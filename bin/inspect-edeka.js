const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function main() {
  const repRes = await pool.query("SELECT id, title, category, market_region, summary FROM reports WHERE title ILIKE '%EDEKA%' OR summary ILIKE '%EDEKA%' ORDER BY created_at DESC LIMIT 1");
  if (repRes.rows.length === 0) {
    console.log('No EDEKA report found in DB.');
    return;
  }

  const report = repRes.rows[0];
  console.log('=== REPORT BASE ===');
  console.log('ID:', report.id);
  console.log('Title:', report.title);
  console.log('Category:', report.category);
  console.log('Market Region:', report.market_region);
  console.log('Summary:', report.summary);

  // Check report_industries
  const indRes = await pool.query(`
    SELECT i.id, i.name 
    FROM industries i 
    JOIN report_industries ri ON i.id = ri.industry_id 
    WHERE ri.report_id = $1
  `, [report.id]);
  console.log('\n=== LINKED INDUSTRIES (report_industries) ===');
  console.log(indRes.rows);

  // Check report_countries
  const ctyRes = await pool.query(`
    SELECT c.id, c.name, c.region, c.code 
    FROM countries c 
    JOIN report_countries rc ON c.id = rc.country_id 
    WHERE rc.report_id = $1
  `, [report.id]);
  console.log('\n=== LINKED COUNTRIES (report_countries) ===');
  console.log(ctyRes.rows);

  // Check entity relations or entities in entities table
  try {
    const entRes = await pool.query(`
      SELECT e.id, e.canonical_name, e.entity_type, e.market_region, er.relation_type, er.weight
      FROM entities e
      LEFT JOIN entity_relations er ON (er.source_entity_id = e.id OR er.target_entity_id = e.id)
      WHERE e.canonical_name ILIKE '%EDEKA%' OR e.aliases::text ILIKE '%EDEKA%'
    `);
    console.log('\n=== ENTITIES & RELATIONS ===');
    console.log(entRes.rows);
  } catch(e) {
    console.log('Entities query error:', e.message);
  }

  // Check any other tables with report_id
  const tables = ['articles', 'page_views'];
  for (const t of tables) {
    try {
      const r = await pool.query(`SELECT count(*) FROM ${t} WHERE report_id = $1`, [report.id]);
      console.log(`\n=== Table ${t} count:`, r.rows[0].count);
    } catch(e) {}
  }

  await pool.end();
}

main();
