import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { Client } from 'pg';
import { createTestClient, cleanDatabase, createTestUser } from './helpers/db-test-helper';
import checkDuplicateHandler from '../pages/api/admin/reports/check-duplicate';
import uploadHandler from '../pages/api/admin/reports/upload';

// 模拟 Next.js NextApiRequest & NextApiResponse
function mockRequestResponse(method: string, body: any) {
  const req = {
    method,
    body,
  } as any;

  let statusCode = 200;
  let jsonPayload: any = null;

  const res = {
    status: (code: number) => {
      statusCode = code;
      return res;
    },
    json: (payload: any) => {
      jsonPayload = payload;
      return res;
    },
  } as any;

  return { req, res, getStatus: () => statusCode, getJson: () => jsonPayload };
}

describe('Report Duplicate Detection and Overwrite Logic Test', () => {
  let dbClient: Client;
  let testUserId: string;

  beforeAll(async () => {
    dbClient = createTestClient();
    await dbClient.connect();
    await cleanDatabase(dbClient);

    const userRes = await createTestUser(dbClient, {
      phoneNumber: '13911112222',
      freeQuota: 3,
    });
    testUserId = userRes.id;
  });

  afterAll(async () => {
    await dbClient.end();
  });

  it('should detect duplicates when a similar company already has a report', async () => {
    // 1. 插入一个标准公司实体 "X5 Retail"
    const entRes = await dbClient.query(
      `INSERT INTO entities (canonical_name, entity_type) VALUES ('X5 Retail', 'company') RETURNING id`
    );
    const entityId = entRes.rows[0].id;

    // 2. 插入与之关联的报告
    const repRes = await dbClient.query(
      `INSERT INTO reports (title, category, market_region, summary, content_html) 
       VALUES ('X5 Retail 供应链深度调研报告', 'customer', '俄罗斯', '关于 X5 的报告', '<div>X5 Retail Group Content</div>') 
       RETURNING id`
    );
    const reportId = repRes.rows[0].id;

    // 建立报告与实体关联
    await dbClient.query(
      `INSERT INTO report_entities (report_id, entity_id) VALUES ($1, $2)`,
      [reportId, entityId]
    );

    // 3. 测试 check-duplicate 接口，检测输入为 "X5" (由于 pg_trgm 相似度)
    // 注意: check-duplicate 将通过 withDb 包装或直接运行，我们测试其底层逻辑或直接调用处理器。
    const { req, res, getStatus, getJson } = mockRequestResponse('POST', {
      companyName: 'X5',
      category: 'customer'
    });

    await checkDuplicateHandler(req, res, dbClient);

    expect(getStatus()).toBe(200);
    const payload = getJson();
    expect(payload.duplicateFound).toBe(true);
    expect(payload.reportId).toBe(reportId);
    expect(payload.matchedCanonicalName).toBe('X5 Retail');
  });

  it('should successfully overwrite an existing report and add alias without deleting user unlocks', async () => {
    // 1. 查找已有报告和实体
    const repRes = await dbClient.query("SELECT id FROM reports WHERE title = 'X5 Retail 供应链深度调研报告'");
    const reportId = repRes.rows[0].id;

    // 2. 模拟用户已解锁此报告
    await dbClient.query(
      `INSERT INTO unlocks (user_id, report_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
      [testUserId, reportId]
    );

    // 3. 运行上传接口，进行覆盖写入且指定企业别名为 "X5 Retail Corp"
    const { req, res, getStatus, getJson } = mockRequestResponse('POST', {
      rawHtml: '<html><head><title>X5 Retail New Title</title><meta name="category" content="customer"></head><body>Updated content</body></html>',
      category: 'customer',
      summary: 'Updated summary info',
      overwriteReportId: reportId,
      manualTags: {
        companies: ['X5 Retail', 'X5 Retail Corp'] // 传入同义词别名
      }
    });

    await uploadHandler(req, res, dbClient);

    expect(getStatus()).toBe(200);
    expect(getJson().success).toBe(true);
    expect(getJson().reportId).toBe(reportId); // ID 保持不变

    // 4. 验证报告内容已被成功覆盖
    const checkReport = await dbClient.query("SELECT title, summary FROM reports WHERE id = $1", [reportId]);
    expect(checkReport.rows[0].title).toBe('X5 Retail New Title');
    expect(checkReport.rows[0].summary).toBe('Updated summary info');

    // 5. 验证别称 "X5 Retail Corp" 已成功写入别名表，且指向原实体
    const checkAlias = await dbClient.query(
      `SELECT e.canonical_name 
       FROM entity_aliases ea
       JOIN entities e ON ea.entity_id = e.id
       WHERE ea.alias_name = 'X5 Retail Corp'`
    );
    expect(checkAlias.rows.length).toBe(1);
    expect(checkAlias.rows[0].canonical_name).toBe('X5 Retail');

    // 6. 核心验证：用户解锁关系依旧存在
    const checkUnlock = await dbClient.query("SELECT id FROM unlocks WHERE user_id = $1 AND report_id = $2", [testUserId, reportId]);
    expect(checkUnlock.rows.length).toBe(1);
  });
});
