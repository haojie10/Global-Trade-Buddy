const dotenv = require('dotenv');
const path = require('path');
const { Client } = require('pg');
const tcb = require('@cloudbase/node-sdk');

// 加载项目根目录的 .env 文件
dotenv.config({ path: path.join(__dirname, '../.env') });

async function testDatabase() {
  console.log('=== [1/2] 正在测试 PostgreSQL 数据库连接 ===');
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl || dbUrl.includes('your_password')) {
    console.error('❌ DATABASE_URL 未正确配置，请在 .env 中设置真实连接串。');
    return false;
  }

  // 格式脱敏输出
  try {
    const urlObj = new URL(dbUrl);
    console.log(`📡 正在连接目标: ${urlObj.hostname}:${urlObj.port || 5432}，数据库: ${urlObj.pathname.substring(1)}，用户: ${urlObj.username}`);
  } catch (e) {
    console.log('📡 正在连接数据库...');
  }

  const client = new Client({
    connectionString: dbUrl,
    connectionTimeoutMillis: 5000, // 5秒超时
  });

  try {
    await client.connect();
    const res = await client.query('SELECT NOW() as now_time, version() as db_version');
    console.log('✅ PostgreSQL 数据库连接成功！');
    console.log(`   - 数据库服务器时间: ${res.rows[0].now_time}`);
    console.log(`   - 数据库版本信息: ${res.rows[0].db_version.split(',')[0]}`);

    // 检查基础数据表状态
    const tablesRes = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
    `);
    const tableNames = tablesRes.rows.map(r => r.table_name);
    console.log(`📊 当前数据库含有 ${tableNames.length} 个表: ${tableNames.length > 0 ? tableNames.join(', ') : '(无数据表，建议执行 init_tencent_db.sql 进行初始化)'}`);
    
    await client.end();
    return true;
  } catch (err) {
    console.error('❌ PostgreSQL 数据库连接失败！');
    console.error(`   - 错误详情: ${err.message}`);
    if (err.code === 'ECONNREFUSED' || err.code === 'ETIMEDOUT') {
      console.error('   💡 排查建议: 请检查轻量服务器安全组防火墙是否放行了 5432 端口，以及 postgresql.conf 是否配置了 listen_addresses = \'*\'');
    }
    return false;
  }
}

async function testCloudBase() {
  console.log('\n=== [2/2] 正在测试 腾讯云 CloudBase (TCB) 连接 ===');
  const envId = process.env.TCB_ENV_ID;
  const secretId = process.env.TCB_SECRET_ID;
  const secretKey = process.env.TCB_SECRET_KEY;

  if (!envId || !secretId || !secretKey) {
    console.error('❌ CloudBase 环境变量不完整！');
    console.error(`   - TCB_ENV_ID: ${envId ? '已配置' : '❌ 缺失'}`);
    console.error(`   - TCB_SECRET_ID: ${secretId ? '已配置' : '❌ 缺失'}`);
    console.error(`   - TCB_SECRET_KEY: ${secretKey ? '已配置' : '❌ 缺失'}`);
    return false;
  }

  console.log(`📡 正在初始化 CloudBase SDK，环境 ID: ${envId}，SecretId: ${secretId.substring(0, 6)}******`);

  try {
    const app = tcb.init({
      env: envId,
      secretId: secretId,
      secretKey: secretKey,
    });

    // 尝试调用 getUploadMetadata 测试 CAM 鉴权与 CloudBase API 响应
    const res = await app.getUploadMetadata({
      cloudPath: 'test_ping.txt'
    }).catch(err => err);

    if (res && res.code && (res.code.includes('AUTH') || res.code.includes('INVALID') || res.code.includes('SECRET') || res.code.includes('ACCESS_DENIED'))) {
      console.error(`❌ CloudBase 凭证鉴权失败: [${res.code}] ${res.message}`);
      return false;
    }

    console.log('✅ 腾讯云 CloudBase 云开发 SDK 鉴权握手成功！');
    return true;
  } catch (err) {
    console.error('❌ CloudBase 连接发生异常！');
    console.error(`   - 错误详情: ${err.message}`);
    return false;
  }
}

async function main() {
  console.log('🚀 开始进行环境连通性全量检测...\n');
  const dbOk = await testDatabase();
  const tcbOk = await testCloudBase();
  console.log('\n========================================');
  console.log(`检测完成！结果汇总:`);
  console.log(`1. 轻量服务器 PostgreSQL: ${dbOk ? '✅ 正常连通' : '❌ 连接失败'}`);
  console.log(`2. 腾讯云 CloudBase 云存储: ${tcbOk ? '✅ 正常连通' : '❌ 连接失败'}`);
  console.log('========================================');
}

main();
