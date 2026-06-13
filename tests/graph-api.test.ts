import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { Client } from 'pg';
import { createTestClient } from './helpers/db-test-helper';
import { getGraphData, getUserGraph } from '../pages/api/user/graph';

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
    await dbClient.query('DELETE FROM entities');
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
  });

  afterAll(async () => {
    await dbClient.end();
  });

  it('should query personal graph data for normal user with entities and relation attributes', async () => {
    // 1. 普通用户仅解锁了 reportIdA，没有解锁 reportIdB，因此图谱没有连线
    const data = await getGraphData(userIdNormal, 'user', dbClient);
    expect(data.nodes.length).toBe(1);
    expect(data.nodes[0].id).toBe(reportIdA);
    expect(data.nodes[0].title).toBe('A公司铝合金轮毂报告');
    expect(data.nodes[0].summary).toBe('A公司摘要');
    
    // 验证实体属性
    expect(data.nodes[0].companies).toContain('测试公司');
    expect(data.nodes[0].products).toContain('测试产品');
    expect(data.nodes[0].channels).toEqual([]); // 应该为空数组而非 undefined

    expect(data.links.length).toBe(0); // 由于仅解锁一个，连线被安全过滤
  });

  it('should query full graph data for admin including all nodes, entities and connection attributes', async () => {
    // 2. 管理员用户应该查到所有节点和连线，不论是否解锁
    const data = await getGraphData('', 'admin', dbClient);
    expect(data.nodes.length).toBe(2);
    
    const nodeA = data.nodes.find(n => n.id === reportIdA)!;
    const nodeB = data.nodes.find(n => n.id === reportIdB)!;
    expect(nodeA).toBeDefined();
    expect(nodeB).toBeDefined();

    expect(nodeA.companies).toContain('测试公司');
    expect(nodeA.products).toContain('测试产品');
    expect(nodeB.channels).toContain('测试渠道');

    // 验证连线及其实体属性
    expect(data.links.length).toBe(1);
    expect(data.links[0].source).toBe(reportIdA);
    expect(data.links[0].target).toBe(reportIdB);
    expect(data.links[0].relation_key).toBe('共有组件');
    expect(data.links[0].market_region).toBe('中东');
    expect(data.links[0].relation_type).toBe('supply_chain');
  });

  it('should verify backward compatibility of getUserGraph', async () => {
    const data = await getUserGraph(userIdNormal, dbClient);
    expect(data.nodes.length).toBe(1);
    expect(data.nodes[0].id).toBe(reportIdA);
  });
});
