import fs from 'fs';
import path from 'path';
import { describe, it, expect, afterEach } from 'vitest';
import {
  matchPlayersWithPlatformAssets,
  getRelatedReportsForWiki,
  upsertWikiEntry,
  DbQueryable,
  UpsertWikiPayload,
} from '../lib/wiki-service';
import { sanitizeWikiAssetKey, uploadWikiAsset } from '../lib/storage';
import { buildSampleFlowData } from './wiki-schema.test';

interface RecordedQuery {
  sql: string;
  params: unknown[];
}

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
  flow_data: unknown;
  content_md: string;
  faq_items: unknown[];
  sources: unknown[];
  video_url: string | null;
  cover_image: string | null;
  status: string;
  published_at: string | null;
  updated_at: string;
}

/**
 * 构建内存 mock DbQueryable，模拟 PostgreSQL cardinality / UNION ALL / xmax=0 行为
 */
function createMockDb(options?: {
  reportRows?: Array<{ id: string; title: string; website_domain: string | null; clean_company: string | null }>;
  crmContacts?: Array<{ email: string; website_domain: string | null; clean_company_name: string | null }>;
  relatedReportRows?: Array<{
    id: string;
    title: string;
    category: string;
    market_region: string;
    summary: string;
    created_at: string;
  }>;
  throwOnReports?: boolean;
  throwOnCrm?: boolean;
  throwOnRelatedReports?: boolean;
}) {
  const queries: RecordedQuery[] = [];
  const wikiStore = new Map<string, StoredWikiRow>();
  let idCounter = 1;

  const dbClient: DbQueryable = {
    query: (async (sqlText: unknown, values?: unknown[]) => {
      const sql = typeof sqlText === 'string' ? sqlText : String((sqlText as { text?: string })?.text || '');
      const params = Array.isArray(values) ? values : [];
      queries.push({ sql, params });

      // 1. matchPlayersWithPlatformAssets -> 查 reports
      if (sql.includes('FROM reports') && sql.includes('website_domain')) {
        if (options?.throwOnReports) {
          throw new Error('simulated reports table error');
        }
        const domains = (params[0] as string[]) || [];
        const cleanNames = (params[1] as string[]) || [];
        const rows = (options?.reportRows || []).filter(
          (r) =>
            (domains.length > 0 && r.website_domain && domains.includes(r.website_domain)) ||
            (cleanNames.length > 0 && r.clean_company && cleanNames.includes(r.clean_company))
        );
        return { rows, rowCount: rows.length } as never;
      }

      // 2. matchPlayersWithPlatformAssets -> UNION ALL 独立按 domain 与 clean_company_name 聚合统计
      if (sql.includes('FROM crm_contacts') && sql.includes('UNION ALL')) {
        if (options?.throwOnCrm) {
          throw new Error('simulated crm_contacts relation does not exist');
        }
        const domains = (params[0] as string[]) || [];
        const cleanNames = (params[1] as string[]) || [];
        const contacts = options?.crmContacts || [];

        const domainGroups = new Map<string, Set<string>>();
        const nameGroups = new Map<string, Set<string>>();
        for (const c of contacts) {
          if (domains.length > 0 && c.website_domain && domains.includes(c.website_domain)) {
            if (!domainGroups.has(c.website_domain)) domainGroups.set(c.website_domain, new Set());
            domainGroups.get(c.website_domain)!.add(c.email);
          }
          if (cleanNames.length > 0 && c.clean_company_name && cleanNames.includes(c.clean_company_name)) {
            if (!nameGroups.has(c.clean_company_name)) nameGroups.set(c.clean_company_name, new Set());
            nameGroups.get(c.clean_company_name)!.add(c.email);
          }
        }

        const rows: Array<{ match_type: string; match_key: string; cnt: number }> = [];
        for (const [k, emails] of domainGroups.entries()) {
          rows.push({ match_type: 'domain', match_key: k, cnt: emails.size });
        }
        for (const [k, emails] of nameGroups.entries()) {
          rows.push({ match_type: 'name', match_key: k, cnt: emails.size });
        }
        return { rows, rowCount: rows.length } as never;
      }

      // 3. getRelatedReportsForWiki -> 查关联研报
      if (sql.includes('FROM reports') && sql.includes('report_industries')) {
        if (options?.throwOnRelatedReports) {
          throw new Error('simulated related reports query error');
        }
        const rows = options?.relatedReportRows || [];
        return { rows, rowCount: rows.length } as never;
      }

      // 4. upsertWikiEntry -> 原子 INSERT ... ON CONFLICT (slug) DO UPDATE ... RETURNING id, slug, (xmax = 0) AS inserted
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
        ] = params as [
          string,
          string,
          string,
          string,
          string,
          string,
          number | null,
          string,
          string | null,
          string,
          string,
          string,
          string,
          string,
          string | null,
          string | null,
          string,
        ];

        const existing = wikiStore.get(slug);
        const now = new Date().toISOString();
        const record: StoredWikiRow = {
          id: existing ? existing.id : `00000000-0000-0000-0000-${String(idCounter++).padStart(12, '0')}`,
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
          published_at: existing?.published_at ?? (status === 'published' ? now : null),
          updated_at: now,
        };
        wikiStore.set(slug, record);
        return {
          rows: [{ id: record.id, slug: record.slug, inserted: !existing }],
          rowCount: 1,
        } as never;
      }

      throw new Error(`Unexpected SQL in mock DB: ${sql}`);
    }) as DbQueryable['query'],
  };

  return { dbClient, queries, wikiStore };
}

