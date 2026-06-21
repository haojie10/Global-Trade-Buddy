import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { Client } from 'pg';
import { createTestClient, cleanDatabase, createTestUser, createTestReport } from './helpers/db-test-helper';
import http from 'http';

// 模拟的 NextJS 内部 API 逻辑调用，用于测试
import { getReportDetail } from '../pages/api/user/report-detail';
import { getUserGraph } from '../pages/api/user/graph';

describe('Obsidian Graph & Safety API Test', () => {
  let dbClient: Client;
  let userIdA: string;
  let userIdB: string;
  let reportId1: string;
  let reportId2: string;
  let reportId3: string;

  beforeAll(async () => {
    dbClient = createTestClient();
    await dbClient.connect();

    // 清理表
    await cleanDatabase(dbClient);

    // 1. 创建测试用户
    const userARes = await createTestUser(dbClient, {
      phoneNumber: '13800000001',
      freeQuota: 0,
    });
    userIdA = userARes.id;

    const userBRes = await createTestUser(dbClient, {
      phoneNumber: '13800000002',
      freeQuota: 3,
    });
    userIdB = userBRes.id;

    // 2. 创建测试报告
    const rep1 = await createTestReport(dbClient, {
      title: 'A公司铝合金轮毂报告',
      category: 'customer',
      marketRegion: '欧美',
      summary: 'A公司摘要',
      contentHtml: 'A公司机密全文',
    });
    reportId1 = rep1.id;

    const rep2 = await createTestReport(dbClient, {
      title: 'B公司铝合金轮毂报告',
      category: 'customer',
      marketRegion: '中东',
      summary: 'B公司摘要',
      contentHtml: 'B公司机密全文',
    });
    reportId2 = rep2.id;

    const rep3 = await createTestReport(dbClient, {
      title: '刹车片市场品类洞察',
      category: 'product',
      marketRegion: '全球',
      summary: '刹车片摘要',
      contentHtml: '刹车片机密全文',
    });
    reportId3 = rep3.id;


    // 3. 建立报告关联 (Report 1 <-> Report 2 共有轮毂关键词)
    await dbClient.query(
      `INSERT INTO relations (report_id_a, report_id_b, relation_key) 
       VALUES ($1, $2, '铝合金轮毂')`,
      [reportId1, reportId2]
    );

    // 3.5 插入实体并与报告关联，以供新图谱 API 抽取实体节点
    const entRes = await dbClient.query(
      `INSERT INTO entities (canonical_name, entity_type) 
       VALUES ('铝合金轮毂', 'product') 
       ON CONFLICT (canonical_name) DO UPDATE SET entity_type = EXCLUDED.entity_type
       RETURNING id`
    );
    const entityId = entRes.rows[0].id;
    await dbClient.query(
      `INSERT INTO report_entities (report_id, entity_id) VALUES ($1, $3), ($2, $3)`,
      [reportId1, reportId2, entityId]
    );

    // 4. 用户 B 解锁了 Report 1 和 Report 2；用户 A 没解锁任何报告
    await dbClient.query(
      `INSERT INTO unlocks (user_id, report_id) VALUES ($1, $2), ($1, $3)`,
      [userIdB, reportId1, reportId2]
    );
  });

  afterAll(async () => {
    await dbClient.end();
  });

  it('should restrict un-unlocked report content and only return summary', async () => {
    // 模拟用户 A 访问未解锁的 Report 1
    const res = await getReportDetail(userIdA, reportId1, dbClient);
    expect(res.isUnlocked).toBe(false);
    expect(res.title).toBe('A公司铝合金轮毂报告');
    expect(res.summary).toBe('A公司摘要');
    expect(res.content_html).toBeNull(); // 全文被拦截，不返回！
  });

  it('should allow unlocked report to fetch full html content', async () => {
    // 模拟用户 B 访问已解锁的 Report 1
    const res = await getReportDetail(userIdB, reportId1, dbClient);
    expect(res.isUnlocked).toBe(true);
    expect(res.title).toBe('A公司铝合金轮毂报告');
    expect(res.summary).toBe('A公司摘要');
    expect(res.content_html).toBe('A公司机密全文'); // 成功返回全文！
  });

  it('should query personal graph and only contain relationships of unlocked reports', async () => {
    // 用户 B 解锁了 1 和 2，它们有连接边，因此能查出图谱关系
    const graphB = await getUserGraph(userIdB, dbClient);
    const reports = graphB.nodes.filter((n: any) => n.node_type === 'report');
    const entities = graphB.nodes.filter((n: any) => n.node_type === 'entity');
    const reportLinks = graphB.links;

    expect(reports.length).toBe(2);
    expect(entities.length).toBe(0);
    expect(reportLinks.length).toBe(1); // 报告1和报告2之间有一条直接的边

    // 用户 A 没解锁任何有关系边的报告，因此图谱关系为空
    const graphA = await getUserGraph(userIdA, dbClient);
    expect(graphA.nodes.length).toBe(0);
    expect(graphA.links.length).toBe(0);
  });
});
