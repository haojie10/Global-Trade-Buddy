import fs from 'node:fs';
import path from 'node:path';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, it, expect, vi, afterEach } from 'vitest';
import pool from '../lib/db';
import type { WikiEntryRecord, WikiFaqItem } from '../lib/wiki-schema';
import { buildSampleFlowData } from './wiki-schema.test';
import WikiIndexPage, { getServerSideProps as getWikiIndexSsrProps } from '../pages/wiki/index';
import WikiDetailPage, {
  getServerSideProps as getWikiDetailSsrProps,
  buildWikiDetailJsonLd,
} from '../pages/wiki/[slug]';

function createMockSsrContext(slug?: string) {
  const headers = new Map<string, string>();
  return {
    params: slug !== undefined ? { slug } : {},
    req: {
      headers: {
        host: 'marketgraphic.cn',
        'x-forwarded-proto': 'https',
      },
      cookies: {},
    } as any,
    res: {
      setHeader: vi.fn((k: string, v: string) => {
        headers.set(k.toLowerCase(), String(v));
      }),
      getHeader: (k: string) => headers.get(k.toLowerCase()),
    } as any,
    query: {},
    resolvedUrl: slug ? `/wiki/${slug}` : '/wiki',
  } as any;
}

function createSamplePublishedRow(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: '11111111-1111-4111-8111-111111111111',
    slug: 'geo-test-de-lighting',
    title: '德国住宅照明市场流通全图谱（GEO SSR 测试）',
    summary: '深度拆解中国 LED 灯具进入德国 DIY 建材与专业电工渠道的全链路加价与合规门槛。',
    country_code: 'DE',
    country_name: '德国',
    market_region: '欧洲',
    category_id: 4,
    industry_name: '照明产品',
    hs_code_6: '940542',
    archetype_id: 'diy_pro_dual',
    flow_data: buildSampleFlowData(),
    content_md: [
      '## 一、准入合规核心壁垒',
      '',
      '中国工厂进入德国主流照明渠道前，**必须完成 EPREL 能效注册**与 WEEE 回收登记。',
      '',
      '### 1.1 包装与测试要求',
      '',
      '须随货提供德语说明书与完整 ERP 测试报告。',
    ].join('\n'),
    faq_items: [
      {
        q: '进入德国照明市场需要哪些强制认证？',
        a: '必须具备 CE、RoHS、WEEE 回收号并完成欧盟 EPREL 能效数据库注册。',
      },
    ] as WikiFaqItem[],
    sources: [
      {
        title: 'EU EPREL Lighting Database',
        url: 'https://eprel.ec.europa.eu',
        publisher: 'European Commission',
      },
      {
        title: '恶意信源测试',
        url: 'javascript:alert(1)',
        publisher: 'Evil',
      },
    ],
    video_url: null,
    cover_image: null,
    status: 'published',
    view_count: 128,
    published_at: new Date('2026-11-24T08:00:00.000Z'),
    created_at: new Date('2026-11-23T08:00:00.000Z'),
    updated_at: new Date('2026-11-24T09:30:00.000Z'),
    ...overrides,
  };
}

