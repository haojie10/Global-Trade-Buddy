import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { Client } from 'pg';
import { createTestClient, cleanDatabase, createTestUser, createTestReport, mockReqRes } from './helpers/db-test-helper';
import downloadHandler from '../pages/api/user/report-download';

describe('Report HTML Download API Test', () => {
  let dbClient: Client;
  let testUser: any;
  let adminUser: any;
  let unlockedReport: any;
  let lockedReport: any;

  beforeAll(async () => {
    dbClient = createTestClient();
    await dbClient.connect();
    await cleanDatabase(dbClient);

    testUser = await createTestUser(dbClient, {
      email: 'downloader@gtb.com',
      downloadQuota: 2
    });

    adminUser = await createTestUser(dbClient, {
      email: 'admin_down@gtb.com',
      role: 'admin',
      downloadQuota: 0
    });

    unlockedReport = await createTestReport(dbClient, {
      title: '已解锁的优质出海研报',
      category: 'customer',
      marketRegion: '北美',
      summary: '针对北美大买家的深度透析',
      contentHtml: '<h2>供应链深度分析</h2><p>核心供应商准入名单...</p>'
    });

    lockedReport = await createTestReport(dbClient, {
      title: '尚未解锁的机密报告',
      category: 'product',
      marketRegion: '欧洲',
      summary: '欧洲高精度螺栓认证要求',
      contentHtml: '<h2>机密参数</h2><p>仅对付费用户开放</p>'
    });

    // 为普通用户解锁第 1 篇报告
    await dbClient.query('INSERT INTO unlocks (user_id, report_id) VALUES ($1, $2)', [testUser.id, unlockedReport.id]);
  });

  afterAll(async () => {
    await dbClient.end();
  });

  it('1. should reject unauthenticated requests with 401', async () => {
    const { req, res, getStatus } = mockReqRes({
      method: 'GET',
      query: { reportId: unlockedReport.id }
    });

    await downloadHandler(req, res);
    expect(getStatus()).toBe(401);
  });

  it('2. should reject download if report is not unlocked yet with 403', async () => {
    const { req, res, getStatus, getJson } = mockReqRes({
      method: 'GET',
      query: { reportId: lockedReport.id },
      session: { userId: testUser.id, role: 'user' }
    });

    await downloadHandler(req, res);
    expect(getStatus()).toBe(403);
    expect(getJson().error).toContain('请先在线解锁该报告');
  });

  it('3. should successfully download unlocked report, return HTML with attachment header and deduct 1 quota', async () => {
    let sentData = '';
    const { req, res, getStatus } = mockReqRes({
      method: 'GET',
      query: { reportId: unlockedReport.id },
      session: { userId: testUser.id, role: 'user' }
    });

    res.send = (data: string) => {
      sentData = data;
      return res;
    };

    await downloadHandler(req, res);
    expect(getStatus()).toBe(200);
    expect(sentData).toContain('已解锁的优质出海研报');
    expect(sentData).toContain('供应链深度分析');
    expect(sentData).toContain('GlobalTradeBuddy');

    // 检查数据库中下载额度被扣减 1 次（从 2 变 1）
    const userInDb = await dbClient.query('SELECT download_quota FROM users WHERE id = $1', [testUser.id]);
    expect(userInDb.rows[0].download_quota).toBe(1);
  });

  it('4. should reject download when download_quota is exhausted (0) with 400', async () => {
    // 耗尽剩余 1 次额度
    await dbClient.query('UPDATE users SET download_quota = 0 WHERE id = $1', [testUser.id]);

    const { req, res, getStatus, getJson } = mockReqRes({
      method: 'GET',
      query: { reportId: unlockedReport.id },
      session: { userId: testUser.id, role: 'user' }
    });

    await downloadHandler(req, res);
    expect(getStatus()).toBe(400);
    expect(getJson().error).toContain('下载额度已用尽');
  });

  it('5. should allow admin to download without unlocking or quota deduction', async () => {
    let sentData = '';
    const { req, res, getStatus } = mockReqRes({
      method: 'GET',
      query: { reportId: lockedReport.id }, // 管理员下载未解锁的报告
      session: { userId: adminUser.id, role: 'admin' }
    });

    res.send = (data: string) => {
      sentData = data;
      return res;
    };

    await downloadHandler(req, res);
    expect(getStatus()).toBe(200);
    expect(sentData).toContain('尚未解锁的机密报告');
  });
});
