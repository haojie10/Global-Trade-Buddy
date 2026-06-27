import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { Client } from 'pg';
import { createTestClient, cleanDatabase, mockReqRes } from './helpers/db-test-helper';
import relationHandler from '../pages/api/admin/entities/relation';
import uploadHandler from '../pages/api/admin/reports/upload';

describe('Entity Relations and Automated Inference API', () => {
  let dbClient: Client;
  let entAId: string;
  let entBId: string;

  beforeAll(async () => {
    dbClient = createTestClient();
    await dbClient.connect();

    // 清理可能遗留的测试数据
    await cleanDatabase(dbClient);

    // 1. 创建测试实体
    const resA = await dbClient.query("INSERT INTO entities (canonical_name, entity_type) VALUES ('测试公司A', 'company') RETURNING id");
    entAId = resA.rows[0].id;
    const resB = await dbClient.query("INSERT INTO entities (canonical_name, entity_type) VALUES ('测试公司B', 'company') RETURNING id");
    entBId = resB.rows[0].id;
    await dbClient.query("INSERT INTO entities (canonical_name, entity_type) VALUES ('测试玩具品类', 'product')");
  });

  afterAll(async () => {
    await dbClient.end();
  });


  it('should insert a supplier relation between entity A and B manually', async () => {
    const { req, res, getStatus, getJson } = mockReqRes({
      body: {
        entityIdA: entAId,
        entityIdB: entBId,
        relationType: 'supplier',
        marketRegion: '俄罗斯',
      }
    });

    await relationHandler(req, res);
    expect(getStatus()).toBe(200);
    expect(getJson().success).toBe(true);

    const relRes = await dbClient.query(
      "SELECT * FROM entity_relations WHERE entity_id_a = $1 AND entity_id_b = $2 AND relation_type = 'supplier'",
      [entAId, entBId]
    );
    expect(relRes.rows.length).toBe(1);
  });

  it('should auto-infer competitor relation when uploading a report with 1 product and 2 companies', async () => {
    // 模拟上传
    const { req, res, getStatus } = mockReqRes({
      body: {
        rawHtml: '<html><head><title>自动推理报告</title></head><body>测试内容</body></html>',
        manualTags: {
          companies: ['测试公司A'],
          competitors: ['测试公司B'],
          products: ['测试玩具品类'],
          regions: ['俄罗斯'],
        },
      }
    });

    await uploadHandler(req, res);
    expect(getStatus()).toBe(200);

    // 验证是否自动建立了 测试公司A 和 测试公司B 的竞争对手 (competitor) 关系
    const relRes = await dbClient.query(
      `SELECT * FROM entity_relations 
       WHERE ((entity_id_a = $1 AND entity_id_b = $2) OR (entity_id_a = $2 AND entity_id_b = $1)) 
       AND relation_type = 'competitor'`,
      [entAId, entBId]
    );
    expect(relRes.rows.length).toBeGreaterThanOrEqual(1);
  });
});
