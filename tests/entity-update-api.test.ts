import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { Client } from 'pg';
import { createTestClient, cleanDatabase, mockReqRes } from './helpers/db-test-helper';
import updateHandler from '../pages/api/admin/entities/update';
import detailHandler from '../pages/api/user/entities/detail';

describe('Entity Update and Details API', () => {
  let dbClient: Client;
  let testEntityId: string;

  beforeAll(async () => {
    dbClient = createTestClient();
    await dbClient.connect();

    await cleanDatabase(dbClient);

    // 创建测试用的公司实体
    const res = await dbClient.query(
      `INSERT INTO entities (canonical_name, entity_type) 
       VALUES ('测试编辑公司', 'company') 
       RETURNING id`
    );
    testEntityId = res.rows[0].id;
  });

  afterAll(async () => {
    if (testEntityId) {
      await dbClient.query('DELETE FROM entities WHERE id = $1', [testEntityId]);
    }
    await dbClient.end();
  });

  it('should fetch entity details with empty basic info initially', async () => {
    const { req, res, getStatus, getJson } = mockReqRes({
      method: 'GET',
      query: { id: testEntityId }
    });

    await detailHandler(req, res);
    expect(getStatus()).toBe(200);
    const data = getJson();
    expect(data.canonical_name).toBe('测试编辑公司');
    expect(data.description).toBe('');
    expect(data.website).toBe('');
    expect(data.headquarters).toBe('');
    expect(data.employee_count).toBe('');
  });

  it('should deny update when user role is guest', async () => {
    const { req, res, getStatus } = mockReqRes({
      cookies: { user_role: 'guest' },
      body: {
        entityId: testEntityId,
        description: '特斯拉竞品',
        website: 'https://test.com',
        headquarters: '北京',
        employee_count: '100-500'
      }
    });

    await updateHandler(req, res);
    expect(getStatus()).toBe(403);
  });

  it('should update entity details successfully when user is admin', async () => {
    const { req, res, getStatus, getJson } = mockReqRes({
      cookies: { user_role: 'admin' },
      body: {
        entityId: testEntityId,
        description: '一家测试使用的编辑公司简介',
        website: 'www.test-edit.com',
        headquarters: '中国深圳',
        employee_count: '1000+'
      }
    });

    await updateHandler(req, res);
    expect(getStatus()).toBe(200);
    expect(getJson().success).toBe(true);

    // 再次调用 detail 接口，验证是否成功保存
    const { req: reqDetail, res: resDetail, getStatus: getStatusD, getJson: getJsonD } = mockReqRes({
      method: 'GET',
      query: { id: testEntityId }
    });
    await detailHandler(reqDetail, resDetail);
    expect(getStatusD()).toBe(200);
    const data = getJsonD();
    expect(data.description).toBe('一家测试使用的编辑公司简介');
    expect(data.website).toBe('www.test-edit.com');
    expect(data.headquarters).toBe('中国深圳');
    expect(data.employee_count).toBe('1000+');
  });
});
