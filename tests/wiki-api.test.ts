import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import crypto from 'crypto';
import pool from '../lib/db';
import { encodeSession } from '../lib/auth';
import * as storage from '../lib/storage';
import { buildSampleFlowData } from './wiki-schema.test';
import agentWikiHandler, { config as agentWikiConfig } from '../pages/api/agent/wiki';
import adminWikiHandler from '../pages/api/admin/wiki';
import llmsHandler from '../pages/api/llms';
import wikiMarkdownHandler from '../pages/api/wiki/[slug]/markdown';

interface StoredWikiRow {
  id: string;
  slug: string;
  title: string;
  summary: string;
  country_code: string;
  country_name: string;
  market_region: string;
  category_id: number | null;
  industry_name: string;
  hs_code_6: string | null;
  archetype_id: string;
  flow_data: any;
  content_md: string;
  faq_items: any[];
  sources: any[];
  video_url: string | null;
  cover_image: string | null;
  status: 'draft' | 'published';
  view_count: number;
  baidu_pushed_at: Date | null;
  published_at: Date | null;
  created_at: Date;
  updated_at: Date;
}

function createMockReqRes(options: {
  method?: string;
  url?: string;
  body?: any;
  query?: Record<string, string | string[]>;
  headers?: Record<string, string>;
  session?: { userId: string; role: string };
} = {}) {
  const cookies: Record<string, string> = {};
  if (options.session) {
    cookies.gtb_session = encodeSession(options.session);
  }

  const req = {
    method: options.method || 'GET',
    url: options.url || '/api/test',
    body: options.body ?? {},
    query: options.query ?? {},
    headers: options.headers ?? {},
    cookies,
  } as any;

  let statusCode = 200;
  let jsonPayload: any = null;
  let bodyData: any = null;
  const responseHeaders = new Map<string, string>();

  const res = {
    status(code: number) {
      statusCode = code;
      return this;
    },
    json(data: any) {
      jsonPayload = data;
      bodyData = data;
      return this;
    },
    send(data: any) {
      bodyData = data;
      return this;
    },
    setHeader(key: string, value: string | string[]) {
      responseHeaders.set(key.toLowerCase(), Array.isArray(value) ? value.join(', ') : String(value));
      return this;
    },
  } as any;

  return {
    req,
    res,
    getStatus: () => statusCode,
    getJson: () => jsonPayload,
    getData: () => bodyData,
    getHeader: (key: string) => responseHeaders.get(key.toLowerCase()),
  };
}

/**
 * 构造可跨多次 API 调用共享的内存 PostgreSQL 模拟库
 */
