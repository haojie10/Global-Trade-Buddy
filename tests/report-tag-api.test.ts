import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { Client } from 'pg';
import { createTestClient } from './helpers/db-test-helper';
import tagHandler from '../pages/api/admin/reports/tag';

describe('Report Tagging and Entity Association API', () => {
  let dbClient: Client;
  let testReportId: string;

  beforeAll(async () => {
    dbClient = createTestClient();
    await dbClient.connect();

    // 1. 创建测试报告
    const repRes = await dbClient.query(
      `INSERT INTO reports (title, category, market_region, summary, content_html) 
       VALUES ('测试打标专用报告', 'customer', '北美', '测试描述', '<p>正文</p>') 
       RETURNING id`
    );
    testReportId = repRes.rows[0].id;
  });

  afterAll(async () => {
    // 彻底清理测试数据
    if (testReportId) {
      await dbClient.query("DELETE FROM report_entities WHERE report_id = $1", [testReportId]);
      await dbClient.query("DELETE FROM relations WHERE report_id_a = $1 OR report_id_b = $1", [testReportId]);
      await dbClient.query("DELETE FROM reports WHERE id = $1", [testReportId]);
    }
    await dbClient.query("DELETE FROM entities WHERE canonical_name IN ('测试打标公司', '测试打标品类')");
    await dbClient.end();
  });

  function mockReqRes(body: any, isLoggedIn = true) {
    const req = {
      method: 'POST',
      body,
      cookies: isLoggedIn ? {
        gtb_session: Buffer.from(JSON.stringify({ userId: '10000000-0000-0000-0000-000000000000', role: 'admin' })).toString('base64'),
      } : {},
    } as any;
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
    } as any;
    return { req, res, getStatus: () => statusVal, getJson: () => jsonVal };
  }

  it('should reject unauthorized request without login', async () => {
    const { req, res, getStatus } = mockReqRes({
      reportId: testReportId,
      entityName: '测试打标公司',
      entityType: 'company',
    }, false);

    await tagHandler(req, res);
    expect(getStatus()).toBe(401);
  });

  it('should successfully associate a new company entity with a report', async () => {
    const { req, res, getStatus, getJson } = mockReqRes({
      reportId: testReportId,
      entityName: '测试打标公司',
      entityType: 'company',
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
      reportId: testReportId,
      entityName: '测试打标公司',
      entityType: 'company',
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
