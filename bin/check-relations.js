const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function main() {
  const eid = '2f1336ba-8cf5-408d-a259-85487d52cdc6';
  
  // 1. Entities linked to EDEKA
  const rels = await pool.query(
    'SELECT er.relation_type, er.market_region, ea.canonical_name as from_name, ea.entity_type as from_type, eb.canonical_name as to_name, eb.entity_type as to_type ' +
    'FROM entity_relations er ' +
    'JOIN entities ea ON er.entity_id_a = ea.id ' +
    'JOIN entities eb ON er.entity_id_b = eb.id ' +
    'WHERE er.entity_id_a = $1 OR er.entity_id_b = $1',
    [eid]
  );
  
  console.log('=== RELATIONS DIRECTLY LINKED TO EDEKA ZENTRALE (' + rels.rows.length + ') ===');
  rels.rows.forEach(r => {
    console.log(`[${r.relation_type}] ${r.from_name} (${r.from_type}) <--> ${r.to_name} (${r.to_type}) [Region: ${r.market_region}]`);
  });

  // 2. All entities created around the same timestamp as EDEKA upload (2026-08-08 02:12:25)
  const recentEntities = await pool.query(
    "SELECT id, canonical_name, entity_type, website, created_at FROM entities WHERE created_at >= '2026-08-08 00:00:00' ORDER BY created_at ASC"
  );
  console.log('\n=== ALL ENTITIES CREATED WITH THIS REPORT (' + recentEntities.rows.length + ') ===');
  recentEntities.rows.forEach(e => {
    console.log(`- [${e.entity_type}] ${e.canonical_name} (Website: ${e.website || 'none'})`);
  });

  await pool.end();
}

main();
