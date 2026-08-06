process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
const { Client } = require('pg');

const connectionString = 'postgresql://postgres:Shj553551@124.222.201.143:5432/postgres';

async function renameByOid() {
  const client = new Client({
    connectionString,
    connectionTimeoutMillis: 10000
  });

  try {
    await client.connect();
    console.log("Connected to DB.");

    // 获取真实的 nspname
    const res = await client.query("SELECT nspname FROM pg_namespace WHERE oid = 16469;");
    const exactName = res.rows[0].nspname;
    console.log("Target Schema Name:", JSON.stringify(exactName));

    // 使用 quote_ident 动态构造 RENAME 语句
    const renameQuery = `ALTER SCHEMA ${await quoteIdent(client, exactName)} RENAME TO public;`;
    console.log("Executing SQL:", renameQuery);
    
    await client.query(renameQuery);
    console.log("★ SUCCESS! Schema successfully renamed to 'public'!");

    console.log("\n=== 100% VERIFICATION OF RESTORED SUPABASE DATA ===");
    
    const rCount = await client.query('SELECT COUNT(*) FROM public.reports');
    console.log(`★ Reports in public: ${rCount.rows[0].count}`);

    const eCount = await client.query('SELECT COUNT(*) FROM public.entities');
    console.log(`★ Entities in public: ${eCount.rows[0].count}`);

    const relCount = await client.query('SELECT COUNT(*) FROM public.relations');
    console.log(`★ Relations (Knowledge Graph): ${relCount.rows[0].count}`);

    const uCount = await client.query('SELECT COUNT(*) FROM public.users');
    console.log(`★ Users in public: ${uCount.rows[0].count}`);

    const sampleUsers = await client.query('SELECT id, phone_number, email, role, nickname FROM public.users');
    console.log("\n★ Restored Users List:", sampleUsers.rows);

    const sampleReports = await client.query('SELECT id, title, category FROM public.reports LIMIT 5');
    console.log("\n★ Restored Sample Reports:", sampleReports.rows);

  } catch (err) {
    console.error("Rename Error:", err);
  } finally {
    await client.end();
  }
}

async function quoteIdent(client, str) {
  const res = await client.query("SELECT quote_ident($1) as q", [str]);
  return res.rows[0].q;
}

renameByOid();
