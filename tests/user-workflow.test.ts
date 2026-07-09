import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { Client } from 'pg';
import { createTestClient, cleanDatabase, mockReqRes, createTestReport, createTestUser } from './helpers/db-test-helper';
import { encodeSession } from '../lib/auth';

// 引入相关的 API Handlers
import signupHandler from '../pages/api/auth/signup';
import loginHandler from '../pages/api/auth/login';
import sendCodeHandler from '../pages/api/auth/send-code';
import reportDetailHandler from '../pages/api/user/report-detail';
import unlockHandler from '../pages/api/user/unlock-action';
import favoriteHandler from '../pages/api/user/favorite';
import noteHandler from '../pages/api/user/note';
import inviteHandler from '../pages/api/user/invite';
import graphHandler from '../pages/api/user/graph';
import testRechargeHandler from '../pages/api/user/test-recharge';
import resetPasswordHandler from '../pages/api/auth/reset-password';
import deleteReportHandler from '../pages/api/admin/reports/delete';

describe('User Entire Workflow Integration Test', () => {
  let dbClient: Client;
  let testUserId: string;
  let testSessionCookie: string;
  let reportId1: string;
  let reportId2: string;
  let reportId3: string;
  let reportId4: string;
  let referrerId: string;

  beforeAll(async () => {
    dbClient = createTestClient();
    await dbClient.connect();

    // 清理数据库状态
    await cleanDatabase(dbClient);

    // 提前插入一些测试报告，用于用户后面解锁
    const rep1 = await createTestReport(dbClient, {
      title: '如何进军中东五金市场调研报告',
      category: 'customer',
      marketRegion: '中东',
      summary: '中东地区的建筑五金需求分析...',
      contentHtml: '<h1>中东市场独家机密报告</h1><p>核心渠道买家名录...</p>'
    });
    reportId1 = rep1.id;

    const rep2 = await createTestReport(dbClient, {
      title: '北美铝合金轮毂进口大买家分析',
      category: 'customer',
      marketRegion: '北美',
      summary: '针对北美连锁超市的轮毂供应链透析...',
      contentHtml: '<h1>北美轮毂供应链机密</h1><p>全美最大的3个零售商...</p>'
    });
    reportId2 = rep2.id;

    const rep3 = await createTestReport(dbClient, {
      title: '全球工程车配件贸易大盘点',
      category: 'product',
      marketRegion: '全球',
      summary: '全球重载车桥与车轮需求调研...',
      contentHtml: '<h1>车配件出海洞察</h1><p>关税限制和应对指南...</p>'
    });
    reportId3 = rep3.id;

    const rep4 = await createTestReport(dbClient, {
      title: '欧洲紧固件准入规范与供应链准则',
      category: 'product',
      marketRegion: '欧盟',
      summary: '欧洲高精度螺栓认证要求与买家标准...',
      contentHtml: '<h1>欧洲紧固件机密</h1><p>准入条件极其苛刻...</p>'
    });
    reportId4 = rep4.id;

    // 创建一个测试邀请人
    const refUser = await createTestUser(dbClient, {
      phoneNumber: '13900001111',
      freeQuota: 2,
    });
    referrerId = refUser.id;
  });

  afterAll(async () => {
    await dbClient.end();
  });

  // 1. 注册新用户 (含验证码发送与校验)
  it('1. should register a new user with default quota after email verification', async () => {
    const email = 'workflow_test@gtb.com';

    // 1.1 请求发送邮箱验证码
    const { req: codeReq, res: codeRes, getStatus: codeStatus } = mockReqRes({
      method: 'POST',
      body: { email }
    });
    await sendCodeHandler(codeReq, codeRes);
    expect(codeStatus()).toBe(200);

    // 1.2 从测试数据库提取刚生成的验证码
    const verifyDbRes = await dbClient.query(
      'SELECT code FROM email_verifications WHERE email = $1 ORDER BY created_at DESC LIMIT 1',
      [email]
    );
    expect(verifyDbRes.rows.length).toBe(1);
    const code = verifyDbRes.rows[0].code;

    // 1.3 携带验证码与昵称注册
    const { req, res, getStatus, getJson } = mockReqRes({
      method: 'POST',
      body: {
        nickname: '测试名',
        email,
        password: 'Password123',
        code
      }
    });

    await signupHandler(req, res);

    expect(getStatus()).toBe(200);
    const json = getJson();
    expect(json.success).toBe(true);
    expect(json.user.role).toBe('user');
    expect(json.user.freeQuota).toBe(3); // 确认默认赠送 3 个额度
    expect(json.user.nickname).toBe('测试名');

    testUserId = json.user.id;
    // 使用 auth 模块计算出合法的签名会话 Cookie
    testSessionCookie = encodeSession({ userId: testUserId, role: 'user' });
  });

  // 2. 访问未解锁报告详情
  it('2. should restrict full content for un-unlocked reports', async () => {
    const { req, res, getStatus, getJson } = mockReqRes({
      method: 'GET',
      query: { reportId: reportId1 },
      cookies: { gtb_session: testSessionCookie }
    });

    await reportDetailHandler(req, res);

    expect(getStatus()).toBe(200);
    const json = getJson();
    expect(json.id).toBe(reportId1);
    expect(json.isUnlocked).toBe(false);
    expect(json.title).toBe('如何进军中东五金市场调研报告');
    expect(json.summary).toBe('中东地区的建筑五金需求分析...');
    expect(json.content_html).toBeNull(); // 强制为 null，不允许偷看
  });

  // 3. 解锁报告扣减额度
  it('3. should successfully unlock a report and deduct quota', async () => {
    const { req, res, getStatus, getJson } = mockReqRes({
      method: 'POST',
      body: { reportId: reportId1 },
      cookies: { gtb_session: testSessionCookie }
    });

    await unlockHandler(req, res);

    expect(getStatus()).toBe(200);
    const json = getJson();
    expect(json.success).toBe(true);
    expect(json.content_html).toContain('核心渠道买家名录');

    // 检查数据库确认额度被扣减为 2
    const userRes = await dbClient.query('SELECT free_quota FROM users WHERE id = $1', [testUserId]);
    expect(userRes.rows[0].free_quota).toBe(2);
  });

  // 4. 再次访问详情应该可以拿到 content_html
  it('4. should allow accessing full content once unlocked', async () => {
    const { req, res, getStatus, getJson } = mockReqRes({
      method: 'GET',
      query: { reportId: reportId1 },
      cookies: { gtb_session: testSessionCookie }
    });

    await reportDetailHandler(req, res);

    expect(getStatus()).toBe(200);
    const json = getJson();
    expect(json.isUnlocked).toBe(true);
    expect(json.content_html).toContain('<h1>中东市场独家机密报告</h1>');
  });

  // 5. 个人图谱应该只展示已收藏的节点（解锁自动收藏）
  it('5. should show auto-favorited report node in user personal graph after unlock', async () => {
    const { req, res, getStatus, getJson } = mockReqRes({
      method: 'GET',
      cookies: { gtb_session: testSessionCookie }
    });

    await graphHandler(req, res);

    expect(getStatus()).toBe(200);
    const graph = getJson();
    // 因为第3步解锁时自动加入了收藏，所以这里节点数为 1
    const reportNodes = graph.nodes.filter((n: any) => n.node_type === 'report');
    expect(reportNodes.length).toBe(1);
    expect(reportNodes[0].id).toBe(reportId1);
  });

  // 6. 收藏与取消收藏操作以及图谱净化联动
  it('6. should toggle favorite status and prune/restore graph nodes', async () => {
    // 6.1 此时属于已收藏状态。调用接口切换收藏，由于是 Toggle，此时应该会触发取消收藏（removed）
    const { req: req1, res: res1, getStatus: getStatus1, getJson: getJson1 } = mockReqRes({
      method: 'POST',
      body: { reportId: reportId1 },
      cookies: { gtb_session: testSessionCookie }
    });

    await favoriteHandler(req1, res1);
    expect(getStatus1()).toBe(200);
    expect(getJson1().status).toBe('removed');

    // 校验数据库：收藏记录已清除
    let favRes = await dbClient.query('SELECT id FROM favorites WHERE user_id = $1 AND report_id = $2', [testUserId, reportId1]);
    expect(favRes.rows.length).toBe(0);

    // 校验图谱：因为取消了收藏，图谱应该被净化变空（0 节点）
    const { req: gReq1, res: gRes1, getJson: gJson1 } = mockReqRes({
      method: 'GET',
      cookies: { gtb_session: testSessionCookie }
    });
    await graphHandler(gReq1, gRes1);
    const graph1 = gJson1();
    const reportNodes1 = graph1.nodes.filter((n: any) => n.node_type === 'report');
    expect(reportNodes1.length).toBe(0); // 成功被精简隐藏！

    // 6.2 再次请求重新加入收藏
    const { req: req2, res: res2, getStatus: getStatus2, getJson: getJson2 } = mockReqRes({
      method: 'POST',
      body: { reportId: reportId1 },
      cookies: { gtb_session: testSessionCookie }
    });

    await favoriteHandler(req2, res2);
    expect(getStatus2()).toBe(200);
    expect(getJson2().status).toBe('added');

    // 校验数据库：恢复收藏
    favRes = await dbClient.query('SELECT id FROM favorites WHERE user_id = $1 AND report_id = $2', [testUserId, reportId1]);
    expect(favRes.rows.length).toBe(1);

    // 校验图谱：恢复显示
    const { req: gReq2, res: gRes2, getJson: gJson2 } = mockReqRes({
      method: 'GET',
      cookies: { gtb_session: testSessionCookie }
    });
    await graphHandler(gReq2, gRes2);
    const graph2 = gJson2();
    const reportNodes2 = graph2.nodes.filter((n: any) => n.node_type === 'report');
    expect(reportNodes2.length).toBe(1); // 成功恢复！
  });

  // 7. 保存笔记并读取
  it('7. should save and load notes for report', async () => {
    // 7.1 保存笔记
    const { req: req1, res: res1, getStatus: getStatus1 } = mockReqRes({
      method: 'POST',
      query: { reportId: reportId1 },
      body: { content: '我们公司下个季度需要联系中东五金买家。' },
      cookies: { gtb_session: testSessionCookie }
    });

    await noteHandler(req1, res1);
    expect(getStatus1()).toBe(200);

    // 7.2 获取笔记
    const { req: req2, res: res2, getStatus: getStatus2, getJson: getJson2 } = mockReqRes({
      method: 'GET',
      query: { reportId: reportId1 },
      cookies: { gtb_session: testSessionCookie }
    });

    await noteHandler(req2, res2);
    expect(getStatus2()).toBe(200);
    const json = getJson2();
    expect(json.success).toBe(true);
    expect(json.note.content).toBe('我们公司下个季度需要联系中东五金买家。');
  });

  // 8. 邀请裂变增加额度
  it('8. should bind invitee and reward referrer and invitee', async () => {
    const { req, res, getStatus, getJson } = mockReqRes({
      method: 'POST',
      body: { referrerId: referrerId },
      cookies: { gtb_session: testSessionCookie }
    });

    await inviteHandler(req, res);

    expect(getStatus()).toBe(200);
    expect(getJson().success).toBe(true);

    // 校验双方的额度奖励：邀请人 (2->3), 当前用户被邀请人 (2->3)
    const refRes = await dbClient.query('SELECT free_quota FROM users WHERE id = $1', [referrerId]);
    const userRes = await dbClient.query('SELECT free_quota FROM users WHERE id = $1', [testUserId]);

    expect(refRes.rows[0].free_quota).toBe(3);
    expect(userRes.rows[0].free_quota).toBe(3);
  });

  // 9. 额度扣减耗尽后，应该拦截解锁
  it('9. should prevent unlocking once free quota is fully exhausted', async () => {
    // 当前额度是 3 (来自 3 - 1 + 1)
    // 解锁报告 2，额度扣减为 2
    const { req: req2, res: res2 } = mockReqRes({
      method: 'POST',
      body: { reportId: reportId2 },
      cookies: { gtb_session: testSessionCookie }
    });
    await unlockHandler(req2, res2);

    // 解锁报告 3，额度扣减为 1
    const { req: req3, res: res3 } = mockReqRes({
      method: 'POST',
      body: { reportId: reportId3 },
      cookies: { gtb_session: testSessionCookie }
    });
    await unlockHandler(req3, res3);

    // 解锁报告 4，额度扣减为 0
    const { req: req4, res: res4 } = mockReqRes({
      method: 'POST',
      body: { reportId: reportId4 },
      cookies: { gtb_session: testSessionCookie }
    });
    await unlockHandler(req4, res4);

    // 验证额度已经降为 0
    const userRes = await dbClient.query('SELECT free_quota FROM users WHERE id = $1', [testUserId]);
    expect(userRes.rows[0].free_quota).toBe(0);

    // 再次创建一个新的测试报告 5，试图解锁
    const rep5 = await createTestReport(dbClient, {
      title: '紧固件最终测试报告',
      category: 'product',
    });

    const { req: req5, res: res5, getStatus: getStatus5, getJson: getJson5 } = mockReqRes({
      method: 'POST',
      body: { reportId: rep5.id },
      cookies: { gtb_session: testSessionCookie }
    });

    await unlockHandler(req5, res5);

    // 验证被拦截，返回 400，以及提示额度不足
    expect(getStatus5()).toBe(400);
    expect(getJson5().success).toBe(false);
    expect(getJson5().error).toContain('额度不足');
  });

  // 10. 测试充值渠道
  it('10. should allow recharging quota via test-recharge API', async () => {
    const { req, res, getStatus, getJson } = mockReqRes({
      method: 'POST',
      cookies: { gtb_session: testSessionCookie }
    });

    await testRechargeHandler(req, res);

    expect(getStatus()).toBe(200);
    const json = getJson();
    expect(json.success).toBe(true);
    expect(json.newQuota).toBe(10); // 确认从 0 充值到 10

    // 数据库中的额度确为 10
    const userRes = await dbClient.query('SELECT free_quota FROM users WHERE id = $1', [testUserId]);
    expect(userRes.rows[0].free_quota).toBe(10);
  });

  // 11. 测试重置密码
  it('11. should allow resetting password and logging in with the new password', async () => {
    const email = 'workflow_test@gtb.com';
    const newPassword = 'NewPassword777';

    // 11.1 请求发信
    const { req: sendReq, res: sendRes, getStatus: sendStatus } = mockReqRes({
      method: 'POST',
      body: { email }
    });
    await sendCodeHandler(sendReq, sendRes);
    expect(sendStatus()).toBe(200);

    // 11.2 提提取最新验证码
    const verifyDbRes = await dbClient.query(
      'SELECT code FROM email_verifications WHERE email = $1 ORDER BY created_at DESC LIMIT 1',
      [email]
    );
    expect(verifyDbRes.rows.length).toBe(1);
    const code = verifyDbRes.rows[0].code;

    // 11.3 提交重置密码请求
    const { req: resetReq, res: resetRes, getStatus: resetStatus, getJson: resetJson } = mockReqRes({
      method: 'POST',
      body: { email, password: newPassword, code }
    });
    await resetPasswordHandler(resetReq, resetRes);
    expect(resetStatus()).toBe(200);
    expect(resetJson().success).toBe(true);

    // 11.4 使用新密码登录校验
    const { req: loginReq, res: loginRes, getStatus: loginStatus, getJson: loginJson } = mockReqRes({
      method: 'POST',
      body: { phoneOrEmail: email, password: newPassword }
    });
    await loginHandler(loginReq, loginRes);
    expect(loginStatus()).toBe(200);
    expect(loginJson().success).toBe(true);
    expect(loginJson().user.email).toBe(email);
  });

  // 12. 测试管理员删除报告权限及级联关系
  it('12. should restrict delete-report to admin and process CASCADE database deletions', async () => {
    // 12.1 模拟普通业务员(非管理员)删除报告，预期返回 403 权限被拦截
    const { req: userReq, res: userRes, getStatus: userStatus, getJson: userJson } = mockReqRes({
      method: 'POST',
      body: { reportId: reportId1 },
      cookies: { gtb_session: testSessionCookie } // 这是一个普通用户的 session Cookie
    });
    await deleteReportHandler(userReq, userRes);
    expect(userStatus()).toBe(403);
    expect(userJson().error).toContain('权限不足');

    // 创建管理员 session Cookie
    const adminSessionCookie = encodeSession({ userId: 'admin-test-id', role: 'admin' });

    // 12.2 模拟管理员用户删除报告，预期返回 200 并物理删除成功
    const { req: adminReq, res: adminRes, getStatus: adminStatus, getJson: adminJson } = mockReqRes({
      method: 'POST',
      body: { reportId: reportId1 },
      cookies: { gtb_session: adminSessionCookie }
    });
    await deleteReportHandler(adminReq, adminRes);
    expect(adminStatus()).toBe(200);
    expect(adminJson().success).toBe(true);

    // 12.3 验证数据库中 reports 表已无该行
    const repDbRes = await dbClient.query('SELECT COUNT(*) FROM reports WHERE id = $1', [reportId1]);
    expect(repDbRes.rows[0].count).toBe('0');

    // 12.4 验证级联删除：该报告在 unlocks 表中的关联记录也被自动 CASCADE 物理删除！
    const unlockDbRes = await dbClient.query('SELECT COUNT(*) FROM unlocks WHERE report_id = $1', [reportId1]);
    expect(unlockDbRes.rows[0].count).toBe('0');
  });
});
