const { Client } = require('pg');
const bcrypt = require('bcryptjs');
require('dotenv').config();

async function main() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL
  });
  await client.connect();
  
  try {
    const adminHash = await bcrypt.hash('admin123', 10);
    const userHash = await bcrypt.hash('user123', 10);
    
    // 插入管理员
    await client.query(`
      INSERT INTO users (phone_number, email, password, role, free_quota, nickname) 
      VALUES ('13800000000', 'admin@gtb.com', $1, 'admin', 999, '主管理员')
      ON CONFLICT (email) DO NOTHING
    `, [adminHash]);
    console.log('✅ 管理员账号 admin@gtb.com (密码 admin123) 写入成功！');

    // 插入普通用户
    await client.query(`
      INSERT INTO users (phone_number, email, password, role, free_quota, nickname) 
      VALUES ('13800000001', 'user@gtb.com', $1, 'user', 3, '测试员')
      ON CONFLICT (email) DO NOTHING
    `, [userHash]);
    console.log('✅ 测试业务员 user@gtb.com (密码 user123) 写入成功！');

  } catch (err) {
    console.error('❌ 写入失败:', err);
  } finally {
    await client.end();
  }
}

main();
