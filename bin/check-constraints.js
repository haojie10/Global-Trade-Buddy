const { Client } = require('pg');
require('dotenv').config();

async function main() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL
  });

  await client.connect();
  console.log('====== 正在检查数据库唯一性约束 ======');

  // 查询当前表的所有唯一约束
  const query = `
    SELECT
        conname AS constraint_name,
        relname AS table_name,
        pg_get_constraintdef(c.oid) AS constraint_definition
    FROM
        pg_constraint c
    JOIN
        pg_class r ON c.conrelid = r.oid
    JOIN
        pg_namespace n ON r.relnamespace = n.oid
    WHERE
        conname LIKE '%unique%' OR conname LIKE '%pkey%' OR conname LIKE '%key%'
    ORDER BY
        table_name;
  `;

  try {
    const res = await client.query(query);
    console.table(res.rows);

    // 特别检查 report_entities 的唯一约束
    console.log('\n--- report_entities 表的约束定义 ---');
    const reRes = await client.query(`
      SELECT conname, pg_get_constraintdef(oid) 
      FROM pg_constraint 
      WHERE conrelid = 'report_entities'::regclass;
    `);
    console.log(reRes.rows);

    // 特别检查 entity_relations 的唯一约束
    console.log('\n--- entity_relations 表的约束定义 ---');
    const erRes = await client.query(`
      SELECT conname, pg_get_constraintdef(oid) 
      FROM pg_constraint 
      WHERE conrelid = 'entity_relations'::regclass;
    `);
    console.log(erRes.rows);

    // 特别检查 relations 的唯一约束
    console.log('\n--- relations 表的约束定义 ---');
    const rRes = await client.query(`
      SELECT conname, pg_get_constraintdef(oid) 
      FROM pg_constraint 
      WHERE conrelid = 'relations'::regclass;
    `);
    console.log(rRes.rows);

  } catch (err) {
    console.error('检查过程中报错:', err.message);
  } finally {
    await client.end();
  }
}

main();
