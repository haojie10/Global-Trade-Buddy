import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createTestClient, cleanDatabase, mockReqRes } from './helpers/db-test-helper';
import cronCleanupHandler from '../pages/api/cron/cleanup';
import overviewHandler from '../pages/api/admin/stats/overview';
import { encodeSession } from '../lib/auth';

describe('Cron Cleanup & Log Aggregation (P0 & P1)', () => {
  let client: any;

  beforeEach(async () => {
    client = createTestClient();
    await client.connect();
    await cleanDatabase(client);
  });

  afterEach(async () => {
    if (client) {
      await client.end();
    }
    vi.restoreAllMocks();
  });

  it('1. 应成功将 90 天之前的日志归档至 daily_stats_summary 并从明细表中清理', async () => {
    // 模拟报告 ID
    const reportRes = await client.query(
      "INSERT INTO reports (title, category) VALUES ('清理测试报告', 'product') RETURNING id"
    );
    const reportId = reportRes.rows[0].id;

    // 插入 100 天前的 page_views (2 条)
    await client.query(
      `INSERT INTO page_views (content_type, content_id, created_at)
       VALUES ('report', $1, NOW() - INTERVAL '100 days'),
              ('report', $1, NOW() - INTERVAL '100 days')`,
      [reportId]
    );

    // 插入 10 天前的 page_views (1 条，保留)
    await client.query(
      `INSERT INTO page_views (content_type, content_id, created_at)
       VALUES ('report', $1, NOW() - INTERVAL '10 days')`,
      [reportId]
    );

    // 插入 100 天前的 search_logs (3 条)
    await client.query(
      `INSERT INTO search_logs (query, results_count, created_at)
       VALUES ('刹车片', 5, NOW() - INTERVAL '100 days'),
              ('铝合金轮毂', 3, NOW() - INTERVAL '100 days'),
              ('紧固件', 0, NOW() - INTERVAL '100 days')`
    );

    // 插入已过期的验证码与未过期的验证码
    await client.query(
      `INSERT INTO email_verifications (email, code, expired_at)
       VALUES ('expired@test.com', '123456', NOW() - INTERVAL '1 hour'),
              ('valid@test.com', '654321', NOW() + INTERVAL '10 minutes')`
    );

    // 执行归档与清理函数（保留 90 天数据）
    const cleanRes = await client.query('SELECT aggregate_and_clean_logs(90) as result');
    const result = cleanRes.rows[0].result;

    expect(result.status).toBe('success');
    expect(result.cleaned_page_views).toBe(2);
    expect(result.cleaned_search_logs).toBe(3);
    expect(result.cleaned_verifications).toBe(1);
    expect(result.aggregated_days).toBeGreaterThanOrEqual(1);

    // 验证 page_views：100 天前的已删，10 天前的保留
    const pvRes = await client.query('SELECT COUNT(*)::int as count FROM page_views');
    expect(pvRes.rows[0].count).toBe(1);

    // 验证 search_logs：100 天前的已删
    const slRes = await client.query('SELECT COUNT(*)::int as count FROM search_logs');
    expect(slRes.rows[0].count).toBe(0);

    // 验证 email_verifications：过期的已删，未过期的保留
    const evRes = await client.query('SELECT email FROM email_verifications');
    expect(evRes.rows.length).toBe(1);
    expect(evRes.rows[0].email).toBe('valid@test.com');

    // 验证 daily_stats_summary 聚合表成功写入数据
    const summaryRes = await client.query('SELECT * FROM daily_stats_summary');
    expect(summaryRes.rows.length).toBeGreaterThanOrEqual(1);
    expect(summaryRes.rows[0].total_pv).toBe(2);
    expect(summaryRes.rows[0].total_searches).toBe(3);
  });

  it('2. API /api/cron/cleanup 鉴权机制校验', async () => {
    process.env.CRON_SECRET = 'my_super_secret_cron_key';

    // A. 未提供 Header 应返回 401
    const { req: req1, res: res1, getStatus: getStatus1 } = mockReqRes({
      method: 'POST'
    });
    await cronCleanupHandler(req1, res1);
    expect(getStatus1()).toBe(401);

    // B. 提供正确 Authorization Header 应成功执行
    const { req: req2, res: res2, getStatus: getStatus2, getJson: getJson2 } = mockReqRes({
      method: 'POST',
      headers: {
        authorization: 'Bearer my_super_secret_cron_key'
      }
    });
    await cronCleanupHandler(req2, res2);
    expect(getStatus2()).toBe(200);
    expect(getJson2().success).toBe(true);

    delete process.env.CRON_SECRET;
  });

  it('3. 融合查询：删除了 100 天前的明细后，admin/stats/overview 聚合趋势仍能查出数据', async () => {
    // 模拟创建管理员用户
    const adminRes = await client.query(
      "INSERT INTO users (email, role) VALUES ('admin@gtb.com', 'admin') RETURNING id"
    );
    const adminId = adminRes.rows[0].id;

    // 手动向聚合表插入 100 天前的归档数据
    const pastDate = new Date(Date.now() - 100 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    await client.query(
      `INSERT INTO daily_stats_summary (date, total_pv, total_uv, total_searches)
       VALUES ($1, 150, 45, 30)`,
      [pastDate]
    );

    // 调用 overview 接口 (90d 范围)
    const { req, res, getStatus, getJson } = mockReqRes({
      method: 'GET',
      query: { range: '90d' },
      cookies: {
        gtb_session: encodeSession({ userId: adminId, role: 'admin' })
      }
    });

    await overviewHandler(req, res);
    expect(getStatus()).toBe(200);
    const data = getJson();
    expect(data.viewsTrend).toBeDefined();
  });
});
