import fs from 'fs';
import path from 'path';
import { describe, it, expect, afterEach } from 'vitest';
import {
  matchPlayersWithPlatformAssets,
  getRelatedReportsForWiki,
  upsertWikiEntry,
  DbQueryable,
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
 * 构建内存 mock DbQueryable，记录全部 SQL 与参数并模拟 PostgreSQL 核心行为
 */
function createMockDb(options?: {
  reportRows?: Array<{ id: string; title: string; website_domain: string | null; clean_company: string | null }>;
  crmRows?: Array<{ website_domain: string | null; clean_company_name: string | null; cnt: number }>;
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
            (r.website_domain && domains.includes(r.website_domain)) ||
            (r.clean_company && cleanNames.includes(r.clean_company))
        );
        return { rows, rowCount: rows.length } as never;
      }

      // 2. matchPlayersWithPlatformAssets -> 查 crm_contacts
      if (sql.includes('FROM crm_contacts')) {
        if (options?.throwOnCrm) {
          throw new Error('simulated crm_contacts relation does not exist');
        }
        const domains = (params[0] as string[]) || [];
        const cleanNames = (params[1] as string[]) || [];
        const rows = (options?.crmRows || []).filter(
          (r) =>
            (r.website_domain && domains.includes(r.website_domain)) ||
            (r.clean_company_name && cleanNames.includes(r.clean_company_name))
        );
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

      // 4. upsertWikiEntry -> 先检查是否存在 slug
      if (sql.includes('SELECT id FROM wiki_entries WHERE slug = $1')) {
        const slug = String(params[0] || '');
        const found = wikiStore.get(slug);
        return { rows: found ? [{ id: found.id }] : [], rowCount: found ? 1 : 0 } as never;
      }

      // 5. upsertWikiEntry -> INSERT ... ON CONFLICT (slug) DO UPDATE
      if (sql.includes('INSERT INTO wiki_entries')) {
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
        return { rows: [{ id: record.id, slug: record.slug }], rowCount: 1 } as never;
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

  it('matchPlayersWithPlatformAssets 应仅发 2 条批量 SQL、根域名优先命中且绝不泄露敏感字段', async () => {
    const flow = buildSampleFlowData();
    // 增加一个仅公司名命中、以及一个短名 (<3 字符) 应被忽略公司名碰撞的玩家
    flow.flow_nodes[0].players.push(
      { name: 'Brennenstuhl GmbH', website: '', business_model: '德国电气品牌' },
      { name: 'AB', website: '', business_model: '超短名称玩家' }
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
      crmRows: [
        { website_domain: 'obi.de', clean_company_name: 'obi', cnt: 7 },
        { website_domain: 'paulmann.com', clean_company_name: 'paulmann licht', cnt: 4 },
        { website_domain: null, clean_company_name: 'ab', cnt: 99 },
      ],
    });

    const matches = await matchPlayersWithPlatformAssets(flow, dbClient);

    // 严格校验仅发出 2 条批量 SQL（无 N+1）
    expect(queries).toHaveLength(2);
    expect(queries[0].sql).toContain('FROM reports');
    expect(queries[1].sql).toContain('FROM crm_contacts');

    // SQL 绝不允许查询 source_session、phone 或明文 email 列表
    expect(queries[1].sql.toLowerCase()).not.toContain('source_session');
    expect(queries[1].sql.toLowerCase()).not.toContain('phone');
    expect(queries[1].sql).toMatch(/COUNT\s*\(\s*DISTINCT\s+email\s*\)/i);

    // 验证根域名优先命中 reports 与 crm_contacts
    expect(matches['obi.de']).toEqual({
      reportId: 'rep-obi-domain',
      reportTitle: 'OBI 德国 DIY 零售巨头 360° 洞察（域名匹配）',
      contactCount: 7,
    });
    expect(matches['paulmann.com']).toEqual({
      reportId: null,
      reportTitle: null,
      contactCount: 4,
    });

    // 无官网时按清洗公司名 (>=3 字符) 命中
    expect(matches['brennenstuhl']).toEqual({
      reportId: 'rep-brennenstuhl',
      reportTitle: 'Brennenstuhl 德国电气深度洞察',
      contactCount: 0,
    });

    // 短词 (<3 字符) 绝不纳入 cleanNames 碰撞参数与结果命中
    expect((queries[0].params[1] as string[])).not.toContain('ab');
    expect(matches['ab']).toEqual({
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

  it('matchPlayersWithPlatformAssets 在 crm_contacts 查询异常时应安全降级为 0 且保留已命中 reports', async () => {
    const flow = buildSampleFlowData();
    const { dbClient, queries } = createMockDb({
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

    const matches = await matchPlayersWithPlatformAssets(flow, dbClient);
    expect(queries).toHaveLength(2);
    expect(matches['obi.de']).toEqual({
      reportId: 'rep-obi-1',
      reportTitle: 'OBI 德国 DIY 零售巨头 360° 洞察',
      contactCount: 0,
    });
    expect(matches['paulmann.com']).toEqual({
      reportId: null,
      reportTitle: null,
      contactCount: 0,
    });
  });

  it('upsertWikiEntry 应支持首次创建、自动大区与FAQ补全、同 slug 幂等更新及脏数据拦截', async () => {
    const flow = buildSampleFlowData();
    const { dbClient, wikiStore } = createMockDb();

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
    const updatedRow = wikiStore.get(second.slug)!;
    expect(updatedRow.title).toBe('修订版德国照明流通百科');
    expect(updatedRow.video_url).toBe('https://cdn.example.com/hook.mp4');
    expect(updatedRow.cover_image).toBe('https://cdn.example.com/cover.png');

    // 空标题应抛错拒绝写入
    await expect(
      upsertWikiEntry(dbClient, {
        slug: 'bad-empty-title',
        title: '   ',
        summary: '摘要',
        flow_data: flow,
        content_md: '正文',
      })
    ).rejects.toThrow();

    // 脏 flow_data（本土 + 进口 != 100%）应抛错拒绝写入
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

  it('getRelatedReportsForWiki 应截断超 120 字摘要并在异常时降级返回空数组', async () => {
    const longSummary = '德'.repeat(135);
    const shortSummary = '简短摘要不超过限制。';
    const { dbClient } = createMockDb({
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

    const related = await getRelatedReportsForWiki('照明产品', '德国', dbClient, 4);
    expect(related).toHaveLength(2);
    expect(related[0].summary).toBe(`${'德'.repeat(120)}...`);
    expect(related[1].summary).toBe(shortSummary);

    const errDb = createMockDb({ throwOnRelatedReports: true });
    const fallback = await getRelatedReportsForWiki('照明产品', '德国', errDb.dbClient, 4);
    expect(fallback).toEqual([]);
  });

  it('sanitizeWikiAssetKey 应拦截路径穿越并规范相对路径，uploadWikiAsset 支持本地降级写入', async () => {
    expect(sanitizeWikiAssetKey('../../etc/passwd')).toBe('etc/passwd');
    expect(sanitizeWikiAssetKey('..\\..\\windows\\system32\\hosts')).toBe('windows/system32/hosts');
    expect(sanitizeWikiAssetKey('....//logos//de-lighting/obi (1).png')).toBe('logos/de-lighting/obi1.png');
    expect(sanitizeWikiAssetKey('/logos/paulmann.svg')).toBe('logos/paulmann.svg');
    expect(sanitizeWikiAssetKey('../../..')).toBe('');

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
