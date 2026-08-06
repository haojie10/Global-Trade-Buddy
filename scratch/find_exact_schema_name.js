process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
const { Client } = require('pg');

const connectionString = 'postgresql://postgres:Shj553551@124.222.201.143:5432/postgres';

async function findExact() {
  const client = new Client({
    connectionString,
    connectionTimeoutMillis: 10000
  });

  try {
    await client.connect();
    console.log("Connected to DB.");

    const res = await client.query("SELECT oid, nspname FROM pg_namespace WHERE nspname NOT LIKE 'pg_%' AND nspname != 'information_schema';");
    console.log("All schemas in pg_namespace:", res.rows);

    for (const row of res.rows) {
      const sName = row.nspname;
      const countRes = await client.query(`SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = $1`, [sName]);
      console.log(`Schema [${sName}] (oid: ${row.oid}) has ${countRes.rows[0].count} tables.`);
    }

  } catch (err) {
    console.error("Error:", err);
  } finally {
    await client.end();
  }
}

findExact();
