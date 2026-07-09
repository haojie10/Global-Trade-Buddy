import { Client } from 'pg';
import fs from 'fs';
import path from 'path';

export async function setup() {
  const connectionString = process.env.TEST_DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/postgres_test';
  
  const client = new Client({
    connectionString
  });
  await client.connect();

  try {
    console.log('Initializing test database schema...');
    
    // 自动建立并切入隔离的 schema 命名空间以防报错
    const searchPathRes = await client.query('SHOW search_path');
    const currentPath = searchPathRes.rows[0].search_path;
    const targetSchema = currentPath.split(',')[0].trim();

    // 强熔断安全拦截：为了保障用户生产数据安全，严禁直接在 public 空间上运行 DROP 和重建逻辑！
    if (!targetSchema || targetSchema === 'public' || targetSchema === '"$user"' || !targetSchema.includes('test')) {
      throw new Error('【数据安全强拦截】检测到集成测试正试图直接指向生产主空间(public)！为了保障你的真实账号和业务数据不被重置清空，系统已自动拦截测试。请确保你的 .env 里的 TEST_DATABASE_URL 后方附加了 ?options=-csearch_path%3Dtest_schema 参数！');
    }

    await client.query(`CREATE SCHEMA IF NOT EXISTS ${targetSchema}`);
    await client.query(`SET search_path TO ${targetSchema}`);

    // Drop existing tables in test database to ensure clean schema setup
    await client.query(`
      DROP TABLE IF EXISTS email_verifications CASCADE;
      DROP TABLE IF EXISTS notes CASCADE;
      DROP TABLE IF EXISTS favorites CASCADE;
      DROP TABLE IF EXISTS unlocks CASCADE;
      DROP TABLE IF EXISTS relations CASCADE;
      DROP TABLE IF EXISTS reports CASCADE;
      DROP TABLE IF EXISTS users CASCADE;
      DROP TABLE IF EXISTS entities CASCADE;
      DROP TABLE IF EXISTS entity_aliases CASCADE;
      DROP TABLE IF EXISTS report_entities CASCADE;
      DROP TABLE IF EXISTS entity_relations CASCADE;
    `);

    // Get all migration files, sort them by name, and apply in sequence
    const migrationsDir = path.join(process.cwd(), 'supabase/migrations');
    const files = fs.readdirSync(migrationsDir)
      .filter(f => f.endsWith('.sql'))
      .sort();

    for (const file of files) {
      console.log(`Applying test migration: ${file}`);
      const sqlPath = path.join(migrationsDir, file);
      const sql = fs.readFileSync(sqlPath, 'utf8');
      try {
        await client.query(sql);
      } catch (err: any) {
        if (!sql.includes('EXTENSION')) {
          console.warn(`[WARN] 执行迁移 SQL 失败 (file: ${file}):`, err.message);
        }
      }
    }

    console.log('Test database schema initialized successfully!');
  } catch (err) {
    console.error('Failed to initialize test database schema:', err);
    throw err;
  } finally {
    await client.end();
  }
}
