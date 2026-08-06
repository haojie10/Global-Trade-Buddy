process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
const { Client } = require('pg');

const connectionString = 'postgresql://postgres:Shj553551@124.222.201.143:5432/postgres';

async function checkGraph() {
  const client = new Client({
    connectionString,
    connectionTimeoutMillis: 10000
  });

  try {
    await client.connect();
    console.log("Connected to DB.");

    // 1. 检查 users 用户列表
    const usersRes = await client.query("SELECT id, phone_number, email, role, nickname FROM users;");
    console.log("\n=== 1. All Users ===");
    console.table(usersRes.rows);

    // 2. 检查 favorites 收藏夹表
    const favsRes = await client.query(`
      SELECT f.user_id, u.nickname, u.email, u.phone_number, COUNT(f.report_id) AS fav_count
      FROM favorites f
      LEFT JOIN users u ON f.user_id = u.id
      GROUP BY f.user_id, u.nickname, u.email, u.phone_number;
    `);
    console.log("\n=== 2. Favorites Count per User ===");
    console.table(favsRes.rows);

    // 3. 检查 relations 表总连接数
    const relCount = await client.query("SELECT COUNT(*) FROM relations;");
    console.log(`\n=== 3. Total Relations in DB: ${relCount.rows[0].count} ===`);

    // 检查是否有缺失关系类型 relation_type 为 null 或 produces 的
    const relTypesRes = await client.query(`
      SELECT relation_type, COUNT(*) 
      FROM relations 
      GROUP BY relation_type;
    `);
    console.log("\n=== 4. Relations Grouped by Type ===");
    console.table(relTypesRes.rows);

  } catch (err) {
    console.error("Check Error:", err);
  } finally {
    await client.end();
  }
}

checkGraph();
