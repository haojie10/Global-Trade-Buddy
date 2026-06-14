import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { Client } from 'pg';
import { createTestClient, cleanDatabase, createTestUser, createTestReport } from './helpers/db-test-helper';

import { saveUserNote, getUserNote } from '../pages/api/user/note';
import { toggleFavorite, checkIsFavorite } from '../pages/api/user/favorite';
import { processInvitation } from '../pages/api/user/invite';

describe('Extensions Modules API Test', () => {
  let dbClient: Client;
  let testUserId: string;
  let referrerUserId: string;
  let testReportId: string;

  beforeAll(async () => {
    dbClient = createTestClient();
    await dbClient.connect();

    // 清理数据
    await cleanDatabase(dbClient);

    // 1. 插入邀请人
    const refRes = await createTestUser(dbClient, {
      phoneNumber: '13899990001',
      freeQuota: 3,
    });
    referrerUserId = refRes.id;

    // 2. 插入测试用户
    const userRes = await createTestUser(dbClient, {
      phoneNumber: '13899990002',
      freeQuota: 3,
    });
    testUserId = userRes.id;

    // 3. 插入测试报告
    const repRes = await createTestReport(dbClient, {
      title: '笔记与收藏测试报告',
      category: 'customer',
    });
    testReportId = repRes.id;
  });

  afterAll(async () => {
    await dbClient.end();
  });

  // 笔记功能测试
  it('should successfully save and read user personal notes for report', async () => {
    // 写入笔记
    const saveRes = await saveUserNote(testUserId, testReportId, '这是一条非常重要的采购决策笔记。', dbClient);
    expect(saveRes.success).toBe(true);

    // 读取笔记
    const note = await getUserNote(testUserId, testReportId, dbClient);
    expect(note).toBeDefined();
    expect(note?.content).toBe('这是一条非常重要的采购决策笔记。');
  });

  // 收藏夹测试
  it('should successfully toggle favorites and check status', async () => {
    // 初始状态：未收藏
    let isFav = await checkIsFavorite(testUserId, testReportId, dbClient);
    expect(isFav).toBe(false);

    // 第一次 toggle：添加收藏
    let toggleRes = await toggleFavorite(testUserId, testReportId, dbClient);
    expect(toggleRes.status).toBe('added');

    // 状态：已收藏
    isFav = await checkIsFavorite(testUserId, testReportId, dbClient);
    expect(isFav).toBe(true);

    // 第二次 toggle：移除收藏
    toggleRes = await toggleFavorite(testUserId, testReportId, dbClient);
    expect(toggleRes.status).toBe('removed');

    // 状态：未收藏
    isFav = await checkIsFavorite(testUserId, testReportId, dbClient);
    expect(isFav).toBe(false);
  });

  // 邀请裂变测试
  it('should successfully bind invited relation and award extra quota', async () => {
    // 邀请新用户
    const inviteRes = await processInvitation(referrerUserId, testUserId, dbClient);
    expect(inviteRes.success).toBe(true);

    // 校验双方的额度都从 3 增至了 4
    const refUserQuery = await dbClient.query('SELECT free_quota FROM users WHERE id = $1', [referrerUserId]);
    const testUserQuery = await dbClient.query('SELECT free_quota FROM users WHERE id = $1', [testUserId]);

    expect(refUserQuery.rows[0].free_quota).toBe(4);
    expect(testUserQuery.rows[0].free_quota).toBe(4);
  });
});
