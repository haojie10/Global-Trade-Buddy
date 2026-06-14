import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { Client } from 'pg';
import { createTestClient } from './helpers/db-test-helper';
import loginHandler from '../pages/api/auth/login';
import signupHandler from '../pages/api/auth/signup';

describe('Auth API Handlers Test', () => {
  let dbClient: Client;

  beforeAll(async () => {
    dbClient = createTestClient();
    await dbClient.connect();
    // 清理测试用户
    await dbClient.query('DELETE FROM users');
  });

  afterAll(async () => {
    await dbClient.end();
  });

  // Mock Request/Response 模拟对象生成器
  function mockReqRes(method: string, body: any) {
    const req = {
      method,
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
      // 支持 signup/login 设置 httpOnly Cookie
      setHeader(_name: string, _value: string) {
        return this;
      },
    } as any;
    return { req, res, getStatus: () => statusVal, getJson: () => jsonVal };
  }

  it('should successfully register a new user', async () => {
    const { req, res, getStatus, getJson } = mockReqRes('POST', {
      phone: '13888880001',
      email: 'testuser1@gtb.com',
      password: 'mypassword',
      role: 'user',
    });

    await signupHandler(req, res);
    expect(getStatus()).toBe(200);
    expect(getJson().success).toBe(true);
    expect(getJson().user.phoneNumber).toBe('13888880001');
    expect(getJson().user.role).toBe('user');
  });

  it('should fail to register a user with duplicate email', async () => {
    const { req, res, getStatus } = mockReqRes('POST', {
      phone: '13888880002',
      email: 'testuser1@gtb.com',
      password: 'mypassword2',
      role: 'user',
    });

    await signupHandler(req, res);
    expect(getStatus()).toBe(400);
  });

  it('should successfully login a registered user', async () => {
    const { req, res, getStatus, getJson } = mockReqRes('POST', {
      phoneOrEmail: 'testuser1@gtb.com',
      password: 'mypassword',
    });

    await loginHandler(req, res);
    expect(getStatus()).toBe(200);
    expect(getJson().success).toBe(true);
    expect(getJson().user.role).toBe('user');
  });

  it('should fail login with wrong password', async () => {
    const { req, res, getStatus } = mockReqRes('POST', {
      phoneOrEmail: 'testuser1@gtb.com',
      password: 'wrongpassword',
    });

    await loginHandler(req, res);
    expect(getStatus()).toBe(401);
  });
});
