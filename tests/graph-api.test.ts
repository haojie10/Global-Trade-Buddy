import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { Client } from 'pg';
import { createTestClient } from './helpers/db-test-helper';
import graphHandler, { getGraphData, getUserGraph } from '../pages/api/user/graph';

describe('Graph Core API - getGraphData & Compatibility', () => {
  let dbClient: Client;
  let userIdNormal: string;
  let userIdAdmin: string;
  let reportIdA: string;
  let reportIdB: string;

  beforeAll(async () => {
    dbClient = createTestClient();
    await dbClient.connect();

    // 清理相关表
    await dbClient.query('DELETE FROM unlocks');
    await dbClient.query('DELETE FROM relations');
    await dbClient.query('DELETE FROM report_entities');
    await dbClient.query("DELETE FROM entities WHERE canonical_name IN ('测试公司', '测试产品', '测试渠道')");
    await dbClient.query('DELETE FROM reports');
    await dbClient.query('DELETE FROM users');

    // 1. 创建测试用户
    const normalRes = await dbClient.query(
      `INSERT INTO users (phone_number, role) VALUES ('13800000001', 'user') RETURNING id`
    );
    userIdNormal = normalRes.rows[0].id;

    const adminRes = await dbClient.query(
      `INSERT INTO users (phone_number, role) VALUES ('13800000002', 'admin') RETURNING id`
    );
    userIdAdmin = adminRes.rows[0].id;

    // 2. 创建测试报告
    const repA = await dbClient.query(
      `INSERT INTO reports (title, category, market_region, summary, content_html) 
       VALUES ('A公司铝合金轮毂报告', 'customer', '欧美', 'A公司摘要', '全文A') 
       RETURNING id`
    );
    reportIdA = repA.rows[0].id;

    const repB = await dbClient.query(
      `INSERT INTO reports (title, category, market_region, summary, content_html) 
       VALUES ('刹车片市场品类洞察', 'product', '中东', '刹车片摘要', '全文B') 
       RETURNING id`
    );
    reportIdB = repB.rows[0].id;

    // 3. 关联关系，增加 market_region 和 relation_type
    await dbClient.query(
      `INSERT INTO relations (report_id_a, report_id_b, relation_key, market_region, relation_type) 
       VALUES ($1, $2, '共有组件', '中东', 'supply_chain')`,
      [reportIdA, reportIdB]
    );

    // 4. 解锁信息 (普通用户仅解锁 reportIdA)
    await dbClient.query(
      `INSERT INTO unlocks (user_id, report_id) VALUES ($1, $2)`,
      [userIdNormal, reportIdA]
    );

    // 5. 插入实体并关联
    const entComp = await dbClient.query(
      `INSERT INTO entities (canonical_name, entity_type) VALUES ('测试公司', 'company') RETURNING id`
    );
    const entProd = await dbClient.query(
      `INSERT INTO entities (canonical_name, entity_type) VALUES ('测试产品', 'product') RETURNING id`
    );
    const entChan = await dbClient.query(
      `INSERT INTO entities (canonical_name, entity_type) VALUES ('测试渠道', 'channel') RETURNING id`
    );

    await dbClient.query(
      `INSERT INTO report_entities (report_id, entity_id) VALUES 
       ($1, $3), ($1, $4), ($2, $5)`,
      [reportIdA, reportIdB, entComp.rows[0].id, entProd.rows[0].id, entChan.rows[0].id]
    );

    // 6. 插入实体商业关系
    await dbClient.query(
      `INSERT INTO entity_relations (entity_id_a, entity_id_b, relation_type, market_region)
       VALUES ($1, $2, 'competitor', '中东')`,
      [entComp.rows[0].id, entProd.rows[0].id]
    );
  });

  afterAll(async () => {
    await dbClient.query('DELETE FROM entity_relations');
    await dbClient.end();
  });

  it('should query personal graph data for normal user with entities and relation attributes', async () => {
    // 1. 普通用户仅解锁了 reportIdA，因此图谱仅返回关联报告A及报告A提及的实体
    const data = await getGraphData(userIdNormal, 'user', dbClient);
    
    // 应该包含报告节点和实体节点
    const reports = data.nodes.filter(n => n.node_type === 'report');
    const entities = data.nodes.filter(n => n.node_type === 'entity');
    
    expect(reports.length).toBe(1);
    expect(reports[0].id).toBe(reportIdA);
    expect(entities.length).toBeGreaterThan(0);
  });

  it('should query full graph data for admin including all nodes, entities and connection attributes', async () => {
    // 2. 管理员用户应该查到所有节点和连线，不论是否解锁
    const data = await getGraphData('', 'admin', dbClient);
    
    const reports = data.nodes.filter(n => n.node_type === 'report');
    const entities = data.nodes.filter(n => n.node_type === 'entity');
    
    expect(reports.length).toBe(2);
    expect(entities.length).toBe(3); // 测试公司、测试产品、测试渠道
    
    // 验证包含商业关系线
    const businessLinks = data.links.filter(l => l.link_type === 'business');
    expect(businessLinks.length).toBe(1);
    expect(businessLinks[0].relation_type).toBe('competitor');
  });

  it('should verify backward compatibility of getUserGraph', async () => {
    const data = await getUserGraph(userIdNormal, dbClient);
    const reports = data.nodes.filter(n => n.node_type === 'report');
    expect(reports.length).toBe(1);
    expect(reports[0].id).toBe(reportIdA);
  });
});

describe('Graph API Handler', () => {
  let dbClient: Client;
  let userIdNormal: string;
  let userIdAdmin: string;

  beforeAll(async () => {
    dbClient = createTestClient();
    await dbClient.connect();
    // 获取已存在的测试用户 ID
    const normalRes = await dbClient.query("SELECT id FROM users WHERE phone_number = '13800000001'");
    userIdNormal = normalRes.rows[0].id;
    const adminRes = await dbClient.query("SELECT id FROM users WHERE phone_number = '13800000002'");
    userIdAdmin = adminRes.rows[0].id;
  });

  afterAll(async () => {
    await dbClient.end();
  });

  function mockReqRes(session: { userId: string; role: string } | null) {
    const req = {
      method: 'GET',
      query: {},
      cookies: session
        ? { gtb_session: Buffer.from(JSON.stringify(session)).toString('base64') }
        : {},
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

  it('should return full graph for admin user authenticated via Cookie', async () => {
    const { req, res, getStatus, getJson } = mockReqRes({ userId: userIdAdmin, role: 'admin' });
    await graphHandler(req, res);
    expect(getStatus()).toBe(200);
    // admin 角色应能看到所有报告节点
    const reports = getJson().nodes.filter((n: any) => n.node_type === 'report');
    expect(reports.length).toBe(2);
  });

  it('should return only unlocked reports for normal user authenticated via Cookie', async () => {
    const { req, res, getStatus, getJson } = mockReqRes({ userId: userIdNormal, role: 'user' });
    await graphHandler(req, res);
    expect(getStatus()).toBe(200);
    const reports = getJson().nodes.filter((n: any) => n.node_type === 'report');
    expect(reports.length).toBe(1); // 普通用户仅解锁了 1 篇
  });

  it('should return 401 when no session Cookie is provided', async () => {
    const { req, res, getStatus } = mockReqRes(null);
    await graphHandler(req, res);
    expect(getStatus()).toBe(401);
  });
});
