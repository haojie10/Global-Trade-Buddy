process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
const { Client } = require('pg');

const connectionString = 'postgresql://postgres:Shj553551@124.222.201.143:5432/postgres';

async function checkPearlToolstation() {
  const client = new Client({
    connectionString,
    connectionTimeoutMillis: 10000
  });

  try {
    await client.connect();
    console.log("Connected to DB.");

    // 1. 获取 Pearl 和 Toolstation 报告详情
    const repRes = await client.query(`
      SELECT r.id, r.title, r.category, r.market_region
      FROM reports r
      WHERE r.title LIKE '%PEARL%' OR r.title LIKE '%Toolstation%'
    `);
    console.log("\n=== 1. Reports Found ===");
    console.table(repRes.rows);

    const reportIds = repRes.rows.map(r => r.id);

    // 2. 查看各自绑定的 report_industries
    const indRes = await client.query(`
      SELECT ri.report_id, r.title, i.name AS industry_name
      FROM report_industries ri
      JOIN industries i ON ri.industry_id = i.id
      JOIN reports r ON ri.report_id = r.id
      WHERE ri.report_id = ANY($1)
    `, [reportIds]);
    console.log("\n=== 2. Report Industries Bindings ===");
    console.table(indRes.rows);

    // 3. 查看 Pearl 和 Toolstation 之间在 relations 表里的记录
    const relRes = await client.query(`
      SELECT r1.title AS report_a, r2.title AS report_b, rel.relation_key, rel.relation_type, rel.market_region
      FROM relations rel
      JOIN reports r1 ON rel.report_id_a = r1.id
      JOIN reports r2 ON rel.report_id_b = r2.id
      WHERE rel.report_id_a = ANY($1) AND rel.report_id_b = ANY($1)
    `, [reportIds]);
    console.log("\n=== 3. Relations Between Pearl and Toolstation ===");
    console.table(relRes.rows);

  } catch (err) {
    console.error("Error:", err);
  } finally {
    await client.end();
  }
}

checkPearlToolstation();
