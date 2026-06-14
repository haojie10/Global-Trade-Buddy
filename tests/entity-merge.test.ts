import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { Client } from 'pg';
import { createTestClient } from './helpers/db-test-helper';
import mergeHandler from '../pages/api/admin/entities/merge';

describe('Entity Merge API', () => {
  let dbClient: Client;
  let entMainId: string;
  let entAliasId: string;
  let reportId: string;

  beforeAll(async () => {
    dbClient = createTestClient();
    await dbClient.connect();

    // 清理可能遗留的测试数据
    await dbClient.query("DELETE FROM entity_aliases WHERE alias_name = '儿童世界测试别名'");
    await dbClient.query("DELETE FROM report_entities WHERE entity_id IN (SELECT id FROM entities WHERE canonical_name IN ('Detsky Mir 测试主实体', '儿童世界测试别名'))");
    await dbClient.query("DELETE FROM entities WHERE canonical_name IN ('Detsky Mir 测试主实体', '儿童世界测试别名')");

    // 1. 创建主公司
    const mainRes = await dbClient.query(
      "INSERT INTO entities (canonical_name, entity_type) VALUES ('Detsky Mir 测试主实体', 'company') RETURNING id"
    );
    entMainId = mainRes.rows[0].id;

    // 2. 创建即将被合并的公司
    const aliasRes = await dbClient.query(
      "INSERT INTO entities (canonical_name, entity_type) VALUES ('儿童世界测试别名', 'company') RETURNING id"
    );
    entAliasId = aliasRes.rows[0].id;

    // 3. 创建测试报告并关联到被合并公司
    const repRes = await dbClient.query(
      "INSERT INTO reports (title, category) VALUES ('俄罗斯玩具市场分析测试报告', 'product') RETURNING id"
    );
    reportId = repRes.rows[0].id;

    await dbClient.query(
      "INSERT INTO report_entities (report_id, entity_id) VALUES ($1, $2)",
      [reportId, entAliasId]
    );
  });

  afterAll(async () => {
    // 彻底清理测试数据
    await dbClient.query("DELETE FROM entity_aliases WHERE alias_name = '儿童世界测试别名'");
    await dbClient.query("DELETE FROM report_entities WHERE report_id = $1", [reportId]);
    await dbClient.query("DELETE FROM reports WHERE id = $1", [reportId]);
    await dbClient.query("DELETE FROM entities WHERE id IN ($1, $2)", [entMainId, entAliasId]);
    await dbClient.end();
  });

  function mockReqRes(body: any) {
    const req = {
      method: 'POST',
      body,
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

  it('should merge alias entity into main entity successfully', async () => {
    const { req, res, getStatus, getJson } = mockReqRes({
      sourceEntityId: entAliasId,
      targetEntityId: entMainId,
      aliasName: '儿童世界测试别名',
    });

    await mergeHandler(req, res);
    expect(getStatus()).toBe(200);
    expect(getJson().success).toBe(true);

    // 验证 1. 被合并公司已在 entities 表中被安全删除
    const entRes = await dbClient.query("SELECT * FROM entities WHERE id = $1", [entAliasId]);
    expect(entRes.rows.length).toBe(0);

    // 验证 2. entity_aliases 表中新增了该别名记录，指向主公司
    const aliasRes = await dbClient.query(
      "SELECT * FROM entity_aliases WHERE alias_name = '儿童世界测试别名' AND entity_id = $1",
      [entMainId]
    );
    expect(aliasRes.rows.length).toBe(1);

    // 验证 3. 原先只关联了被合并公司的报告，现在已被转移到了主公司上
    const repEntRes = await dbClient.query(
      "SELECT * FROM report_entities WHERE report_id = $1 AND entity_id = $2",
      [reportId, entMainId]
    );
    expect(repEntRes.rows.length).toBe(1);
  });
});
