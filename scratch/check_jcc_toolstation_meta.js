process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
const { Client } = require('pg');

const connectionString = 'postgresql://postgres:Shj553551@124.222.201.143:5432/postgres';

async function checkJccToolstationMeta() {
  const client = new Client({
    connectionString,
    connectionTimeoutMillis: 10000
  });

  try {
    await client.connect();
    console.log("Connected to DB.");

    // 1. 查找 JCC 和 Toolstation 报告
    const repRes = await client.query(`
      SELECT r.id, r.title, r.category, r.market_region, r.primary_entity_id, e.canonical_name, e.entity_type
      FROM reports r
      LEFT JOIN entities e ON r.primary_entity_id = e.id
      WHERE r.title LIKE '%J C C%' OR r.title LIKE '%JCC%' OR r.title LIKE '%Toolstation%'
    `);
    console.log("\n=== 1. JCC and Toolstation Reports & Primary Entities ===");
    console.table(repRes.rows);

    const reportIds = repRes.rows.map(r => r.id);

    // 2. 查找绑定的 Meta 行业标签 (report_industries)
    const indRes = await client.query(`
      SELECT ri.report_id, r.title, i.id AS industry_id, i.name AS industry_name
      FROM report_industries ri
      JOIN industries i ON ri.industry_id = i.id
      JOIN reports r ON ri.report_id = r.id
      WHERE ri.report_id = ANY($1)
    `, [reportIds]);
    console.log("\n=== 2. Report Meta Industries (report_industries) ===");
    console.table(indRes.rows);

    // 3. 查找 report_entities 中相互关联的实体及 role
    const reRes = await client.query(`
      SELECT re.report_id, r.title AS report_title, e.canonical_name, re.role, e.entity_type
      FROM report_entities re
      JOIN entities e ON re.entity_id = e.id
      JOIN reports r ON re.report_id = r.id
      WHERE re.report_id = ANY($1)
    `, [reportIds]);
    console.log("\n=== 3. Report Entities Mapping (report_entities) ===");
    console.table(reRes.rows);

    // 4. 查看当前 relations 表中它们之间的线条记录
    const relRes = await client.query(`
      SELECT r1.title AS a, r2.title AS b, rel.relation_key, rel.relation_type, rel.market_region
      FROM relations rel
      JOIN reports r1 ON rel.report_id_a = r1.id
      JOIN reports r2 ON rel.report_id_b = r2.id
      WHERE rel.report_id_a = ANY($1) AND rel.report_id_b = ANY($1)
    `, [reportIds]);
    console.log("\n=== 4. Relations Between JCC and Toolstation in DB ===");
    console.table(relRes.rows);

  } catch (err) {
    console.error("Meta Check Error:", err);
  } finally {
    await client.end();
  }
}

checkJccToolstationMeta();
