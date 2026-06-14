import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { Client } from 'pg';
import { createTestClient } from './helpers/db-test-helper';
import deleteHandler from '../pages/api/admin/delete-node';

describe('Admin Node Deletion API (Reports and Entities)', () => {
  let dbClient: Client;
  let testReportId: string;
  let testEntityId: string;

  beforeAll(async () => {
    dbClient = createTestClient();
    await dbClient.connect();

    // 0. 插入测试管理员账户以符合外键约束
    await dbClient.query(
      `INSERT INTO users (id, phone_number, email, role) 
       VALUES ('10000000-0000-0000-0000-000000000000', '13800000000', 'admin@gtb.com', 'admin')
       ON CONFLICT (id) DO NOTHING`
    );

    // 1. 创建测试报告和关联的 unlocks 记录以测试级联删除
    const repRes = await dbClient.query(
      `INSERT INTO reports (title, category, market_region, summary) 
       VALUES ('要被删除的报告', 'customer', '欧盟', '描述') 
       RETURNING id`
    );
    testReportId = repRes.rows[0].id;

    await dbClient.query(
      `INSERT INTO unlocks (user_id, report_id) 
       VALUES ('10000000-0000-0000-0000-000000000000', $1)`,
      [testReportId]
    );

    // 2. 创建测试实体和关联的 aliases 以测试级联删除
    const entRes = await dbClient.query(
      `INSERT INTO entities (canonical_name, entity_type) 
       VALUES ('要被删除的公司', 'company') 
       RETURNING id`
    );
    testEntityId = entRes.rows[0].id;

    await dbClient.query(
      `INSERT INTO entity_aliases (entity_id, alias_name) 
       VALUES ($1, '别名公司123')`,
      [testEntityId]
    );
  });

  afterAll(async () => {
    // 兜底清理
    if (testReportId) {
      await dbClient.query("DELETE FROM reports WHERE id = $1", [testReportId]);
    }
    if (testEntityId) {
      await dbClient.query("DELETE FROM entities WHERE id = $1", [testEntityId]);
    }
    await dbClient.query("DELETE FROM users WHERE id = '10000000-0000-0000-0000-000000000000'");
    await dbClient.end();
  });

  function mockReqRes(body: any, role = 'admin', isLoggedIn = true) {
    const req = {
      method: 'POST',
      body,
      cookies: isLoggedIn ? {
        gtb_session: Buffer.from(JSON.stringify({ userId: '10000000-0000-0000-0000-000000000000', role })).toString('base64'),
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
      id: testReportId,
      nodeType: 'report',
    }, 'admin', false);

    await deleteHandler(req, res);
    expect(getStatus()).toBe(401);
  });

  it('should reject request from normal user (not admin)', async () => {
    const { req, res, getStatus } = mockReqRes({
      id: testReportId,
      nodeType: 'report',
    }, 'user', true);

    await deleteHandler(req, res);
    expect(getStatus()).toBe(403);
  });

  it('should successfully delete a report node and cascade delete locks', async () => {
    const { req, res, getStatus, getJson } = mockReqRes({
      id: testReportId,
      nodeType: 'report',
    }, 'admin', true);

    await deleteHandler(req, res);
    expect(getStatus()).toBe(200);
    expect(getJson().success).toBe(true);

    // 验证报告已被删除
    const checkRep = await dbClient.query("SELECT * FROM reports WHERE id = $1", [testReportId]);
    expect(checkRep.rows.length).toBe(0);

    // 验证解锁表中的记录已级联删除
    const checkUnlock = await dbClient.query("SELECT * FROM unlocks WHERE report_id = $1", [testReportId]);
    expect(checkUnlock.rows.length).toBe(0);

    testReportId = ''; // 标记已删除，避免 afterAll 重复删除
  });

  it('should successfully delete an entity node and cascade delete aliases', async () => {
    const { req, res, getStatus, getJson } = mockReqRes({
      id: testEntityId,
      nodeType: 'entity',
    }, 'admin', true);

    await deleteHandler(req, res);
    expect(getStatus()).toBe(200);
    expect(getJson().success).toBe(true);

    // 验证公司实体已被删除
    const checkEnt = await dbClient.query("SELECT * FROM entities WHERE id = $1", [testEntityId]);
    expect(checkEnt.rows.length).toBe(0);

    // 验证别名表的记录已级联删除
    const checkAlias = await dbClient.query("SELECT * FROM entity_aliases WHERE entity_id = $1", [testEntityId]);
    expect(checkAlias.rows.length).toBe(0);

    testEntityId = ''; // 标记已删除，避免 afterAll 重复删除
  });
});
