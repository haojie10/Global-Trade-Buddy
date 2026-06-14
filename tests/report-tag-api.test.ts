import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { Client } from 'pg';
import { createTestClient, cleanDatabase, createTestReport, mockReqRes } from './helpers/db-test-helper';
import tagHandler from '../pages/api/admin/reports/tag';

describe('Report Tagging and Entity Association API', () => {
  let dbClient: Client;
  let testReportId: string;

  beforeAll(async () => {
    dbClient = createTestClient();
    await dbClient.connect();
    await cleanDatabase(dbClient);

    // 1. 创建测试报告
    const repRes = await createTestReport(dbClient, {
      title: '测试打标专用报告',
      category: 'customer',
      marketRegion: '北美',
      summary: '测试描述',
      contentHtml: '<p>正文</p>',
    });
    testReportId = repRes.id;
  });

  afterAll(async () => {
    await dbClient.end();
  });


  it('should reject unauthorized request without login', async () => {
    const { req, res, getStatus } = mockReqRes({
      body: {
        reportId: testReportId,
        entityName: '测试打标公司',
        entityType: 'company',
      }
    });

    await tagHandler(req, res);
    expect(getStatus()).toBe(401);
  });

  it('should successfully associate a new company entity with a report', async () => {
    const { req, res, getStatus, getJson } = mockReqRes({
      body: {
        reportId: testReportId,
        entityName: '测试打标公司',
        entityType: 'company',
      },
      session: { userId: '10000000-0000-0000-0000-000000000000', role: 'admin' }
    });

    await tagHandler(req, res);
    expect(getStatus()).toBe(200);
    expect(getJson().success).toBe(true);

    // 验证实体是否创建
    const entRes = await dbClient.query("SELECT * FROM entities WHERE canonical_name = '测试打标公司'");
    expect(entRes.rows.length).toBe(1);
    expect(entRes.rows[0].entity_type).toBe('company');

    // 验证关联是否写入
    const relRes = await dbClient.query(
      "SELECT * FROM report_entities WHERE report_id = $1 AND entity_id = $2",
      [testReportId, entRes.rows[0].id]
    );
    expect(relRes.rows.length).toBe(1);
  });

  it('should successfully associate an existing entity and avoid duplicate report_entities mapping', async () => {
    // 第一次已经关联过了，第二层重复关联应当由于 ON CONFLICT DO NOTHING 而不报错，且维持唯一性
    const { req, res, getStatus } = mockReqRes({
      body: {
        reportId: testReportId,
        entityName: '测试打标公司',
        entityType: 'company',
      },
      session: { userId: '10000000-0000-0000-0000-000000000000', role: 'admin' }
    });

    await tagHandler(req, res);
    expect(getStatus()).toBe(200);

    const checkRes = await dbClient.query(
      `SELECT count(*) FROM report_entities WHERE report_id = $1 AND entity_id = (
         SELECT id FROM entities WHERE canonical_name = '测试打标公司'
       )`,
      [testReportId]
    );
    expect(parseInt(checkRes.rows[0].count)).toBe(1);
  });
});
