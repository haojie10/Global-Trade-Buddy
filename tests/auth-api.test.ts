import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { Client } from 'pg';
import { createTestClient, cleanDatabase, mockReqRes } from './helpers/db-test-helper';
import loginHandler from '../pages/api/auth/login';
import signupHandler from '../pages/api/auth/signup';

describe('Auth API Handlers Test', () => {
  let dbClient: Client;

  beforeAll(async () => {
    dbClient = createTestClient();
    await dbClient.connect();
    // 清理测试数据库
    await cleanDatabase(dbClient);

    // 写入测试邮箱验证码
    await dbClient.query(
      `INSERT INTO email_verifications (email, code, expired_at) 
       VALUES ('testuser1@gtb.com', '123456', NOW() + INTERVAL '100 years')`
    );
  });

  afterAll(async () => {
    await dbClient.end();
  });


  it('should successfully register a new user', async () => {
    const { req, res, getStatus, getJson } = mockReqRes({
      method: 'POST',
      body: {
        nickname: '测试用户1',
        email: 'testuser1@gtb.com',
        password: 'mypassword123',
        code: '123456',
        role: 'user',
      }
    });

    await signupHandler(req, res);
    expect(getStatus()).toBe(200);
    expect(getJson().success).toBe(true);
    expect(getJson().user.email).toBe('testuser1@gtb.com');
    expect(getJson().user.role).toBe('user');
  });

  it('should fail to register a user with duplicate email', async () => {
    const { req, res, getStatus } = mockReqRes({
      method: 'POST',
      body: {
        nickname: '测试用户2',
        email: 'testuser1@gtb.com',
        password: 'mypassword123',
        code: '123456',
        role: 'user',
      }
    });

    await signupHandler(req, res);
    expect(getStatus()).toBe(400);
  });

  it('should successfully login a registered user', async () => {
    const { req, res, getStatus, getJson } = mockReqRes({
      method: 'POST',
      body: {
        phoneOrEmail: 'testuser1@gtb.com',
        password: 'mypassword123',
      }
    });

    await loginHandler(req, res);
    expect(getStatus()).toBe(200);
    expect(getJson().success).toBe(true);
    expect(getJson().user.role).toBe('user');
  });

  it('should fail login with wrong password', async () => {
    const { req, res, getStatus } = mockReqRes({
      method: 'POST',
      body: {
        phoneOrEmail: 'testuser1@gtb.com',
        password: 'wrongpassword',
      }
    });

    await loginHandler(req, res);
    expect(getStatus()).toBe(401);
  });
});
