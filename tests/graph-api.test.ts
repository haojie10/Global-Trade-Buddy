import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { Client } from 'pg';
import { createTestClient, cleanDatabase, createTestUser, createTestReport, mockReqRes } from './helpers/db-test-helper';
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
    await cleanDatabase(dbClient);

    // 1. 创建测试用户
    const normalRes = await createTestUser(dbClient, {
      phoneNumber: '13800000001',
      role: 'user',
    });
    userIdNormal = normalRes.id;

    const adminRes = await createTestUser(dbClient, {
      phoneNumber: '13800000002',
      role: 'admin',
    });
    userIdAdmin = adminRes.id;

    // 2. 创建测试报告
    const repA = await createTestReport(dbClient, {
      title: 'A公司铝合金轮毂报告',
      category: 'customer',
      marketRegion: '欧美',
      summary: 'A公司摘要',
      contentHtml: '全文A',
    });
    reportIdA = repA.id;

    const repB = await createTestReport(dbClient, {
      title: '刹车片市场品类洞察',
      category: 'product',
      marketRegion: '中东',
      summary: '刹车片摘要',
      contentHtml: '全文B',
    });
    reportIdB = repB.id;


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
    // 1. 普通用户仅解锁了 reportIdA，因此图谱仅返回关联报告A
    const data = await getGraphData(userIdNormal, 'user', dbClient);
    
    // 应该只包含报告节点，不含实体节点
    const reports = data.nodes.filter(n => n.node_type === 'report');
    const entities = data.nodes.filter(n => n.node_type === 'entity');
    
    expect(reports.length).toBe(1);
    expect(reports[0].id).toBe(reportIdA);
    expect(entities.length).toBe(0);
  });

  it('should query full graph data for admin including all nodes, entities and connection attributes', async () => {
    // 2. 管理员用户应该查到所有节点和连线，不论是否解锁
    const data = await getGraphData('', 'admin', dbClient);
    
    const reports = data.nodes.filter(n => n.node_type === 'report');
    const entities = data.nodes.filter(n => n.node_type === 'entity');
    
    expect(reports.length).toBe(2);
    expect(entities.length).toBe(0);
    
    // 验证包含报告与报告的关联线
    const reportLinks = data.links;
    expect(reportLinks.length).toBe(1);
    expect(reportLinks[0].relation_key).toBe('共有组件');
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

  it('should return full graph for admin user authenticated via Cookie', async () => {
    const { req, res, getStatus, getJson } = mockReqRes({
      method: 'GET',
      session: { userId: userIdAdmin, role: 'admin' },
    });
    await graphHandler(req, res);
    expect(getStatus()).toBe(200);
    // admin 角色应能看到所有报告节点
    const reports = getJson().nodes.filter((n: any) => n.node_type === 'report');
    expect(reports.length).toBe(2);
  });

  it('should return only unlocked reports for normal user authenticated via Cookie', async () => {
    const { req, res, getStatus, getJson } = mockReqRes({
      method: 'GET',
      session: { userId: userIdNormal, role: 'user' },
    });
    await graphHandler(req, res);
    expect(getStatus()).toBe(200);
    const reports = getJson().nodes.filter((n: any) => n.node_type === 'report');
    expect(reports.length).toBe(1); // 普通用户仅解锁了 1 篇
  });

  it('should return 401 when no session Cookie is provided', async () => {
    const { req, res, getStatus } = mockReqRes({ method: 'GET' });
    await graphHandler(req, res);
    expect(getStatus()).toBe(401);
  });
});