describe('lib/wiki-service 玩家资产联动、研报检索与幂等入库', () => {
  const createdLocalFiles: string[] = [];

  afterEach(() => {
    for (const filePath of createdLocalFiles.splice(0)) {
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
      const parentDir = path.dirname(filePath);
      if (fs.existsSync(parentDir) && fs.readdirSync(parentDir).length === 0) {
        fs.rmdirSync(parentDir);
      }
    }
  });

  it('matchPlayersWithPlatformAssets 应仅发 2 条 cardinality+UNION ALL SQL、按域名优先且绝不重复计数或泄露敏感字段', async () => {
    const flow = buildSampleFlowData();
    flow.flow_nodes[0].players.push(
      { name: 'Brennenstuhl GmbH', website: '', business_model: '德国电气品牌' },
      { name: 'AB', website: '', business_model: '超短名称玩家' },
      { name: 'constructor', website: '', business_model: '原型链键名防御测试' }
    );

    const { dbClient, queries } = createMockDb({
      reportRows: [
        {
          id: 'rep-obi-domain',
          title: 'OBI 德国 DIY 零售巨头 360° 洞察（域名匹配）',
          website_domain: 'obi.de',
          clean_company: 'obi germany',
        },
        {
          id: 'rep-obi-name-fallback',
          title: 'OBI 同名低优先级报告',
          website_domain: 'other-obi.com',
          clean_company: 'obi',
        },
        {
          id: 'rep-brennenstuhl',
          title: 'Brennenstuhl 德国电气深度洞察',
          website_domain: null,
          clean_company: 'brennenstuhl',
        },
        {
          id: 'rep-short-ab',
          title: 'AB 不应被短词误匹配',
          website_domain: null,
          clean_company: 'ab',
        },
      ],
      crmContacts: [
        { email: 'a@obi.de', website_domain: 'obi.de', clean_company_name: 'obi' },
        { email: 'b@obi.de', website_domain: 'obi.de', clean_company_name: 'obi' },
        { email: 'c@obi-holding.de', website_domain: 'obi-holding.de', clean_company_name: 'obi' },
        { email: 'buyer1@paulmann.com', website_domain: 'paulmann.com', clean_company_name: 'paulmann licht' },
        { email: 'buyer2@paulmann.com', website_domain: 'paulmann.com', clean_company_name: 'paulmann' },
        { email: 'info@brennenstuhl.de', website_domain: 'brennenstuhl.de', clean_company_name: 'brennenstuhl' },
        { email: 'ab@ab.de', website_domain: null, clean_company_name: 'ab' },
      ],
    });

    const matches = await matchPlayersWithPlatformAssets(flow, dbClient);

    // 严格校验仅发出 2 条批量 SQL（无 N+1），且使用 cardinality 与 UNION ALL
    expect(queries).toHaveLength(2);
    expect(queries[0].sql).toContain('FROM reports');
    expect(queries[0].sql).toContain('cardinality(');
    expect(queries[0].sql).not.toContain('array_length(');

    expect(queries[1].sql).toContain('FROM crm_contacts');
    expect(queries[1].sql).toContain('UNION ALL');
    expect(queries[1].sql).toContain('cardinality(');
    expect(queries[1].sql).not.toContain('array_length(');

    // SQL 绝不允许查询 source_session、phone 或明文 email 列表
    expect(queries[1].sql.toLowerCase()).not.toContain('source_session');
    expect(queries[1].sql.toLowerCase()).not.toContain('phone');
    expect(queries[1].sql).toMatch(/COUNT\s*\(\s*DISTINCT\s+email\s*\)/i);

    // 根域名优先：obi.de 下仅 2 个 obi.de 联系人（不叠加同名 obi-holding.de）
    expect(matches['obi.de']).toEqual({
      reportId: 'rep-obi-domain',
      reportTitle: 'OBI 德国 DIY 零售巨头 360° 洞察（域名匹配）',
      contactCount: 2,
    });
    expect(matches['paulmann.com']).toEqual({
      reportId: null,
      reportTitle: null,
      contactCount: 2,
    });

    // 无官网时按清洗公司名 (>=3 字符) 命中
    expect(matches['brennenstuhl']).toEqual({
      reportId: 'rep-brennenstuhl',
      reportTitle: 'Brennenstuhl 德国电气深度洞察',
      contactCount: 1,
    });

    // 短词 (<3 字符) 绝不纳入 cleanNames 碰撞参数与结果命中
    expect((queries[0].params[1] as string[])).not.toContain('ab');
    expect(matches['ab']).toEqual({
      reportId: null,
      reportTitle: null,
      contactCount: 0,
    });

    // 原型链键名不污染且可安全返回自有属性
    expect(Object.hasOwn(matches, 'constructor')).toBe(true);
    expect(matches['constructor']).toEqual({
      reportId: null,
      reportTitle: null,
      contactCount: 0,
    });

    // 严格脱敏检查：返回对象不得包含 email、phone 或 source_session
    for (const item of Object.values(matches)) {
      const keys = Object.keys(item);
      expect(keys).not.toContain('email');
      expect(keys).not.toContain('phone');
      expect(keys).not.toContain('source_session');
    }
  });

  it('matchPlayersWithPlatformAssets 应支持 reports 异常降级、crm_contacts 异常降级及无有效玩家 0 SQL 返回', async () => {
    const flow = buildSampleFlowData();

    // 1. crm_contacts 异常降级
    const crmErrMock = createMockDb({
      reportRows: [
        {
          id: 'rep-obi-1',
          title: 'OBI 德国 DIY 零售巨头 360° 洞察',
          website_domain: 'obi.de',
          clean_company: 'obi',
        },
      ],
      throwOnCrm: true,
    });
    const crmFallback = await matchPlayersWithPlatformAssets(flow, crmErrMock.dbClient);
    expect(crmErrMock.queries).toHaveLength(2);
    expect(crmFallback['obi.de']).toEqual({
      reportId: 'rep-obi-1',
      reportTitle: 'OBI 德国 DIY 零售巨头 360° 洞察',
      contactCount: 0,
    });

    // 2. reports 异常降级仍保留 crm_contacts 聚合结果
    const repErrMock = createMockDb({
      crmContacts: [{ email: 'buyer@obi.de', website_domain: 'obi.de', clean_company_name: 'obi' }],
      throwOnReports: true,
    });
    const repFallback = await matchPlayersWithPlatformAssets(flow, repErrMock.dbClient);
    expect(repErrMock.queries).toHaveLength(2);
    expect(repFallback['obi.de']).toEqual({
      reportId: null,
      reportTitle: null,
      contactCount: 1,
    });

    // 3. 无有效碰撞域名与公司名（如空玩家或仅 <3 字符名）应 0 条 SQL 直接返回
    const emptyFlow = buildSampleFlowData();
    emptyFlow.flow_nodes.forEach((node) => {
      node.players = [{ name: 'XY', website: '', business_model: '短名测试' }];
    });
    const zeroQueryMock = createMockDb();
    const zeroRes = await matchPlayersWithPlatformAssets(emptyFlow, zeroQueryMock.dbClient);
    expect(zeroQueryMock.queries).toHaveLength(0);
    expect(zeroRes).toEqual({
      xy: { reportId: null, reportTitle: null, contactCount: 0 },
    });
  });

  it('upsertWikiEntry 应原子判定 created/updated、支持纯空格 slug 回退 meta.id 及拦截非法入参', async () => {
    const flow = buildSampleFlowData();
    const { dbClient, queries, wikiStore } = createMockDb();

    const first = await upsertWikiEntry(dbClient, {
      slug: 'SVC_Test_DE_Lighting',
      title: '首版德国照明流通百科',
      summary: '首版摘要说明',
      flow_data: flow,
      content_md: '## 首版正文',
      video_url: 'https://cdn.example.com/hook.mp4',
      cover_image: 'https://cdn.example.com/cover.png',
    });

    expect(first.action).toBe('created');
    expect(first.slug).toBe('svc-test-de-lighting');
    // 原子 upsert 无需前置 SELECT，仅发出 1 条 SQL
    expect(queries).toHaveLength(1);

    const createdRow = wikiStore.get(first.slug)!;
    expect(createdRow.market_region).toBe('欧洲');
    expect(createdRow.faq_items.length).toBeGreaterThanOrEqual(4);

    // 同 slug 再次写入，不传 video_url / cover_image 时应保留原有媒体资源
    const second = await upsertWikiEntry(dbClient, {
      slug: 'svc-test-de-lighting',
      title: '修订版德国照明流通百科',
      summary: '修订摘要说明',
      flow_data: flow,
      content_md: '## 修订正文',
    });

    expect(second.action).toBe('updated');
    expect(second.id).toBe(first.id);
    expect(queries).toHaveLength(2);
    const updatedRow = wikiStore.get(second.slug)!;
    expect(updatedRow.title).toBe('修订版德国照明流通百科');
    expect(updatedRow.video_url).toBe('https://cdn.example.com/hook.mp4');
    expect(updatedRow.cover_image).toBe('https://cdn.example.com/cover.png');

    // 纯空格 slug 应自动回退至 flow_data.meta.id（'de_lighting' -> 'de-lighting'）
    const fallbackSlugRes = await upsertWikiEntry(dbClient, {
      slug: '   ',
      title: '纯空格 slug 回退测试',
      summary: '摘要',
      flow_data: flow,
      content_md: '正文',
    });
    expect(fallbackSlugRes.slug).toBe('de-lighting');
    expect(fallbackSlugRes.action).toBe('created');

    // 非对象 payload 与空标题应抛错拒绝写入
    await expect(upsertWikiEntry(dbClient, null as unknown as UpsertWikiPayload)).rejects.toThrow();
    await expect(
      upsertWikiEntry(dbClient, {
        slug: 'bad-empty-title',
        title: '   ',
        summary: '摘要',
        flow_data: flow,
        content_md: '正文',
      })
    ).rejects.toThrow();

    // 脏 flow_data 应抛错拒绝写入
    const dirtyFlow = buildSampleFlowData();
    dirtyFlow.supply_origin.local_manufacturing_pct = 90;
    dirtyFlow.supply_origin.import_pct = 90;
    await expect(
      upsertWikiEntry(dbClient, {
        slug: 'bad-flow-data',
        title: '合法标题',
        summary: '合法摘要',
        flow_data: dirtyFlow,
        content_md: '合法正文',
      })
    ).rejects.toThrow(/flow_data/);
  });

  it('getRelatedReportsForWiki 应转义 ILIKE 通配符、截断超 120 字摘要并在异常时降级返回空数组', async () => {
    const longSummary = '德'.repeat(135);
    const shortSummary = '简短摘要不超过限制。';
    const { dbClient, queries } = createMockDb({
      relatedReportRows: [
        {
          id: 'r-1',
          title: '德国照明渠道深度报告',
          category: 'product',
          market_region: '欧洲',
          summary: longSummary,
          created_at: '2026-11-24T00:00:00Z',
        },
        {
          id: 'r-2',
          title: 'Paulmann 买家洞察',
          category: 'customer',
          market_region: '德国',
          summary: shortSummary,
          created_at: '2026-11-23T00:00:00Z',
        },
      ],
    });

    const related = await getRelatedReportsForWiki('100%_照明\\灯', '德国', dbClient, 4);
    expect(related).toHaveLength(2);
    expect(related[0].summary).toBe(`${'德'.repeat(120)}...`);
    expect(related[1].summary).toBe(shortSummary);
    expect(queries[0].params[1]).toBe('%100\\%\\_照明\\\\灯%');

    const errDb = createMockDb({ throwOnRelatedReports: true });
    const fallback = await getRelatedReportsForWiki('照明产品', '德国', errDb.dbClient, 4);
    expect(fallback).toEqual([]);
  });

  it('sanitizeWikiAssetKey 应先白名单清洗再彻底剔除 .. 防止组合绕过，并拒绝空结果', async () => {
    expect(sanitizeWikiAssetKey('../../etc/passwd')).toBe('etc/passwd');
    expect(sanitizeWikiAssetKey('. ./etc/passwd')).toBe('etc/passwd');
    expect(sanitizeWikiAssetKey('.@./secret.png')).toBe('secret.png');
    expect(sanitizeWikiAssetKey('..\\..\\windows\\system32\\hosts')).toBe('windows/system32/hosts');
    expect(sanitizeWikiAssetKey('....//logos//de-lighting/obi (1).png')).toBe('logos/de-lighting/obi1.png');
    expect(sanitizeWikiAssetKey('/logos/paulmann.svg')).toBe('logos/paulmann.svg');

    for (const malicious of ['. ./etc/passwd', '.@./secret.png', '../../etc/passwd', '....//a..b/c']) {
      const cleaned = sanitizeWikiAssetKey(malicious);
      expect(cleaned).not.toContain('..');
      expect(cleaned.startsWith('/')).toBe(false);
    }

    expect(() => sanitizeWikiAssetKey('../../..')).toThrow();
    expect(() => sanitizeWikiAssetKey('. @ . / . .')).toThrow();
    expect(() => sanitizeWikiAssetKey('')).toThrow();

    const origBucket = process.env.COS_BUCKET;
    const origRegion = process.env.COS_REGION;
    delete process.env.COS_BUCKET;
    delete process.env.COS_REGION;

    try {
      const testKey = 'unit-test/test-logo.png';
      const url = await uploadWikiAsset(Buffer.from('fake-png-bytes'), 'image/png', `../../${testKey}`);
      expect(url).toBe(`/uploads/wiki-assets/${testKey}`);

      const writtenPath = path.join(process.cwd(), 'public', 'uploads', 'wiki-assets', 'unit-test', 'test-logo.png');
      createdLocalFiles.push(writtenPath);
      expect(fs.existsSync(writtenPath)).toBe(true);

      await expect(uploadWikiAsset(Buffer.from('x'), 'image/png', '../../..')).rejects.toThrow();
    } finally {
      if (origBucket !== undefined) process.env.COS_BUCKET = origBucket;
      if (origRegion !== undefined) process.env.COS_REGION = origRegion;
    }
  });
});
