process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
const { Client } = require('pg');

const connectionString = 'postgresql://postgres:Shj553551@124.222.201.143:5432/postgres';

async function diagnose() {
  const client = new Client({
    connectionString,
    connectionTimeoutMillis: 10000
  });

  try {
    await client.connect();
    console.log("Connected to DB.");

    // 1. 查看 report_entities 表中 role 的分布情况
    const reRoles = await client.query(`
      SELECT role, COUNT(*) 
      FROM report_entities 
      GROUP BY role;
    `);
    console.log("\n=== 1. report_entities Grouped by Role ===");
    console.table(reRoles.rows);

    // 2. 查看 entities 表中 entity_type 的分布情况
    const eTypes = await client.query(`
      SELECT entity_type, COUNT(*) 
      FROM entities 
      GROUP BY entity_type;
    `);
    console.log("\n=== 2. entities Grouped by entity_type ===");
    console.table(eTypes.rows);

    // 3. 检查有没有 role 为 competitor 或 supplier 的记录
    const compSample = await client.query(`
      SELECT re.report_id, r.title AS report_title, e.canonical_name, re.role, e.entity_type
      FROM report_entities re
      JOIN entities e ON re.entity_id = e.id
      JOIN reports r ON re.report_id = r.id
      WHERE re.role IN ('competitor', 'supplier', 'customer') OR e.entity_type IN ('competitor', 'supplier', 'customer')
      LIMIT 20;
    `);
    console.log("\n=== 3. Sample Competitor/Supplier Entity Roles ===");
    console.table(compSample.rows);

  } catch (err) {
    console.error("Diagnosis Error:", err);
  } finally {
    await client.end();
  }
}

diagnose();
