import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { Client } from 'pg';
import { createTestClient, cleanDatabase, createTestUser, createTestReport, mockReqRes } from './helpers/db-test-helper';
import signupHandler from '../pages/api/auth/signup';
import favoriteHandler from '../pages/api/user/favorite';
import downloadHandler from '../pages/api/user/report-download';
import unlockHandler from '../pages/api/user/unlock-action';
import { processInvitation } from '../pages/api/user/invite';
import { resolveSsrAuth } from '../lib/ssr-auth';
import { encodeSession } from '../lib/auth';

describe('End-to-End Membership Tiers & Promotional Journey Test', () => {
  let dbClient: Client;
  let testReport: any;

  beforeAll(async () => {
    dbClient = createTestClient();
    await dbClient.connect();
    await cleanDatabase(dbClient);

    testReport = await createTestReport(dbClient, {
      title: '北美头部五金零售商家得宝深度调研',
      category: 'customer',
      marketRegion: '北美',
      summary: '家得宝全渠道供应链准入与在华采购指南',
      contentHtml: '<h1>家得宝深度透析</h1><p>核心品类包含工具、建材、紧固件等...</p>'
    });
  });

  afterAll(async () => {
    await dbClient.end();
  });

  it('Complete Lifecycle: Signup -> Quota Check -> Favorite Guard -> Unlock -> Favorite -> Download -> Referral -> Pro Cycle', async () => {
    // 步骤 1: 预置验证码并注册新用户，验证自动发放推广期特权：10次解锁 + 5份HTML下载
    const signupEmail = 'e2e_user@gtb.com';
    await dbClient.query(
      `INSERT INTO email_verifications (email, code, expired_at) 
       VALUES ($1, '123456', NOW() + INTERVAL '100 years')`,
      [signupEmail]
    );

    const { req: sReq, res: sRes, getStatus: sStatus, getJson: sJson } = mockReqRes({
      method: 'POST',
      body: {
        nickname: '新用户',
        email: signupEmail,
        password: 'Password123!',
        code: '123456'
      }
    });

    await signupHandler(sReq, sRes);
    expect(sStatus()).toBe(200);
    const signupData = sJson();
    expect(signupData.success).toBe(true);
    expect(signupData.user.freeQuota).toBe(10);
    expect(signupData.user.downloadQuota).toBe(5);
    expect(signupData.user.memberType).toBe('free');
    const newUserId = signupData.user.id;

    // 步骤 2: 验证 SSR Auth 能正确读出用户的额度
    const mockContext: any = {
      req: {
        headers: {
          cookie: `gtb_session=${encodeSession({ userId: newUserId, role: 'user' })}`
        }
      }
    };
    const ssrAuth = await resolveSsrAuth(mockContext, dbClient);
    expect(ssrAuth.userId).toBe(newUserId);
    expect(ssrAuth.freeQuota).toBe(10);
    expect(ssrAuth.downloadQuota).toBe(5);
    expect(ssrAuth.memberType).toBe('free');

    // 步骤 3: 尝试在未解锁时收藏该报告 -> 必须被拦截 (403)
    const { req: favReq1, res: favRes1, getStatus: favStatus1 } = mockReqRes({
      method: 'POST',
      headers: {
        cookie: `gtb_session=${encodeSession({ userId: newUserId, role: 'user' })}`
      },
      body: {
        reportId: testReport.id
      }
    });
    await favoriteHandler(favReq1, favRes1);
    expect(favStatus1()).toBe(403);

    // 步骤 4: 尝试在未解锁时下载该报告 -> 必须被拦截 (403)
    const { req: downReq1, res: downRes1, getStatus: downStatus1 } = mockReqRes({
      method: 'GET',
      headers: {
        cookie: `gtb_session=${encodeSession({ userId: newUserId, role: 'user' })}`
      },
      query: {
        reportId: testReport.id
      }
    });
    await downloadHandler(downReq1, downRes1);
    expect(downStatus1()).toBe(403);

    // 步骤 5: 解锁该报告 -> 解锁额度从 10 扣减至 9
    const { req: unReq, res: unRes, getStatus: unStatus, getJson: unJson } = mockReqRes({
      method: 'POST',
      headers: {
        cookie: `gtb_session=${encodeSession({ userId: newUserId, role: 'user' })}`
      },
      body: {
        userId: newUserId,
        reportId: testReport.id
      }
    });
    await unlockHandler(unReq, unRes);
    expect(unStatus()).toBe(200);
    expect(unJson().success).toBe(true);

    const userAfterUnlock = await dbClient.query('SELECT free_quota FROM users WHERE id = $1', [newUserId]);
    expect(userAfterUnlock.rows[0].free_quota).toBe(9);

    // 步骤 6: 验证解锁时自动加入收藏图谱，且支持用户再次 toggle
    const favAfterUnlock = await dbClient.query(
      'SELECT id FROM favorites WHERE user_id = $1 AND report_id = $2',
      [newUserId, testReport.id]
    );
    expect(favAfterUnlock.rows.length).toBe(1);

    // 用户执行取消收藏 toggle -> removed
    const { req: favReq2, res: favRes2, getStatus: favStatus2, getJson: favJson2 } = mockReqRes({
      method: 'POST',
      headers: {
        cookie: `gtb_session=${encodeSession({ userId: newUserId, role: 'user' })}`
      },
      body: {
        reportId: testReport.id
      }
    });
    await favoriteHandler(favReq2, favRes2);
    expect(favStatus2()).toBe(200);
    expect(favJson2().status).toBe('removed');

    // 用户再次收藏 -> added (已解锁，允许收藏)
    const { req: favReq3, res: favRes3, getStatus: favStatus3, getJson: favJson3 } = mockReqRes({
      method: 'POST',
      headers: {
        cookie: `gtb_session=${encodeSession({ userId: newUserId, role: 'user' })}`
      },
      body: {
        reportId: testReport.id
      }
    });
    await favoriteHandler(favReq3, favRes3);
    expect(favStatus3()).toBe(200);
    expect(favJson3().status).toBe('added');

    // 步骤 7: 下载已解锁报告的离线 HTML -> 下载额度从 5 扣减至 4，返回完整 HTML 内容
    const { req: downReq2, res: downRes2, getStatus: downStatus2, getData: downData2 } = mockReqRes({
      method: 'GET',
      headers: {
        cookie: `gtb_session=${encodeSession({ userId: newUserId, role: 'user' })}`
      },
      query: {
        reportId: testReport.id
      }
    });
    await downloadHandler(downReq2, downRes2);
    expect(downStatus2()).toBe(200);
    const htmlContent = downData2();
    expect(htmlContent).toContain('<!DOCTYPE html>');
    expect(htmlContent).toContain('北美头部五金零售商家得宝深度调研');
    expect(htmlContent).toContain('家得宝深度透析');

    const userAfterDownload = await dbClient.query('SELECT download_quota FROM users WHERE id = $1', [newUserId]);
    expect(userAfterDownload.rows[0].download_quota).toBe(4);

    // 步骤 8: 免费版邀请好友 -> 双方各得 +3 次解锁额度
    const friend1 = await createTestUser(dbClient, {
      phoneNumber: '13811112222',
      freeQuota: 10,
      downloadQuota: 5
    });
    const inviteRes1 = await processInvitation(newUserId, friend1.id, dbClient);
    expect(inviteRes1.success).toBe(true);

    const inviterQuery1 = await dbClient.query('SELECT free_quota, download_quota FROM users WHERE id = $1', [newUserId]);
    expect(inviterQuery1.rows[0].free_quota).toBe(12); // 9 + 3 = 12
    expect(inviterQuery1.rows[0].download_quota).toBe(4);

    const inviteeQuery1 = await dbClient.query('SELECT free_quota FROM users WHERE id = $1', [friend1.id]);
    expect(inviteeQuery1.rows[0].free_quota).toBe(13); // 10 + 3 = 13

    // 步骤 9: 用户升级为专业版 Pro -> 成为 Pro 邀请好友赠送 +10 次解锁 + 2 份下载
    await dbClient.query(`
      UPDATE users 
      SET member_type = 'pro', 
          free_quota = 50, 
          download_quota = 10,
          pro_subscribed_at = NOW(),
          pro_cycle_expires_at = NOW() + INTERVAL '1 month'
      WHERE id = $1
    `, [newUserId]);

    const friend2 = await createTestUser(dbClient, {
      phoneNumber: '13833334444',
      freeQuota: 10,
      downloadQuota: 5
    });
    const inviteRes2 = await processInvitation(newUserId, friend2.id, dbClient);
    expect(inviteRes2.success).toBe(true);

    const proInviterQuery = await dbClient.query('SELECT free_quota, download_quota FROM users WHERE id = $1', [newUserId]);
    expect(proInviterQuery.rows[0].free_quota).toBe(60); // 50 + 10 = 60
    expect(proInviterQuery.rows[0].download_quota).toBe(12); // 10 + 2 = 12

    const inviteeQuery2 = await dbClient.query('SELECT free_quota FROM users WHERE id = $1', [friend2.id]);
    expect(inviteeQuery2.rows[0].free_quota).toBe(13); // 10 + 3 = 13

    // 步骤 10: 模拟 Pro 自然月到期，验证 SSR Auth 自动刷新额度为 50次解锁 + 10份下载
    await dbClient.query(`
      UPDATE users
      SET free_quota = 2,
          download_quota = 0,
          pro_cycle_expires_at = NOW() - INTERVAL '1 minute'
      WHERE id = $1
    `, [newUserId]);

    const refreshedAuth = await resolveSsrAuth(mockContext, dbClient);
    expect(refreshedAuth.freeQuota).toBe(50);
    expect(refreshedAuth.downloadQuota).toBe(10);
    expect(refreshedAuth.memberType).toBe('pro');
  });
});