function createSharedWikiDb() {
  const rowsById = new Map<string, StoredWikiRow>();
  const executedQueries: Array<{ sql: string; params: unknown[] }> = [];
  let seq = 1;

  const findBySlug = (slug: string): StoredWikiRow | undefined => {
    for (const row of rowsById.values()) {
      if (row.slug === slug) return row;
    }
    return undefined;
  };

  const matchIlike = (haystack: string, pattern: string): boolean => {
    // 将带 \ 转义的 SQL ILIKE 模式转为正则
    let regexStr = '^';
    for (let i = 0; i < pattern.length; i++) {
      const ch = pattern[i];
      if (ch === '\\' && i + 1 < pattern.length) {
        regexStr += pattern[i + 1].replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        i++;
      } else if (ch === '%') {
        regexStr += '.*';
      } else if (ch === '_') {
        regexStr += '.';
      } else {
        regexStr += ch.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      }
    }
    regexStr += '$';
    return new RegExp(regexStr, 'i').test(haystack || '');
  };

  const mockClient = {
    query: vi.fn(async (sqlText: unknown, values?: unknown[]) => {
      const sql = typeof sqlText === 'string' ? sqlText : String((sqlText as { text?: string })?.text || '');
      const params = Array.isArray(values) ? values : [];
      executedQueries.push({ sql, params });

      if (sql.trim() === 'BEGIN' || sql.trim() === 'COMMIT' || sql.trim() === 'ROLLBACK') {
        return { rows: [], rowCount: 0 };
      }

      // 1. upsertWikiEntry
      if (sql.includes('INSERT INTO wiki_entries') && sql.includes('(xmax = 0) AS inserted')) {
        const [
          slug,
          title,
          summary,
          country_code,
          country_name,
          market_region,
          category_id,
          industry_name,
          hs_code_6,
          archetype_id,
          flow_data_json,
          content_md,
          faq_items_json,
          sources_json,
          video_url,
          cover_image,
          status,
        ] = params as any[];

        const existing = findBySlug(slug);
        const now = new Date();
        const id = existing ? existing.id : crypto.randomUUID();
        const record: StoredWikiRow = {
          id,
          slug,
          title,
          summary,
          country_code,
          country_name,
          market_region,
          category_id,
          industry_name,
          hs_code_6,
          archetype_id,
          flow_data: JSON.parse(flow_data_json),
          content_md,
          faq_items: JSON.parse(faq_items_json),
          sources: JSON.parse(sources_json),
          video_url: video_url ?? existing?.video_url ?? null,
          cover_image: cover_image ?? existing?.cover_image ?? null,
          status,
          view_count: existing?.view_count ?? 0,
          baidu_pushed_at: existing?.baidu_pushed_at ?? null,
          published_at: existing?.published_at ?? (status === 'published' ? now : null),
          created_at: existing?.created_at ?? now,
          updated_at: new Date(now.getTime() + seq++),
        };
        rowsById.set(id, record);
        return { rows: [{ id: record.id, slug: record.slug, inserted: !existing }], rowCount: 1 };
      }

      // 2. GET /api/llms
      if (sql.includes('FROM wiki_entries') && sql.includes("status = 'published'") && sql.includes('LIMIT 500')) {
        const rows = Array.from(rowsById.values())
          .filter((r) => r.status === 'published')
          .sort((a, b) => b.updated_at.getTime() - a.updated_at.getTime())
          .slice(0, 500)
          .map((r) => ({ ...r }));
        return { rows, rowCount: rows.length };
      }

      // 3. GET /api/wiki/[slug]/markdown
      if (sql.includes('FROM wiki_entries') && sql.includes('WHERE slug = $1') && sql.includes("status = 'published'")) {
        const slug = String(params[0] || '');
        const found = findBySlug(slug);
        if (!found || found.status !== 'published') {
          return { rows: [], rowCount: 0 };
        }
        return { rows: [{ ...found }], rowCount: 1 };
      }

      // 4. GET /api/admin/wiki?id=...
      if (sql.includes('SELECT * FROM wiki_entries') && sql.includes('WHERE id = $1')) {
        const id = String(params[0] || '');
        const found = rowsById.get(id);
        return found ? { rows: [{ ...found }], rowCount: 1 } : { rows: [], rowCount: 0 };
      }

      // 5. GET /api/admin/wiki (COUNT / 分页列表)
      if (sql.includes('FROM wiki_entries') && (sql.includes('COUNT(*)') || sql.includes('LIMIT $'))) {
        let filtered = Array.from(rowsById.values());

        // 解析参数：若包含 status 过滤或 ILIKE 过滤
        for (const p of params) {
          if (p === 'draft' || p === 'published') {
            filtered = filtered.filter((r) => r.status === p);
          } else if (typeof p === 'string' && p.startsWith('%') && p.endsWith('%')) {
            filtered = filtered.filter(
              (r) =>
                matchIlike(r.title, p) ||
                matchIlike(r.slug, p) ||
                matchIlike(r.country_name, p) ||
                matchIlike(r.industry_name, p)
            );
          }
        }

        if (sql.includes('COUNT(*)')) {
          return { rows: [{ total: filtered.length, count: String(filtered.length) }], rowCount: 1 };
        }

        const limit = Number(params[params.length - 2] ?? 20);
        const offset = Number(params[params.length - 1] ?? 0);
        const sorted = filtered
          .sort((a, b) => b.updated_at.getTime() - a.updated_at.getTime())
          .slice(offset, offset + limit)
          .map((r) => ({ ...r }));
        return { rows: sorted, rowCount: sorted.length };
      }

      // 6. PUT /api/admin/wiki
      if (sql.includes('UPDATE wiki_entries') && sql.includes('SET')) {
        const id = String(params[params.length - 1] || '');
        const existing = rowsById.get(id);
        if (!existing) {
          return { rows: [], rowCount: 0 };
        }

        const updated: StoredWikiRow = { ...existing, updated_at: new Date(Date.now() + seq++) };
        const setClause = sql.split('SET')[1].split('WHERE')[0];
        const assignments = setClause.split(',').map((s) => s.trim());

        for (const assign of assignments) {
          const match = assign.match(/^([a-z_]+)\s*=\s*\$(\d+)/i);
          if (match) {
            const col = match[1];
            const val = params[Number(match[2]) - 1];
            if (col === 'faq_items' || col === 'sources') {
              (updated as any)[col] = typeof val === 'string' ? JSON.parse(val) : val;
            } else {
              (updated as any)[col] = val;
            }
          }
        }

        if (updated.status === 'published' && !updated.published_at) {
          updated.published_at = new Date();
        }

        rowsById.set(id, updated);
        return { rows: [{ ...updated }], rowCount: 1 };
      }

      // 7. DELETE /api/admin/wiki
      if (sql.includes('DELETE FROM wiki_entries') && sql.includes('WHERE id = $1')) {
        const id = String(params[0] || '');
        const existing = rowsById.get(id);
        if (!existing) {
          return { rows: [], rowCount: 0 };
        }
        rowsById.delete(id);
        return { rows: [{ id }], rowCount: 1 };
      }

      throw new Error(`Unexpected SQL in wiki-api mock DB: ${sql}`);
    }),
    release: vi.fn(),
  };

  return { mockClient, rowsById, executedQueries };
}

