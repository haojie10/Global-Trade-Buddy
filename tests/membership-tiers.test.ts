import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { Client } from 'pg';
import { createTestClient, cleanDatabase, createTestUser, mockReqRes } from './helpers/db-test-helper';
import signupHandler from '../pages/api/auth/signup';
import { resolveSsrAuth } from '../lib/ssr-auth';
import { encodeSession } from '../lib/auth';

describe('Membership Tiers & Quotas Test', () => {
  let dbClient: Client;

  beforeAll(async () => {
    dbClient = createTestClient();
    await dbClient.connect();
    await cleanDatabase(dbClient);

    // 预置验证码
    await dbClient.query(
      `INSERT INTO email_verifications (email, code, expired_at) 
       VALUES ('tier_user@gtb.com', '123456', NOW() + INTERVAL '100 years')`
    );
  });

  afterAll(async () => {
    await dbClient.end();
  });

  it('1. should grant 10 unlock quota and 5 download quota upon signup in promotion period', async () => {
    const { req, res, getStatus, getJson } = mockReqRes({
      method: 'POST',
      body: {
        nickname: '新用户',
        email: 'tier_user@gtb.com',
        password: 'Password123!',
        code: '123456',
      }
    });

    await signupHandler(req, res);
    expect(getStatus()).toBe(200);
    const json = getJson();
    expect(json.success).toBe(true);
    expect(json.user.freeQuota).toBe(10);
    expect(json.user.downloadQuota).toBe(5);
    expect(json.user.memberType).toBe('free');
  });

  it('2. should correctly resolve SSR auth with downloadQuota and memberType', async () => {
    const testUser = await createTestUser(dbClient, {
      email: 'ssr_test@gtb.com',
      freeQuota: 8,
      downloadQuota: 4,
      memberType: 'free'
    });

    const sessionCookie = encodeSession({ userId: testUser.id, role: 'user' });
    const mockContext = {
      req: {
        headers: {
          cookie: `gtb_session=${sessionCookie}`
        }
      },
      res: {}
    } as any;

    const auth = await resolveSsrAuth(mockContext, dbClient as any);
    expect(auth.userId).toBe(testUser.id);
    expect(auth.freeQuota).toBe(8);
    expect(auth.downloadQuota).toBe(4);
    expect(auth.memberType).toBe('free');
  });

  it('3. should auto-refresh Pro user quota to 50 unlocks and 10 downloads when monthly cycle expires', async () => {
    // 创建一个已过期的 Pro 用户（额度已用尽）
    const proUser = await createTestUser(dbClient, {
      email: 'expired_pro@gtb.com',
      freeQuota: 2,
      downloadQuota: 0,
      memberType: 'pro'
    });

    // 将其周期过期时间设为昨天
    await dbClient.query(
      `UPDATE users 
       SET pro_subscribed_at = NOW() - INTERVAL '2 months', 
           pro_cycle_expires_at = NOW() - INTERVAL '1 day' 
       WHERE id = $1`,
      [proUser.id]
    );

    const sessionCookie = encodeSession({ userId: proUser.id, role: 'user' });
    const mockContext = {
      req: {
        headers: {
          cookie: `gtb_session=${sessionCookie}`
        }
      },
      res: {}
    } as any;

    const auth = await resolveSsrAuth(mockContext, dbClient as any);
    expect(auth.userId).toBe(proUser.id);
    expect(auth.freeQuota).toBe(50);
    expect(auth.downloadQuota).toBe(10);
    expect(auth.memberType).toBe('pro');

    // 检查数据库记录已同步充能
    const userInDb = await dbClient.query('SELECT free_quota, download_quota FROM users WHERE id = $1', [proUser.id]);
    expect(userInDb.rows[0].free_quota).toBe(50);
    expect(userInDb.rows[0].download_quota).toBe(10);
  });
});
