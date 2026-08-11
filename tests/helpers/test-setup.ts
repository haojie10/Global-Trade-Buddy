import { Client } from 'pg';
import fs from 'fs';
import path from 'path';

export async function setup() {
  const connectionString = process.env.TEST_DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/postgres_test';
  
  let client: Client | null = null;
  for (let i = 0; i < 3; i++) {
    try {
      client = new Client({
        connectionString,
        connectionTimeoutMillis: 10000,
        keepAlive: true,
        ssl: false
      });
      await client.connect();
      break;
    } catch (cErr) {
      if (i === 2) throw cErr;
      await new Promise(r => setTimeout(r, 1000));
    }
  }
  if (!client) throw new Error('Failed to connect to test database');

  try {
    console.log('Initializing test database schema...');
    
    let targetSchema = '';
    const urlMatch = connectionString.match(/search_path%3D([a-zA-Z0-9_]+)/i) || connectionString.match(/search_path=([a-zA-Z0-9_]+)/i);
    if (urlMatch && urlMatch[1]) {
      targetSchema = urlMatch[1];
    } else {
      const searchPathRes = await client.query('SHOW search_path');
      const currentPath = searchPathRes.rows[0].search_path;
      targetSchema = currentPath.split(',')[0].trim().replace(/"/g, '');
    }

    // 强熔断安全拦截：为了保障用户生产数据安全，严禁直接在 public 空间上运行 DROP 和重建逻辑！
    if (!targetSchema || targetSchema === 'public' || targetSchema === '$user' || !targetSchema.includes('test')) {
      throw new Error('【数据安全强拦截】检测到集成测试正试图直接指向生产主空间(public)！为了保障你的真实账号和业务数据不被重置清空，系统已自动拦截测试。请确保你的 .env 里的 TEST_DATABASE_URL 后方附加了 ?options=-csearch_path%3Dtest_schema 参数！');
    }

    await client.query(`CREATE SCHEMA IF NOT EXISTS ${targetSchema}`);
    await client.query(`SET search_path TO ${targetSchema}, public`);

    // Drop existing tables in test database to ensure clean schema setup
    const tablesToDrop = [
      'custom_report_requests',
      'email_verifications',
      'notes',
      'favorites',
      'unlocks',
      'relations',
      'reports',
      'users',
      'entities',
      'entity_aliases',
      'report_entities',
      'entity_relations'
    ];
    for (const tbl of tablesToDrop) {
      await client.query(`DROP TABLE IF EXISTS ${tbl} CASCADE;`);
    }

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
        await client.query(`SET search_path TO ${targetSchema}, public`);
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
