import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { Client } from 'pg';
import { createTestClient, cleanDatabase, createTestUser, createTestReport, mockReqRes } from './helpers/db-test-helper';
import favoriteHandler from '../pages/api/user/favorite';
import { encodeSession } from '../lib/auth';

describe('Favorite Unlocked Requirement Test', () => {
  let dbClient: Client;
  let freeUserId: string;
  let adminUserId: string;
  let testReportId: string;

  beforeAll(async () => {
    dbClient = createTestClient();
    await dbClient.connect();
    await cleanDatabase(dbClient);

    const freeUser = await createTestUser(dbClient, {
      phoneNumber: '13800001111',
      memberType: 'free',
      freeQuota: 10,
      downloadQuota: 5
    });
    freeUserId = freeUser.id;

    const adminUser = await createTestUser(dbClient, {
      phoneNumber: '13800002222',
      role: 'admin',
      freeQuota: 999
    });
    adminUserId = adminUser.id;

    const report = await createTestReport(dbClient, {
      title: '行业调研报告-收藏权限测试',
      category: 'customer'
    });
    testReportId = report.id;
  });

  afterAll(async () => {
    await dbClient.end();
  });

  it('1. should reject favorite request if report is not unlocked yet by normal user', async () => {
    const token = encodeSession({ userId: freeUserId, role: 'user' });
    const { req, res, getStatus, getJson } = mockReqRes({
      method: 'POST',
      headers: {
        cookie: `gtb_session=${token}`
      },
      body: {
        reportId: testReportId
      }
    });

    await favoriteHandler(req, res);
    expect(getStatus()).toBe(403);
    const json = getJson();
    expect(json.error).toContain('该报告尚未解锁');
  });

  it('2. should allow favorite after report is unlocked by user', async () => {
    // 模拟用户解锁报告
    await dbClient.query('INSERT INTO unlocks (user_id, report_id) VALUES ($1, $2)', [freeUserId, testReportId]);

    const token = encodeSession({ userId: freeUserId, role: 'user' });
    const { req, res, getStatus, getJson } = mockReqRes({
      method: 'POST',
      headers: {
        cookie: `gtb_session=${token}`
      },
      body: {
        reportId: testReportId
      }
    });

    await favoriteHandler(req, res);
    expect(getStatus()).toBe(200);
    const json = getJson();
    expect(json.status).toBe('added');
  });

  it('3. should allow admin to favorite directly without prior unlocking', async () => {
    const newReport = await createTestReport(dbClient, {
      title: '管理员直接收藏未解锁报告测试',
      category: 'product'
    });

    const token = encodeSession({ userId: adminUserId, role: 'admin' });
    const { req, res, getStatus, getJson } = mockReqRes({
      method: 'POST',
      headers: {
        cookie: `gtb_session=${token}`
      },
      body: {
        reportId: newReport.id
      }
    });

    await favoriteHandler(req, res);
    expect(getStatus()).toBe(200);
    const json = getJson();
    expect(json.status).toBe('added');
  });
});
