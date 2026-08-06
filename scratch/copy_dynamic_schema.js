process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
const { Client } = require('pg');

const connectionString = 'postgresql://postgres:Shj553551@124.222.201.143:5432/postgres';

async function copyDynamic() {
  const client = new Client({
    connectionString,
    connectionTimeoutMillis: 15000
  });

  try {
    await client.connect();
    console.log("Connected to DB.");

    // 获取有数据的非 public 表及其 schema
    const tablesRes = await client.query(`
      SELECT table_schema, table_name 
      FROM information_schema.tables 
      WHERE table_schema NOT IN ('pg_catalog', 'information_schema', 'public', 'test_schema', 'storage', 'auth', 'realtime', 'graphql', 'extensions', 'pgbouncer')
    `);

    console.log("Found source tables:", tablesRes.rows);

    for (const row of tablesRes.rows) {
      const sName = row.table_schema;
      const tName = row.table_name;

      try {
        const countRes = await client.query(`SELECT COUNT(*) FROM "${sName}"."${tName}"`);
        const count = parseInt(countRes.rows[0].count, 10);
        console.log(`Table ["${sName}"."${tName}"] has ${count} rows.`);

        if (count > 0) {
          // 尝试插入到 public."${tName}"
          try {
            await client.query(`INSERT INTO "public"."${tName}" SELECT * FROM "${sName}"."${tName}" ON CONFLICT DO NOTHING;`);
            const pCount = await client.query(`SELECT COUNT(*) FROM "public"."${tName}"`);
            console.log(`  └─> SUCCESS! Migrated ${pCount.rows[0].count} rows into [public.${tName}]!`);
          } catch (e) {
            console.log(`  └─> Insert failed for public.${tName}:`, e.message);
          }
        }
      } catch (err) {
        console.log(`  Error querying ["${sName}"."${tName}"]:`, err.message);
      }
    }

    console.log("\n=== FINAL VERIFICATION FOR PUBLIC SCHEMA ===");
    const rCount = await client.query('SELECT COUNT(*) FROM "public"."reports"');
    console.log(`✓ Reports in public: ${rCount.rows[0].count}`);

    const eCount = await client.query('SELECT COUNT(*) FROM "public"."entities"');
    console.log(`✓ Entities in public: ${eCount.rows[0].count}`);

    const relCount = await client.query('SELECT COUNT(*) FROM "public"."relations"');
    console.log(`✓ Relations in public: ${relCount.rows[0].count}`);

    const uCount = await client.query('SELECT COUNT(*) FROM "public"."users"');
    console.log(`✓ Users in public: ${uCount.rows[0].count}`);

  } catch (err) {
    console.error("Copy Dynamic Error:", err);
  } finally {
    await client.end();
  }
}

copyDynamic();
