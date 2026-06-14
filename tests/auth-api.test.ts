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
  });

  afterAll(async () => {
    await dbClient.end();
  });


  it('should successfully register a new user', async () => {
    const { req, res, getStatus, getJson } = mockReqRes({
      method: 'POST',
      body: {
        phone: '13888880001',
        email: 'testuser1@gtb.com',
        password: 'mypassword',
        role: 'user',
      }
    });

    await signupHandler(req, res);
    expect(getStatus()).toBe(200);
    expect(getJson().success).toBe(true);
    expect(getJson().user.phoneNumber).toBe('13888880001');
    expect(getJson().user.role).toBe('user');
  });

  it('should fail to register a user with duplicate email', async () => {
    const { req, res, getStatus } = mockReqRes({
      method: 'POST',
      body: {
        phone: '13888880002',
        email: 'testuser1@gtb.com',
        password: 'mypassword2',
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
        password: 'mypassword',
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
