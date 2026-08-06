process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
const { Client } = require('pg');

const connectionString = 'postgresql://postgres:Shj553551@124.222.201.143:5432/postgres';

async function copyData() {
  const client = new Client({
    connectionString,
    connectionTimeoutMillis: 15000
  });

  try {
    await client.connect();
    console.log("Connected to DB.");

    // 获取包含数据表的自定义 schema 名 (例如 "$user")
    const schemasRes = await client.query(`
      SELECT schema_name 
      FROM information_schema.schemata 
      WHERE schema_name NOT IN ('pg_catalog', 'information_schema', 'public')
    `);
    console.log("Found Schemas:", schemasRes.rows.map(r => r.schema_name));

    // 获取 $user schema 下的所有有数据的表
    const tablesRes = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = '$user' OR table_schema = '"$user"' OR table_schema LIKE '%user%'
    `);
    console.log("Found tables in user schema:", tablesRes.rows.map(r => r.table_name));

    // 把 $user schema 下的所有表数据全量复制到 public schema 下
    const allTables = [
      'users', 'entities', 'entity_aliases', 'reports', 'report_entities', 
      'unlocks', 'relations', 'entity_relations', 'notes', 'favorites', 
      'email_verifications', 'industries', 'countries', 'report_industries', 
      'report_countries', 'page_views', 'search_logs', 'news', 'news_industries', 
      'news_countries', 'articles', 'article_entities', 'hot_keywords', 'daily_stats_summary'
    ];

    for (const t of allTables) {
      try {
        const countUser = await client.query(`SELECT COUNT(*) FROM "$user"."${t}"`);
        console.log(`Table ["$user".${t}] has ${countUser.rows[0].count} rows.`);

        if (parseInt(countUser.rows[0].count, 10) > 0) {
          // 清空 public 下之前的占位数据
          await client.query(`TRUNCATE TABLE "public"."${t}" CASCADE;`);
          // 把 $user 下的数据复制到 public 下
          await client.query(`INSERT INTO "public"."${t}" SELECT * FROM "$user"."${t}" ON CONFLICT DO NOTHING;`);
          
          const countPublic = await client.query(`SELECT COUNT(*) FROM "public"."${t}"`);
          console.log(`  └─> SUCCESS! Migrated ${countPublic.rows[0].count} rows to [public.${t}]!`);
        }
      } catch (err) {
        console.log(`  Notice for [${t}]:`, err.message);
      }
    }

    console.log("\n=== VERIFICATION FOR PUBLIC SCHEMA ===");
    const rCount = await client.query('SELECT COUNT(*) FROM "public"."reports"');
    console.log(`Reports in public: ${rCount.rows[0].count}`);

    const eCount = await client.query('SELECT COUNT(*) FROM "public"."entities"');
    console.log(`Entities in public: ${eCount.rows[0].count}`);

    const relCount = await client.query('SELECT COUNT(*) FROM "public"."relations"');
    console.log(`Relations in public: ${relCount.rows[0].count}`);

    const uCount = await client.query('SELECT COUNT(*) FROM "public"."users"');
    console.log(`Users in public: ${uCount.rows[0].count}`);

  } catch (err) {
    console.error("Copy Error:", err);
  } finally {
    await client.end();
  }
}

copyData();
