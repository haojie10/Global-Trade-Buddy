import { Client } from 'pg';
import fs from 'fs';
import path from 'path';
import { encodeSession } from '../../lib/auth';

export function createTestClient(): Client {
  return new Client({
    connectionString: process.env.TEST_DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/postgres',
  });
}

export async function cleanDatabase(client: any) {
  // 1. 自动提取当前连接指定的 search_path，用于在云端 Supabase 支持物理 schema 隔离测试
  const searchPathRes = await client.query('SHOW search_path');
  const currentPath = searchPathRes.rows[0].search_path;
  const targetSchema = currentPath.split(',')[0].trim();

  // 2. 如果指定了特定的隔离 schema 且不是默认的 public/user，自动建立该隔离命名空间
  if (targetSchema && targetSchema !== 'public' && targetSchema !== '"$user"') {
    await client.query(`CREATE SCHEMA IF NOT EXISTS ${targetSchema}`);
    await client.query(`SET search_path TO ${targetSchema}, public`);
  }

  // 3. 检测该命名空间内是否已有基本表（如 reports），若无则说明是首次使用，自动扫描 migrations 建表
  const tableCheck = await client.query(`
    SELECT EXISTS (
      SELECT FROM information_schema.tables 
      WHERE table_schema = $1 AND table_name = 'reports'
    );
  `, [targetSchema && targetSchema !== '"$user"' ? targetSchema : 'public']);

  const tableExists = tableCheck.rows[0].exists;
  if (!tableExists) {
    const migrationsDir = path.join(process.cwd(), 'supabase', 'migrations');
    if (fs.existsSync(migrationsDir)) {
      const files = fs.readdirSync(migrationsDir)
        .filter(f => f.endsWith('.sql'))
        .sort(); // 按照时间戳排序
      
      for (const file of files) {
        const filePath = path.join(migrationsDir, file);
        const sql = fs.readFileSync(filePath, 'utf8');
        try {
          await client.query(sql);
        } catch (err: any) {
          // 忽略在 Supabase 云端由于非 superuser 导致无法 CREATE EXTENSION 等权限错误
          if (!sql.includes('EXTENSION')) {
            console.warn(`[WARN] 执行迁移 SQL 失败 (file: ${file}):`, err.message);
          }
        }
      }
    }
  }

  // 4. 重置/清空测试数据，隔离测试不影响 public 生产主表
  await client.query('DELETE FROM email_verifications');
  await client.query('DELETE FROM notes');
  await client.query('DELETE FROM favorites');
  await client.query('DELETE FROM unlocks');
  await client.query('DELETE FROM relations');
  await client.query('DELETE FROM report_entities');
  await client.query('DELETE FROM entity_aliases');
  await client.query('DELETE FROM entity_relations');
  await client.query('DELETE FROM entities');
  await client.query('DELETE FROM reports');
  await client.query('DELETE FROM users');

  // 重新插入基础冷启动实体与别名的种子数据以保证静态数据对测试用例可用
  await client.query(`
    INSERT INTO entities (canonical_name, entity_type) VALUES
    ('A 公司', 'company'),
    ('B 公司', 'company'),
    ('丰田汽车', 'company'),
    ('铝合金轮毂', 'product'),
    ('刹车片', 'product'),
    ('紧固件', 'product'),
    ('发光壁挂绿植环', 'product'),
    ('中东非公路工程车桥', 'product'),
    ('配件超市', 'channel'),
    ('一级供应链', 'channel')
    ON CONFLICT (canonical_name) DO NOTHING
  `);

  await client.query(`
    INSERT INTO entity_aliases (entity_id, alias_name)
    SELECT id, '美国 A 公司' FROM entities WHERE canonical_name = 'A 公司'
    ON CONFLICT (alias_name) DO NOTHING
  `);
  await client.query(`
    INSERT INTO entity_aliases (entity_id, alias_name)
    SELECT id, '美国A公司' FROM entities WHERE canonical_name = 'A 公司'
    ON CONFLICT (alias_name) DO NOTHING
  `);
  await client.query(`
    INSERT INTO entity_aliases (entity_id, alias_name)
    SELECT id, '德国 B 公司' FROM entities WHERE canonical_name = 'B 公司'
    ON CONFLICT (alias_name) DO NOTHING
  `);
  await client.query(`
    INSERT INTO entity_aliases (entity_id, alias_name)
    SELECT id, '汽配连锁超市' FROM entities WHERE canonical_name = '配件超市'
    ON CONFLICT (alias_name) DO NOTHING
  `);
}

export function mockReqRes(options: {
  method?: string;
  body?: any;
  query?: any;
  headers?: any;
  cookies?: any;
  session?: { userId: string; role: string };
} = {}) {
  const req = {
    method: options.method || 'POST',
    body: options.body || {},
    query: options.query || {},
    headers: options.headers || {},
    cookies: options.cookies || {},
  } as any;

  if (options.session) {
    req.cookies.gtb_session = encodeSession(options.session);
  }

  let statusVal = 200;
  let jsonVal: any = null;
  const res = {
    status(code: number) {
      statusVal = code;
      return this;
    },
    json(data: any) {
      jsonVal = data;
      return this;
    },
    setHeader() {
      return this;
    }
  } as any;

  return { req, res, getStatus: () => statusVal, getJson: () => jsonVal };
}

export async function createTestUser(
  client: any,
  options: {
    id?: string;
    phoneNumber?: string;
    email?: string;
    role?: string;
    freeQuota?: number;
    password?: string;
    nickname?: string;
  }
) {
  const email = options.email || null;
  const role = options.role || 'user';
  const freeQuota = options.freeQuota !== undefined ? options.freeQuota : 3;
  const phone = options.phoneNumber || null;
  const password = options.password || null;
  const nickname = options.nickname || '测试业务员';

  if (options.id) {
    const query = `
      INSERT INTO users (id, phone_number, email, role, free_quota, password, nickname)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING id, phone_number, email, role, free_quota, nickname
    `;
    const res = await client.query(query, [options.id, phone, email, role, freeQuota, password, nickname]);
    return res.rows[0];
  } else {
    const query = `
      INSERT INTO users (phone_number, email, role, free_quota, password, nickname)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING id, phone_number, email, role, free_quota, nickname
    `;
    const res = await client.query(query, [phone, email, role, freeQuota, password, nickname]);
    return res.rows[0];
  }
}

export async function createTestReport(
  client: any,
  options: {
    id?: string;
    title: string;
    category?: string;
    marketRegion?: string;
    summary?: string;
    contentHtml?: string;
  }
) {
  const title = options.title;
  const category = options.category || 'product';
  const marketRegion = options.marketRegion || null;
  const summary = options.summary || null;
  const contentHtml = options.contentHtml || null;

  if (options.id) {
    const query = `
      INSERT INTO reports (id, title, category, market_region, summary, content_html)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING id, title, category, market_region, summary, content_html
    `;
    const res = await client.query(query, [options.id, title, category, marketRegion, summary, contentHtml]);
    return res.rows[0];
  } else {
    const query = `
      INSERT INTO reports (title, category, market_region, summary, content_html)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING id, title, category, market_region, summary, content_html
    `;
    const res = await client.query(query, [title, category, marketRegion, summary, contentHtml]);
    return res.rows[0];
  }
}