describe('行业百科 Agent 推送、管理后台与 GEO 直读 API', () => {
  let sharedDb: ReturnType<typeof createSharedWikiDb>;
  const origNodeEnv = process.env.NODE_ENV;
  const origAgentKey = process.env.AGENT_API_KEY;

  beforeEach(() => {
    sharedDb = createSharedWikiDb();
    vi.spyOn(pool, 'connect').mockResolvedValue(sharedDb.mockClient as any);
    process.env.AGENT_API_KEY = 'test-wiki-agent-key';
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
    (process.env as Record<string, string | undefined>).NODE_ENV = origNodeEnv;
    if (origAgentKey === undefined) {
      delete process.env.AGENT_API_KEY;
    } else {
      process.env.AGENT_API_KEY = origAgentKey;
    }
  });

  describe('POST /api/agent/wiki', () => {
    it('应导出 10mb bodyParser 限制配置', () => {
      expect(agentWikiConfig).toEqual({
        api: { bodyParser: { sizeLimit: '10mb' } },
      });
    });

    it('未授权或密钥错误应返回 401，生产环境缺失密钥应返回 500', async () => {
      const uploadSpy = vi.spyOn(storage, 'uploadWikiAsset');

      const { req: noAuthReq, res: noAuthRes, getStatus: noAuthStatus } = createMockReqRes({
        method: 'POST',
        url: '/api/agent/wiki',
        body: { title: 't', summary: 's', content_md: 'c', flow_data: buildSampleFlowData() },
      });
      await agentWikiHandler(noAuthReq, noAuthRes);
      expect(noAuthStatus()).toBe(401);

      const { req: badKeyReq, res: badKeyRes, getStatus: badKeyStatus } = createMockReqRes({
        method: 'POST',
        url: '/api/agent/wiki',
        headers: { authorization: 'Bearer wrong-key' },
        body: { title: 't', summary: 's', content_md: 'c', flow_data: buildSampleFlowData() },
      });
      await agentWikiHandler(badKeyReq, badKeyRes);
      expect(badKeyStatus()).toBe(401);

      vi.stubEnv('NODE_ENV', 'production');
      delete process.env.AGENT_API_KEY;
      const { req: prodReq, res: prodRes, getStatus: prodStatus } = createMockReqRes({
        method: 'POST',
        url: '/api/agent/wiki',
        headers: { authorization: 'Bearer anything' },
        body: { title: 't', summary: 's', content_md: 'c', flow_data: buildSampleFlowData() },
      });
      await agentWikiHandler(prodReq, prodRes);
      expect(prodStatus()).toBe(500);
      expect(uploadSpy).not.toHaveBeenCalled();
    });

    it('非法 slug 应返回 400 且不上传 logo，数据库异常应由 withDb 返回 500', async () => {
      const uploadSpy = vi.spyOn(storage, 'uploadWikiAsset').mockResolvedValue('https://cos.example.com/x.png');
      const { req: badSlugReq, res: badSlugRes, getStatus: badSlugStatus } = createMockReqRes({
        method: 'POST',
        url: '/api/agent/wiki',
        headers: { authorization: 'Bearer test-wiki-agent-key' },
        body: {
          slug: '!!!',
          title: '德国照明行业百科',
          summary: '摘要',
          content_md: '正文内容',
          flow_data: buildSampleFlowData(),
          logos: {
            'sonepar.de':
              'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
          },
        },
      });
      await agentWikiHandler(badSlugReq, badSlugRes);
      expect(badSlugStatus()).toBe(400);
      expect(uploadSpy).not.toHaveBeenCalled();

      sharedDb.mockClient.query.mockRejectedValueOnce(new Error('DB connection lost'));
      const { req: dbErrReq, res: dbErrRes, getStatus: dbErrStatus } = createMockReqRes({
        method: 'POST',
        url: '/api/agent/wiki',
        headers: { authorization: 'Bearer test-wiki-agent-key' },
        body: {
          slug: 'de-lighting-db-err',
          title: '德国照明行业百科',
          summary: '摘要',
          content_md: '正文内容',
          flow_data: buildSampleFlowData(),
        },
      });
      await agentWikiHandler(dbErrReq, dbErrRes);
      expect(dbErrStatus()).toBe(500);
    });

    it('非法 flow_data 或缺失必填字段应返回 400 且绝不调用 uploadWikiAsset', async () => {
      const uploadSpy = vi.spyOn(storage, 'uploadWikiAsset').mockResolvedValue('https://cos.example.com/x.png');
      const invalidFlow = buildSampleFlowData();
      invalidFlow.supply_origin.local_manufacturing_pct = 50;
      invalidFlow.supply_origin.import_pct = 10;

      const { req, res, getStatus } = createMockReqRes({
        method: 'POST',
        url: '/api/agent/wiki',
        headers: { authorization: 'Bearer test-wiki-agent-key' },
        body: {
          title: '德国照明行业百科',
          summary: '摘要',
          content_md: '正文内容',
          flow_data: invalidFlow,
          logos: {
            'sonepar.de': 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
          },
        },
      });

      await agentWikiHandler(req, res);
      expect(getStatus()).toBe(400);
      expect(uploadSpy).not.toHaveBeenCalled();

      // 缺失 title / summary / content_md 应返回 400
      for (const missingField of ['title', 'summary', 'content_md'] as const) {
        const basePayload: Record<string, unknown> = {
          title: '德国照明行业百科',
          summary: '摘要',
          content_md: '正文内容',
          flow_data: buildSampleFlowData(),
        };
        delete basePayload[missingField];
        const missingReqRes = createMockReqRes({
          method: 'POST',
          url: '/api/agent/wiki',
          headers: { authorization: 'Bearer test-wiki-agent-key' },
          body: basePayload,
        });
        await agentWikiHandler(missingReqRes.req, missingReqRes.res);
        expect(missingReqRes.getStatus()).toBe(400);
      }

      // 显式传入非数组 faq_items / sources 或非法 status 返回 400
      for (const badBody of [
        { faq_items: 'not-array' },
        { sources: { title: 'not-array' } },
        { status: 'archived' },
      ]) {
        const invalidEnumRes = createMockReqRes({
          method: 'POST',
          url: '/api/agent/wiki',
          headers: { authorization: 'Bearer test-wiki-agent-key' },
          body: {
            title: '德国照明行业百科',
            summary: '摘要',
            content_md: '正文内容',
            flow_data: buildSampleFlowData(),
            ...badBody,
          },
        });
        await agentWikiHandler(invalidEnumRes.req, invalidEnumRes.res);
        expect(invalidEnumRes.getStatus()).toBe(400);
      }

      // 拦截 javascript:、//evil.com、/\evil.com、控制字符及非法 sources[].url / player.logo_url
      const flowWithBadLogo = buildSampleFlowData();
      flowWithBadLogo.flow_nodes[0].players[0].logo_url = 'javascript:alert(1)';

      const dangerousCases = [
        { video_url: 'javascript:alert(1)' },
        { cover_image: '//evil.com/x.png' },
        { cover_image: '/\\evil.com/x.png' },
        { video_url: 'https://cdn.example.com/a\n.mp4' },
        { sources: [{ title: '恶意信源', url: 'javascript:alert(2)' }] },
        { sources: [{ title: '协议相对信源', url: '//evil.com/ref' }] },
        { flow_data: flowWithBadLogo },
      ];
      for (const dangerous of dangerousCases) {
        const dangerReqRes = createMockReqRes({
          method: 'POST',
          url: '/api/agent/wiki',
          headers: { authorization: 'Bearer test-wiki-agent-key' },
          body: {
            title: '德国照明行业百科',
            summary: '摘要',
            content_md: '正文内容',
            flow_data: buildSampleFlowData(),
            logos: {
              'sonepar.de':
                'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
            },
            ...dangerous,
          },
        });
        await agentWikiHandler(dangerReqRes.req, dangerReqRes.res);
        expect(dangerReqRes.getStatus()).toBe(400);
      }
      expect(uploadSpy).not.toHaveBeenCalled();
    });

    it('合法推送含 Base64 PNG logo 应上传 COS 并回写 logo_url，再次推送同 slug 应返回 updated，并跳过 SVG 与伪造魔数 PNG', async () => {
      const uploadSpy = vi
        .spyOn(storage, 'uploadWikiAsset')
        .mockResolvedValue('https://marketgraphic-image-1302276463.cos.ap-shanghai.myqcloud.com/wiki-assets/logos/sonepar.de.png');

      // 真实 1x1 透明 PNG 字节流（含 89 50 4E 47 0D 0A 1A 0A 标准文件头）
      const samplePngBase64 =
        'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
      const svgXssBase64 =
        'data:image/svg+xml;base64,' + Buffer.from('<svg><script>alert(1)</script></svg>').toString('base64');
      const forgedPngBase64 =
        'data:image/png;base64,' + Buffer.from('<svg><script>alert(1)</script></svg>').toString('base64');
      const oversizedPngBase64 =
        'data:image/png;base64,' + Buffer.alloc(2 * 1024 * 1024 + 10, 1).toString('base64');

      // 1. 首次创建
      const { req: req1, res: res1, getStatus: status1, getJson: json1 } = createMockReqRes({
        method: 'POST',
        url: '/api/agent/wiki',
        headers: { 'x-agent-key': 'test-wiki-agent-key' },
        body: {
          slug: 'de_lighting',
          title: '德国照明产品行业流通百科',
          summary: '德国照明进口与 DIY/Pro 双轨流通图谱',
          content_md: '## 德国照明渠道全景\n\n重点关注 EPREL 能效要求。',
          flow_data: buildSampleFlowData(),
          logos: {
            'sonepar.de': samplePngBase64,
            'obi.de': svgXssBase64,
            'hornbach.de': forgedPngBase64,
            'paulmann.com': oversizedPngBase64,
          },
        },
      });

      await agentWikiHandler(req1, res1);
      expect(status1()).toBe(200);
      expect(json1()).toEqual({
        success: true,
        id: expect.any(String),
        slug: 'de-lighting',
        url: '/wiki/de-lighting',
        action: 'created',
      });

      // 仅允许安全白名单 PNG 上传，拒绝 image/svg+xml 跳过上传
      expect(uploadSpy).toHaveBeenCalledTimes(1);
      expect(uploadSpy).toHaveBeenCalledWith(expect.any(Buffer), 'image/png', 'logos/sonepar.de.png');

      const stored = sharedDb.rowsById.get(json1().id)!;
      const proNode = stored.flow_data.flow_nodes.find((n: any) => n.id === 'tier2_pro');
      expect(proNode.players[0].logo_url).toBe(
        'https://marketgraphic-image-1302276463.cos.ap-shanghai.myqcloud.com/wiki-assets/logos/sonepar.de.png'
      );
      const diyNode = stored.flow_data.flow_nodes.find((n: any) => n.id === 'tier2_diy');
      expect(diyNode.players[0].logo_url).toBeUndefined();

      // 2. 同 slug 再次推送应返回 updated
      uploadSpy.mockClear();
      const { req: req2, res: res2, getStatus: status2, getJson: json2 } = createMockReqRes({
        method: 'POST',
        url: '/api/agent/wiki',
        headers: { authorization: 'Bearer test-wiki-agent-key' },
        body: {
          slug: 'de-lighting',
          title: '德国照明产品行业流通百科（修订版）',
          summary: '更新后的摘要',
          content_md: '## 修订正文',
          flow_data: buildSampleFlowData(),
        },
      });

      await agentWikiHandler(req2, res2);
      expect(status2()).toBe(200);
      expect(json2()).toEqual({
        success: true,
        id: json1().id,
        slug: 'de-lighting',
        url: '/wiki/de-lighting',
        action: 'updated',
      });
    });
  });

  describe('GEO 机器直读接口：GET /api/llms 与 GET /api/wiki/[slug]/markdown', () => {
    it('GET /api/llms 应返回 text/plain 并仅包含已发布词条链接（排除草稿）', async () => {
      // 写入 1 条已发布 + 1 条草稿
      const pubReqRes = createMockReqRes({
        method: 'POST',
        headers: { authorization: 'Bearer test-wiki-agent-key' },
        body: {
          slug: 'de-lighting',
          title: '德国照明流通百科',
          summary: '德国照明全链路解析',
          content_md: '正文',
          flow_data: buildSampleFlowData(),
          status: 'published',
        },
      });
      await agentWikiHandler(pubReqRes.req, pubReqRes.res);

      const draftReqRes = createMockReqRes({
        method: 'POST',
        headers: { authorization: 'Bearer test-wiki-agent-key' },
        body: {
          slug: 'fr-lighting-draft',
          title: '法国照明草稿词条',
          summary: '不应出现在公开 llms.txt',
          content_md: '草稿正文',
          flow_data: buildSampleFlowData(),
          status: 'draft',
        },
      });
      await agentWikiHandler(draftReqRes.req, draftReqRes.res);

      const { req, res, getStatus, getData, getHeader } = createMockReqRes({
        method: 'GET',
        url: '/api/llms',
      });
      await llmsHandler(req, res);

      expect(getStatus()).toBe(200);
      expect(getHeader('content-type')).toBe('text/plain; charset=utf-8');
      expect(getHeader('cache-control')).toBe('public, max-age=300, stale-while-revalidate=600');

      const text = String(getData());
      expect(text).toContain('# Market Graphic (外贸智友)');
      expect(text).toContain('https://marketgraphic.cn/wiki');
      expect(text).toContain('https://marketgraphic.cn/news');
      expect(text).toContain('https://marketgraphic.cn/reports');
      expect(text).toContain(
        '[德国照明流通百科](https://marketgraphic.cn/wiki/de-lighting) ([Markdown](https://marketgraphic.cn/wiki/de-lighting.md))'
      );
      expect(text).not.toContain('fr-lighting-draft');
      expect(text).not.toContain('法国照明草稿词条');
    });

    it('GET /api/wiki/[slug]/markdown 应支持带 .md 后缀的已发布词条，并对草稿或不存在词条返回 404', async () => {
      const pubReqRes = createMockReqRes({
        method: 'POST',
        headers: { authorization: 'Bearer test-wiki-agent-key' },
        body: {
          slug: 'de-lighting',
          title: '德国照明流通百科',
          summary: '德国照明全链路解析',
          content_md: '## 深度图文实战\n德国 DIY 与 Pro 渠道打法差异显著。',
          flow_data: buildSampleFlowData(),
          status: 'published',
        },
      });
      await agentWikiHandler(pubReqRes.req, pubReqRes.res);

      const draftReqRes = createMockReqRes({
        method: 'POST',
        headers: { authorization: 'Bearer test-wiki-agent-key' },
        body: {
          slug: 'secret-draft',
          title: '内部草稿',
          summary: '未发布',
          content_md: '内部信息',
          flow_data: buildSampleFlowData(),
          status: 'draft',
        },
      });
      await agentWikiHandler(draftReqRes.req, draftReqRes.res);

      // 带 .md 后缀与大写混写测试
      const mdRes = createMockReqRes({
        method: 'GET',
        url: '/api/wiki/de-lighting.md/markdown',
        query: { slug: 'DE-LIGHTING.md' },
      });
      await wikiMarkdownHandler(mdRes.req, mdRes.res);

      expect(mdRes.getStatus()).toBe(200);
      expect(mdRes.getHeader('content-type')).toBe('text/markdown; charset=utf-8');
      expect(mdRes.getHeader('cache-control')).toBe('public, max-age=300, stale-while-revalidate=600');
      const mdBody = String(mdRes.getData());
      expect(mdBody).toContain('# 德国照明流通百科');
      expect(mdBody).toContain('## 二、价格瀑布与加价阶梯');
      expect(mdBody).toContain('Sonepar Deutschland');

      // 草稿返回 404
      const draftRes = createMockReqRes({
        method: 'GET',
        query: { slug: 'secret-draft.md' },
      });
      await wikiMarkdownHandler(draftRes.req, draftRes.res);
      expect(draftRes.getStatus()).toBe(404);

      // 不存在返回 404
      const missingRes = createMockReqRes({
        method: 'GET',
        query: { slug: 'non-existent' },
      });
      await wikiMarkdownHandler(missingRes.req, missingRes.res);
      expect(missingRes.getStatus()).toBe(404);

      // 空 slug 返回 400
      const emptySlugRes = createMockReqRes({
        method: 'GET',
        query: { slug: '.md' },
      });
      await wikiMarkdownHandler(emptySlugRes.req, emptySlugRes.res);
      expect(emptySlugRes.getStatus()).toBe(400);
    });
  });

  describe('/api/admin/wiki 管理后台全流程', () => {
    it('普通用户与未登录用户应返回 403', async () => {
      const unauth = createMockReqRes({ method: 'GET', url: '/api/admin/wiki' });
      await adminWikiHandler(unauth.req, unauth.res);
      expect(unauth.getStatus()).toBe(403);

      const normalUser = createMockReqRes({
        method: 'GET',
        url: '/api/admin/wiki',
        session: { userId: 'u-1', role: 'user' },
      });
      await adminWikiHandler(normalUser.req, normalUser.res);
      expect(normalUser.getStatus()).toBe(403);
    });

    it('管理员应能分页搜索、查看详情、拦截非法 UUID/危险 URL、下架草稿并最终删除', async () => {
      // 准备 2 条测试词条
      const p1 = createMockReqRes({
        method: 'POST',
        headers: { authorization: 'Bearer test-wiki-agent-key' },
        body: {
          slug: 'de-lighting',
          title: '德国100%_照明百科',
          summary: '德国照明摘要',
          content_md: '正文1',
          flow_data: buildSampleFlowData(),
          status: 'published',
        },
      });
      await agentWikiHandler(p1.req, p1.res);
      const id1 = p1.getJson().id as string;

      const p2 = createMockReqRes({
        method: 'POST',
        headers: { authorization: 'Bearer test-wiki-agent-key' },
        body: {
          slug: 'us-tools',
          title: '美国手动工具百科',
          summary: '美国工具摘要',
          content_md: '正文2',
          flow_data: buildSampleFlowData(),
          status: 'draft',
        },
      });
      await agentWikiHandler(p2.req, p2.res);
      const id2 = p2.getJson().id as string;
      expect(sharedDb.rowsById.get(id2)?.published_at).toBeNull();

      const adminSession = { userId: 'admin-1', role: 'admin' };

      // 1. 分页查询 + 通配符转义搜索
      const listRes = createMockReqRes({
        method: 'GET',
        url: '/api/admin/wiki',
        session: adminSession,
        query: { page: '1', pageSize: '10', status: 'all', q: '100%_' },
      });
      await adminWikiHandler(listRes.req, listRes.res);
      expect(listRes.getStatus()).toBe(200);
      expect(listRes.getJson()).toMatchObject({
        total: 1,
        page: 1,
        pageSize: 10,
      });
      expect(listRes.getJson().data[0].id).toBe(id1);

      // 2. 详情查询与非法 UUID 拦截
      const badIdRes = createMockReqRes({
        method: 'GET',
        session: adminSession,
        query: { id: 'not-a-uuid' },
      });
      await adminWikiHandler(badIdRes.req, badIdRes.res);
      expect(badIdRes.getStatus()).toBe(400);

      const detailRes = createMockReqRes({
        method: 'GET',
        session: adminSession,
        query: { id: id1 },
      });
      await adminWikiHandler(detailRes.req, detailRes.res);
      expect(detailRes.getStatus()).toBe(200);
      expect(detailRes.getJson().data.slug).toBe('de-lighting');

      // 3. PUT 拦截非法请求体、非法 UUID 与危险协议 URL / sources[].url
      const arrayBodyPutRes = createMockReqRes({
        method: 'PUT',
        session: adminSession,
        body: ['not-an-object'],
      });
      await adminWikiHandler(arrayBodyPutRes.req, arrayBodyPutRes.res);
      expect(arrayBodyPutRes.getStatus()).toBe(400);

      for (const badPut of [
        { id: id1, video_url: 'javascript:alert(document.cookie)' },
        { id: id1, cover_image: '//evil.com/cover.png' },
        { id: id1, cover_image: '/\\evil.com/cover.png' },
        { id: id1, sources: [{ title: '恶意信源', url: 'javascript:alert(1)' }] },
      ]) {
        const xssPutRes = createMockReqRes({
          method: 'PUT',
          session: adminSession,
          body: badPut,
        });
        await adminWikiHandler(xssPutRes.req, xssPutRes.res);
        expect(xssPutRes.getStatus()).toBe(400);
      }

      // 3.1 草稿切 published 应自动回填 published_at
      const publishDraftRes = createMockReqRes({
        method: 'PUT',
        session: adminSession,
        body: {
          id: id2,
          cover_image: '/uploads/wiki-assets/covers/us-tools.png',
          sources: [{ title: 'USITC DataWeb', url: 'https://dataweb.usitc.gov' }],
          status: 'published',
        },
      });
      await adminWikiHandler(publishDraftRes.req, publishDraftRes.res);
      expect(publishDraftRes.getStatus()).toBe(200);
      expect(publishDraftRes.getJson().data.status).toBe('published');
      expect(publishDraftRes.getJson().data.published_at).toBeTruthy();

      // 3.2 page 上限钳位校验
      const clampedPageRes = createMockReqRes({
        method: 'GET',
        session: adminSession,
        query: { page: '9999999', pageSize: '500' },
      });
      await adminWikiHandler(clampedPageRes.req, clampedPageRes.res);
      expect(clampedPageRes.getStatus()).toBe(200);
      expect(clampedPageRes.getJson().page).toBe(100000);
      expect(clampedPageRes.getJson().pageSize).toBe(100);

      const badPutUuidRes = createMockReqRes({
        method: 'PUT',
        session: adminSession,
        body: {
          id: '12345',
          title: '更新标题',
        },
      });
      await adminWikiHandler(badPutUuidRes.req, badPutUuidRes.res);
      expect(badPutUuidRes.getStatus()).toBe(400);

      // 4. PUT 合法更新为 draft 后，公开 .md 端点立即返回 404
      const unpublishRes = createMockReqRes({
        method: 'PUT',
        session: adminSession,
        body: {
          id: id1,
          title: '德国照明百科（已下架修订）',
          video_url: 'https://cdn.marketgraphic.cn/video/de-lighting.mp4',
          status: 'draft',
        },
      });
      await adminWikiHandler(unpublishRes.req, unpublishRes.res);
      expect(unpublishRes.getStatus()).toBe(200);
      expect(unpublishRes.getJson().success).toBe(true);
      expect(unpublishRes.getJson().data.status).toBe('draft');

      const publicMdAfterUnpublish = createMockReqRes({
        method: 'GET',
        query: { slug: 'de-lighting.md' },
      });
      await wikiMarkdownHandler(publicMdAfterUnpublish.req, publicMdAfterUnpublish.res);
      expect(publicMdAfterUnpublish.getStatus()).toBe(404);

      // 5. DELETE 删除词条
      const deleteRes = createMockReqRes({
        method: 'DELETE',
        session: adminSession,
        query: { id: id1 },
      });
      await adminWikiHandler(deleteRes.req, deleteRes.res);
      expect(deleteRes.getStatus()).toBe(200);
      expect(deleteRes.getJson()).toEqual({ success: true });
      expect(sharedDb.rowsById.has(id1)).toBe(false);

      // 再次删除应返回 404
      const deleteAgainRes = createMockReqRes({
        method: 'DELETE',
        session: adminSession,
        body: { id: id1 },
      });
      await adminWikiHandler(deleteAgainRes.req, deleteAgainRes.res);
      expect(deleteAgainRes.getStatus()).toBe(404);
    });
  });
});
