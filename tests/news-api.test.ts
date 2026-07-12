import { expect, it, describe, beforeAll, afterAll } from 'vitest';
import { Client } from 'pg';
import { createTestClient } from './helpers/db-test-helper';
import publishHandler from '../pages/api/agent/publish';
import listHandler from '../pages/api/user/articles';

describe('News API System Tests', () => {
  let dbClient: Client;

  beforeAll(async () => {
    dbClient = createTestClient();
    await dbClient.connect();
    process.env.AGENT_API_KEY = 'test_agent_secret';
  });

  afterAll(async () => {
    await dbClient.query(`DELETE FROM articles WHERE title LIKE '测试资讯%'`);
    await dbClient.query(`DELETE FROM reports WHERE title LIKE '测试报告%'`);
    await dbClient.end();
  });

  it('should fail publishing if AGENT_API_KEY is unauthorized', async () => {
    const mockReq = {
      method: 'POST',
      headers: { authorization: 'Bearer bad_key' },
      body: { type: 'article', title: '测试资讯A', contentHtml: '<div>Content</div>' }
    } as any;
    
    let statusVal = 0;
    let jsonVal: any = null;
    const mockRes = {
      status: (code: number) => { statusVal = code; return mockRes; },
      json: (data: any) => { jsonVal = data; }
    } as any;

    await publishHandler(mockReq, mockRes, dbClient);
    expect(statusVal).toBe(401);
  });

  it('should successfully publish an article and query it back via user list api', async () => {
    // 1. 推送资讯
    const mockReq = {
      method: 'POST',
      headers: { authorization: 'Bearer test_agent_secret' },
      body: {
        type: 'article',
        title: '测试资讯B-俄罗斯玩具市场',
        summary: '俄罗斯玩具深度动态',
        contentHtml: '<div>测试玩具内容和 A 公司 的介绍</div>',
        region: '欧洲',
        country: '俄罗斯',
        industry: '玩具',
        tags: {
          companies: ['A 公司']
        }
      }
    } as any;
    
    let statusVal = 0;
    let jsonVal: any = null;
    const mockRes = {
      status: (code: number) => { statusVal = code; return mockRes; },
      json: (data: any) => { jsonVal = data; }
    } as any;

    await publishHandler(mockReq, mockRes, dbClient);
    expect(statusVal).toBe(200);
    expect(jsonVal.success).toBe(true);
    const newId = jsonVal.id;

    // 验证关联实体已写入
    const entRes = await dbClient.query(
      `SELECT e.canonical_name 
       FROM article_entities ae 
       JOIN entities e ON ae.entity_id = e.id 
       WHERE ae.article_id = $1`,
      [newId]
    );
    expect(entRes.rows.map(r => r.canonical_name)).toContain('A 公司');

    // 2. 调用列表 API 检索
    const mockListReq = {
      method: 'GET',
      query: { country: '俄罗斯', industry: '玩具' }
    } as any;
    let listStatus = 0;
    let listJson: any = null;
    const mockListRes = {
      status: (code: number) => { listStatus = code; return mockListRes; },
      json: (data: any) => { listJson = data; }
    } as any;

    await listHandler(mockListReq, mockListRes, dbClient);
    expect(listStatus).toBe(200);
    expect(listJson.articles.length).toBeGreaterThan(0);
    const matched = listJson.articles.find((a: any) => a.id === newId);
    expect(matched.title).toBe('测试资讯B-俄罗斯玩具市场');
  });

  it('should successfully publish a report through publish api when type is report', async () => {
    const mockReq = {
      method: 'POST',
      headers: { authorization: 'Bearer test_agent_secret' },
      body: {
        type: 'report',
        title: '测试报告-俄罗斯卡车配件市场',
        summary: '卡车配件深度动态',
        contentHtml: '<div>测试卡车内容</div>',
        region: '欧洲',
        country: '俄罗斯',
        industry: '汽配'
      }
    } as any;
    
    let statusVal = 0;
    let jsonVal: any = null;
    const mockRes = {
      status: (code: number) => { statusVal = code; return mockRes; },
      json: (data: any) => { jsonVal = data; }
    } as any;

    await publishHandler(mockReq, mockRes, dbClient);
    expect(statusVal).toBe(200);
    expect(jsonVal.success).toBe(true);
    expect(jsonVal.type).toBe('report');
    
    // 验证确实写入了 reports 表
    const repRes = await dbClient.query(`SELECT id FROM reports WHERE id = $1`, [jsonVal.id]);
    expect(repRes.rows.length).toBe(1);
  });
});
