import { Client } from 'pg';

export function createTestClient(): Client {
  return new Client({
    connectionString: process.env.TEST_DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/postgres',
  });
}

export async function cleanDatabase(client: any) {
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
    req.cookies.gtb_session = Buffer.from(JSON.stringify(options.session)).toString('base64');
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
    phoneNumber: string;
    email?: string;
    role?: string;
    freeQuota?: number;
    password?: string;
  }
) {
  const email = options.email || null;
  const role = options.role || 'user';
  const freeQuota = options.freeQuota !== undefined ? options.freeQuota : 3;
  const phone = options.phoneNumber;
  const password = options.password || null;

  if (options.id) {
    const query = `
      INSERT INTO users (id, phone_number, email, role, free_quota, password)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING id, phone_number, email, role, free_quota
    `;
    const res = await client.query(query, [options.id, phone, email, role, freeQuota, password]);
    return res.rows[0];
  } else {
    const query = `
      INSERT INTO users (phone_number, email, role, free_quota, password)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING id, phone_number, email, role, free_quota
    `;
    const res = await client.query(query, [phone, email, role, freeQuota, password]);
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