describe('行业百科前台 SSR 与 GEO 集成测试', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('详情页 getServerSideProps 对草稿或不存在的词条返回 { notFound: true }', async () => {
    const release = vi.fn();
    const query = vi.fn(async (sql: string) => {
      // 仅匹配 status = 'published'，草稿或不存在的词条均返回空行
      if (sql.includes('FROM wiki_entries')) {
        return { rows: [], rowCount: 0 };
      }
      return { rows: [], rowCount: 0 };
    });
    vi.spyOn(pool, 'connect').mockResolvedValue({ query, release } as any);

    const draftResult = await getWikiDetailSsrProps(createMockSsrContext('draft-de-lighting'));
    expect(draftResult).toEqual({ notFound: true });

    const missingResult = await getWikiDetailSsrProps(createMockSsrContext('non-existent-slug'));
    expect(missingResult).toEqual({ notFound: true });

    const emptyResult = await getWikiDetailSsrProps(createMockSsrContext('   '));
    expect(emptyResult).toEqual({ notFound: true });

    expect(release).toHaveBeenCalledTimes(2);
  });

  it('详情页 getServerSideProps 与 renderToStaticMarkup 完整渲染 GEO 事实、价格瀑布、玩家联动、安全视频与正文', async () => {
    const sampleRow = createSamplePublishedRow();
    const release = vi.fn();
    const query = vi.fn(async (sql: string, params?: unknown[]) => {
      if (sql.includes('FROM wiki_entries') && sql.includes("status = 'published'")) {
        if (params?.[0] === 'geo-test-de-lighting') {
          return { rows: [sampleRow], rowCount: 1 };
        }
        return { rows: [], rowCount: 0 };
      }

      if (sql.includes('FROM reports') && sql.includes('website_domain')) {
        return {
          rows: [
            {
              id: 'rep-sonepar-001',
              title: 'Sonepar Deutschland 360° 采购决策链报告',
              website_domain: 'sonepar.de',
              clean_company: 'sonepar deutschland',
            },
          ],
          rowCount: 1,
        };
      }

      if (sql.includes('FROM crm_contacts') && sql.includes('UNION ALL')) {
        return {
          rows: [{ match_type: 'domain', match_key: 'sonepar.de', cnt: 5 }],
          rowCount: 1,
        };
      }

      if (sql.includes('FROM reports') && sql.includes('report_industries')) {
        return {
          rows: [
            {
              id: 'rep-de-lighting-002',
              title: '德国照明渠道横向对比研报',
              category: 'category',
              market_region: '欧洲, 德国',
              summary: '深度对比 OBI、Hornbach 与专业电工渠道选品与利润结构。',
              created_at: new Date('2026-11-20T00:00:00Z'),
            },
          ],
          rowCount: 1,
        };
      }

      return { rows: [], rowCount: 0 };
    });
    vi.spyOn(pool, 'connect').mockResolvedValue({ query, release } as any);

    const ssrResult = (await getWikiDetailSsrProps(createMockSsrContext('geo-test-de-lighting'))) as {
      props: any;
    };

    expect(ssrResult.props).toBeTruthy();
    expect(ssrResult.props.entry.slug).toBe('geo-test-de-lighting');
    expect(typeof ssrResult.props.entry.published_at).toBe('string');
    expect(typeof ssrResult.props.entry.updated_at).toBe('string');

    // 1. video_url 为空时不输出 <video
    const htmlNoVideo = renderToStaticMarkup(React.createElement(WikiDetailPage, ssrResult.props));
    expect(htmlNoVideo).toContain('德国住宅照明市场流通全图谱（GEO SSR 测试）');
    expect(htmlNoVideo).toContain('中国 FOB 出厂价');
    expect(htmlNoVideo).toContain('$42.9');
    expect(htmlNoVideo).toContain('Sonepar Deutschland');
    expect(htmlNoVideo).toContain('href="/reports/rep-sonepar-001"');
    expect(htmlNoVideo).toContain('href="/reports/rep-de-lighting-002"');
    expect(htmlNoVideo).toContain('已收录 5 位采购联系人');
    expect(htmlNoVideo).toContain('必须完成 EPREL 能效注册');
    expect(htmlNoVideo).toContain('常见问题');
    expect(htmlNoVideo).toContain('href="/wiki/geo-test-de-lighting.md"');
    expect(htmlNoVideo).toContain('href="https://eprel.ec.europa.eu"');
    expect(htmlNoVideo).not.toContain('javascript:alert');
    expect(htmlNoVideo).not.toContain('<video');

    // 2. video_url 为合法 HTTPS 时输出 <video
    const htmlWithSafeVideo = renderToStaticMarkup(
      React.createElement(WikiDetailPage, {
        ...ssrResult.props,
        entry: {
          ...ssrResult.props.entry,
          video_url: 'https://cdn.marketgraphic.cn/video/de-lighting-35s.mp4',
        },
      })
    );
    expect(htmlWithSafeVideo).toContain('<video');
    expect(htmlWithSafeVideo).toContain('https://cdn.marketgraphic.cn/video/de-lighting-35s.mp4');

    // 3. video_url 为危险协议时被严格过滤，不输出 <video
    const htmlWithUnsafeVideo = renderToStaticMarkup(
      React.createElement(WikiDetailPage, {
        ...ssrResult.props,
        entry: {
          ...ssrResult.props.entry,
          video_url: 'javascript:alert(document.cookie)',
        },
      })
    );
    expect(htmlWithUnsafeVideo).not.toContain('<video');
    expect(htmlWithUnsafeVideo).not.toContain('javascript:');
  });

  it('buildWikiDetailJsonLd 正确产出 Article、BreadcrumbList、FAQPage 与 Dataset（含 .md distribution）', () => {
    const entry: WikiEntryRecord = {
      id: '11111111-1111-4111-8111-111111111111',
      slug: 'geo-test-de-lighting',
      title: '德国住宅照明市场流通全图谱',
      summary: '拆解中国 LED 灯具进入德国渠道的加价路径与玩家图谱。',
      country_code: 'DE',
      country_name: '德国',
      market_region: '欧洲',
      category_id: 4,
      industry_name: '照明产品',
      hs_code_6: '940542',
      archetype_id: 'diy_pro_dual',
      flow_data: buildSampleFlowData(),
      content_md: '## 正文\n\n测试正文',
      faq_items: [
        { q: '加价多少倍？', a: '约 9.5x。' },
        { q: '需要哪些认证？', a: 'CE 与 EPREL。' },
      ],
      sources: [],
      video_url: null,
      cover_image: null,
      status: 'published',
      view_count: 10,
      published_at: '2026-11-24T08:00:00.000Z',
      created_at: '2026-11-23T08:00:00.000Z',
      updated_at: '2026-11-24T09:30:00.000Z',
    };

    const jsonLd = buildWikiDetailJsonLd(entry, entry.faq_items);

    expect(jsonLd.article['@type']).toBe('Article');
    expect(jsonLd.article.headline).toBe(entry.title);
    expect(jsonLd.article.url).toBe('https://marketgraphic.cn/wiki/geo-test-de-lighting');

    expect(jsonLd.breadcrumb['@type']).toBe('BreadcrumbList');
    expect(jsonLd.breadcrumb.itemListElement).toHaveLength(3);
    expect(jsonLd.breadcrumb.itemListElement[1].item).toBe('https://marketgraphic.cn/wiki');
    expect(jsonLd.breadcrumb.itemListElement[2].item).toBe('https://marketgraphic.cn/wiki/geo-test-de-lighting');

    expect(jsonLd.faqPage['@type']).toBe('FAQPage');
    expect(jsonLd.faqPage.mainEntity).toHaveLength(2);
    expect(jsonLd.faqPage.mainEntity[0]).toEqual({
      '@type': 'Question',
      name: '加价多少倍？',
      acceptedAnswer: { '@type': 'Answer', text: '约 9.5x。' },
    });

    expect(jsonLd.dataset['@type']).toBe('Dataset');
    expect(jsonLd.dataset.distribution).toEqual([
      {
        '@type': 'DataDownload',
        encodingFormat: 'text/markdown',
        contentUrl: 'https://marketgraphic.cn/wiki/geo-test-de-lighting.md',
      },
    ]);
  });

  it('大厅页 getServerSideProps 与 renderToStaticMarkup 正确输出已发布词条卡片', async () => {
    const sampleRow = createSamplePublishedRow();
    const release = vi.fn();
    const query = vi.fn(async (sql: string) => {
      if (sql.includes('FROM wiki_entries') && sql.includes("status = 'published'")) {
        return { rows: [sampleRow], rowCount: 1 };
      }
      return { rows: [], rowCount: 0 };
    });
    vi.spyOn(pool, 'connect').mockResolvedValue({ query, release } as any);

    const ssrResult = (await getWikiIndexSsrProps(createMockSsrContext())) as { props: any };
    expect(ssrResult.props.items).toHaveLength(1);
    expect(ssrResult.props.items[0].slug).toBe('geo-test-de-lighting');
    expect(ssrResult.props.items[0].price_multiplier).toBe('9.5x');
    expect(ssrResult.props.items[0].player_count).toBe(3);

    const html = renderToStaticMarkup(React.createElement(WikiIndexPage, ssrResult.props));
    expect(html).toContain('href="/wiki/geo-test-de-lighting"');
    expect(html).toContain('德国住宅照明市场流通全图谱（GEO SSR 测试）');
    expect(html).toContain('9.5x');
    expect(html).toContain('照明产品');
  });

  it('安全红线：页面源码严禁使用 dangerouslySetInnerHTML 且不嵌套 JsonLdScript 于 Head 内', () => {
    const indexSrc = fs.readFileSync(path.resolve(process.cwd(), 'pages/wiki/index.tsx'), 'utf-8');
    const detailSrc = fs.readFileSync(path.resolve(process.cwd(), 'pages/wiki/[slug].tsx'), 'utf-8');

    expect(indexSrc).not.toContain('dangerouslySetInnerHTML');
    expect(detailSrc).not.toContain('dangerouslySetInnerHTML');
    expect(indexSrc).not.toMatch(/<Head>[\s\S]*?<JsonLdScript[\s\S]*?<\/Head>/);
    expect(detailSrc).not.toMatch(/<Head>[\s\S]*?<JsonLdScript[\s\S]*?<\/Head>/);
  });
});
