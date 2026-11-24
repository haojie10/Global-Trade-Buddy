# 行业百科（Industry Wiki）实现计划

> **面向 AI 代理的工作者：** 必需子技能：使用 superpowers:subagent-driven-development（推荐）或 superpowers:executing-plans 逐任务实现此计划。步骤使用复选框（`- [ ]`）语法来跟踪进度。

**目标：** 在 `marketgraphic.cn`（GlobalTradeBuddy）平台上构建完全公开免登录、面向传统 SEO 与 AI 生成式搜索引擎（GEO）深度优化的「行业百科（`/wiki`）」模块，承接 `MG推广` 产出的结构化流通图谱 JSON + 深度图文 Markdown + 35 秒竖屏短视频，并与平台现有的深度研报及采购联系人库打通变现闭环。

**架构：** PostgreSQL 新增 `wiki_entries` 表（`flow_data JSONB` + `content_md TEXT` + `faq_items JSONB` + `sources JSONB` + `video_url`），以语义化 `slug` 作为幂等 Upsert 键。推送接口（`POST /api/agent/wiki`）负责硬校验与腾讯云 COS 托管 Logo；前台详情页（`pages/wiki/[slug].tsx`）使用 Next.js SSR 原生渲染 Recharts 价格瀑布 + 同步语义化 HTML 表格 + 分层渠道图谱（批量匹配 `reports` / `crm_contacts` 计数并严格脱敏）+ 纯 React 安全 Markdown 长文；同时通过 `/llms.txt`、`/wiki/[slug].md`、`robots.txt`、`sitemap.xml` 与百度推送构建完整 GEO/SEO 发现链路。

**技术栈：** Next.js 14 (Pages Router)、React 18、TypeScript、PostgreSQL (`pg`)、Recharts、腾讯云 COS (`cos-nodejs-sdk-v5`)、Vitest。

---

## 文件结构与职责清单

### 新增文件
- `supabase/migrations/20261124000000_wiki_entries_schema.sql`：创建 `wiki_entries` 表与索引，扩展 `page_views.content_type` 约束支持 `'wiki'`。
- `lib/wiki-schema.ts`：`MarketFlowData` / `WikiEntry` 类型定义、5 大原型元数据、`normalizeWikiSlug`、`validateMarketFlowData`、`generateDefaultFaqs`、`buildWikiMarkdownExport`。
- `lib/wiki-service.ts`：`matchPlayersWithPlatformAssets`（批量匹配 `reports` 与脱敏 `crm_contacts` 计数）、`getRelatedReportsForWiki`、`upsertWikiEntry`。
- `pages/api/agent/wiki.ts`：`AGENT_API_KEY` 鉴权的幂等推送 API，支持 Base64 Logo 自动上传 COS。
- `pages/api/admin/wiki.ts`：`requireAdmin` 鉴权的后台分页查询、详情、编辑、上下架、删除 API。
- `pages/api/llms.ts`：动态生成 `llmstxt.org` 标准的 `/llms.txt`。
- `pages/api/wiki/[slug]/markdown.ts`：输出单个已发布词条的纯净 `text/markdown`（重写暴露为 `/wiki/[slug].md`）。
- `components/wiki/SafeMarkdown.tsx`：零 `dangerouslySetInnerHTML` 的纯 React GFM Markdown 渲染器与 `extractTocHeadings` 目录提取器。
- `components/wiki/JsonLdScript.tsx`：专用于 `<Head>` 注入 Schema.org `application/ld+json` 的受控转义封装。
- `components/wiki/WikiPriceWaterfall.tsx`：Recharts 价格瀑布柱状图 + 同步语义化 HTML `<table>` 明细表。
- `components/wiki/WikiFlowMap.tsx`：Tier 1–4 渠道流通可视化、白底圆角 Logo 墙（带 Monogram 降级）、痛点与话术切换面板、玩家站内研报/买手计数联动徽章。
- `components/wiki/WikiEntryCard.tsx`：行业百科大厅词条卡片。
- `pages/wiki/index.tsx`：公开 SSR 行业百科大厅（大区/54品类/5原型/关键词筛选 + 无限滚动）。
- `pages/wiki/[slug].tsx`：公开 SSR 行业百科详情页（GEO 速览 + 可选短视频位 + 供给格局 + 价格瀑布 + 流通图谱 + 安全 Markdown 长文 + FAQ + 延伸研报 + JSON-LD）。
- `pages/admin/wiki.tsx`：管理后台「行业百科」轻量列表与编辑器。
- `tests/wiki-db-schema.test.ts`：数据库表结构与 `page_views` 约束测试。
- `tests/wiki-schema.test.ts`：Schema 校验、Slug 归一化、默认 FAQ 与 Markdown 导出单测。
- `tests/wiki-service.test.ts`：玩家域名匹配与买手隐私脱敏集成测试。
- `tests/wiki-api.test.ts`：Agent 推送、Admin CRUD、`/api/llms` 与 `/api/wiki/[slug]/markdown` 接口测试。
- `tests/wiki-markdown.test.ts`：纯 React Markdown 渲染、XSS 协议拦截与 TOC 提取单测。
- `tests/wiki-geo-ssr.test.ts`：详情页 GEO 数据与 `getServerSideProps` 行为验证测试。

### 修改文件
- `tests/helpers/db-test-helper.ts`：清理 `wiki_entries` 测试数据，并在已有测试库缺表时自动补跑新增迁移。
- `pages/api/track/pageview.ts`：当 `content_type === 'wiki'` 时累加 `wiki_entries.view_count`。
- `lib/storage.ts`：新增 `uploadWikiAsset(buffer, mime, subPath)` 函数上传至 COS `wiki-assets/`。
- `components/Navbar.tsx`：PC 导航与移动端抽屉菜单插入 `行业百科` (`/wiki`)。
- `components/Footer.tsx`：页脚导航补充 `行业百科` (`/wiki`)。
- `components/admin/AdminLayout.tsx`：后台侧边栏补充 `📚 行业百科` (`/admin/wiki`)。
- `next.config.js`：`rewrites()` 升级为 `{ beforeFiles, afterFiles }` 以优先命中 `/llms.txt` 与 `/wiki/:slug.md`；CSP 增加 `media-src 'self' blob: https:`。
- `public/robots.txt`：显式允许主流 AI 爬虫访问 `/wiki` 与 `/llms.txt`。
- `pages/sitemap.xml.tsx`：将 `/wiki` 与全部已发布 `/wiki/[slug]` 纳入 Sitemap。
- `bin/push-to-baidu.js`：将未推送的 `wiki_entries` 纳入每日百度主动推送队列。

---

### 任务 1：数据库迁移脚本与浏览计数适配

**文件：**
- 创建：`supabase/migrations/20261124000000_wiki_entries_schema.sql`
- 修改：`tests/helpers/db-test-helper.ts:32-77`
- 修改：`pages/api/track/pageview.ts:32-43`
- 测试：`tests/wiki-db-schema.test.ts`

- [ ] **步骤 1：编写失败的数据库 Schema 与约束测试**

创建 `tests/wiki-db-schema.test.ts`：

```ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { Client } from 'pg';
import { createTestClient, cleanDatabase } from './helpers/db-test-helper';

describe('wiki_entries 数据库结构与 page_views 约束测试', () => {
  let client: Client;

  beforeAll(async () => {
    client = createTestClient();
    await client.connect();
    await cleanDatabase(client);
  });

  afterAll(async () => {
    await client.query(`DELETE FROM wiki_entries WHERE slug LIKE 'test-schema-%'`).catch(() => {});
    await client.end();
  });

  it('wiki_entries 表应存在且强制 slug 唯一', async () => {
    const sampleFlow = { meta: { id: 'test_schema_1' } };
    const insertSql = `
      INSERT INTO wiki_entries (slug, title, summary, country_code, country_name, industry_name, archetype_id, flow_data, content_md)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb, $9)
      RETURNING id, slug, status, view_count
    `;
    const res = await client.query(insertSql, [
      'test-schema-de-lighting',
      '德国照明流通测试',
      '测试摘要',
      'DE',
      '德国',
      '照明产品',
      'diy_pro_dual',
      JSON.stringify(sampleFlow),
      '# 测试正文',
    ]);

    expect(res.rows[0].slug).toBe('test-schema-de-lighting');
    expect(res.rows[0].status).toBe('published');
    expect(res.rows[0].view_count).toBe(0);

    await expect(
      client.query(insertSql, [
        'test-schema-de-lighting',
        '重复 slug',
        '测试摘要',
        'DE',
        '德国',
        '照明产品',
        'diy_pro_dual',
        JSON.stringify(sampleFlow),
        '# 重复',
      ])
    ).rejects.toThrow();
  });

  it('page_views 表应允许 content_type 为 wiki', async () => {
    const wikiRes = await client.query(
      `SELECT id FROM wiki_entries WHERE slug = 'test-schema-de-lighting' LIMIT 1`
    );
    const wikiId = wikiRes.rows[0].id;

    const pvRes = await client.query(
      `INSERT INTO page_views (user_id, content_type, content_id) VALUES (NULL, 'wiki', $1) RETURNING id, content_type`,
      [wikiId]
    );
    expect(pvRes.rows[0].content_type).toBe('wiki');
  });
});
```

- [ ] **步骤 2：运行测试验证失败**

运行：`npx vitest run tests/wiki-db-schema.test.ts`
预期：FAIL，报错 `relation "wiki_entries" does not exist`

- [ ] **步骤 3：创建数据库迁移脚本 `supabase/migrations/20261124000000_wiki_entries_schema.sql`**

```sql
-- 行业百科（Industry Wiki）主表与 GEO/SEO 追踪字段
CREATE TABLE IF NOT EXISTS wiki_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug VARCHAR(120) UNIQUE NOT NULL,
  title VARCHAR(255) NOT NULL,
  summary TEXT NOT NULL,
  country_code VARCHAR(10) NOT NULL,
  country_name VARCHAR(100) NOT NULL,
  market_region VARCHAR(50) NOT NULL DEFAULT '全球',
  category_id INT,
  industry_name VARCHAR(100) NOT NULL,
  hs_code_6 VARCHAR(12),
  archetype_id VARCHAR(40) NOT NULL,
  flow_data JSONB NOT NULL,
  content_md TEXT NOT NULL,
  faq_items JSONB NOT NULL DEFAULT '[]'::jsonb,
  sources JSONB NOT NULL DEFAULT '[]'::jsonb,
  video_url TEXT,
  cover_image TEXT,
  status VARCHAR(20) NOT NULL DEFAULT 'published' CHECK (status IN ('draft', 'published')),
  view_count INT NOT NULL DEFAULT 0,
  baidu_pushed_at TIMESTAMP WITH TIME ZONE,
  published_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_wiki_entries_status_pub ON wiki_entries (status, published_at DESC);
CREATE INDEX IF NOT EXISTS idx_wiki_entries_industry ON wiki_entries (industry_name);
CREATE INDEX IF NOT EXISTS idx_wiki_entries_country ON wiki_entries (country_code);
CREATE INDEX IF NOT EXISTS idx_wiki_entries_archetype ON wiki_entries (archetype_id);
CREATE INDEX IF NOT EXISTS idx_wiki_entries_baidu_pushed_at ON wiki_entries (baidu_pushed_at);

-- 扩展 page_views.content_type 约束，支持行业百科浏览追踪
ALTER TABLE page_views DROP CONSTRAINT IF EXISTS page_views_content_type_check;
ALTER TABLE page_views ADD CONSTRAINT page_views_content_type_check CHECK (content_type IN ('report', 'news', 'wiki'));
```

- [ ] **步骤 4：更新 `tests/helpers/db-test-helper.ts` 与 `pages/api/track/pageview.ts`**

在 `tests/helpers/db-test-helper.ts` 中：
1. 当 `wiki_entries` 表尚不存在于现有测试库时，自动执行 `supabase/migrations/20261124000000_wiki_entries_schema.sql`。
2. 在清空测试数据时增加 `await client.query('DELETE FROM wiki_entries');`。

```ts
// 在 tableExists 判断之后补充：
const wikiCheck = await client.query(
  `SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_schema = $1 AND table_name = 'wiki_entries')`,
  [targetSchema && targetSchema !== '"$user"' ? targetSchema : 'public']
);
if (!wikiCheck.rows[0].exists) {
  const wikiMigrationPath = path.join(process.cwd(), 'supabase', 'migrations', '20261124000000_wiki_entries_schema.sql');
  if (fs.existsSync(wikiMigrationPath)) {
    await client.query(fs.readFileSync(wikiMigrationPath, 'utf8'));
  }
}
```

在 `pages/api/track/pageview.ts` 新建 `page_views` 记录后增加 `wiki_entries.view_count` 累加：

```ts
const insertRes = await dbClient.query(
  'INSERT INTO page_views (user_id, content_type, content_id) VALUES ($1, $2, $3) RETURNING id',
  [userId, content_type, content_id]
);
const newViewId = insertRes.rows[0].id;

// 行业百科被打开时同步累加聚合阅读量，便于列表与后台展示热度
if (content_type === 'wiki') {
  await dbClient.query(
    'UPDATE wiki_entries SET view_count = view_count + 1 WHERE id = $1::uuid',
    [content_id]
  );
}

return res.status(200).json({ view_id: newViewId });
```

- [ ] **步骤 5：运行测试验证通过并提交**

运行：`npx vitest run tests/wiki-db-schema.test.ts`
预期：PASS（2/2 通过）

```bash
git add supabase/migrations/20261124000000_wiki_entries_schema.sql tests/helpers/db-test-helper.ts pages/api/track/pageview.ts tests/wiki-db-schema.test.ts
git commit -m "feat(wiki): 新增 wiki_entries 数据库迁移并扩展 page_views 支持百科统计"
```

---

### 任务 2：核心数据契约、硬校验与 GEO Markdown/FAQ 生成器

**文件：**
- 创建：`lib/wiki-schema.ts`
- 测试：`tests/wiki-schema.test.ts`

- [ ] **步骤 1：编写失败的 Schema 与 GEO 工具单测**

创建 `tests/wiki-schema.test.ts`：

```ts
import { describe, it, expect } from 'vitest';
import {
  normalizeWikiSlug,
  validateMarketFlowData,
  generateDefaultFaqs,
  buildWikiMarkdownExport,
  MarketFlowData,
} from '../lib/wiki-schema';

export function buildSampleFlowData(): MarketFlowData {
  return {
    meta: {
      id: 'de_lighting',
      country_code: 'DE',
      country_name_cn: '德国',
      category_id: 4,
      category_name_cn: '照明产品',
      hs_code_6: '940542',
      archetype_id: 'diy_pro_dual',
      currency: 'EUR',
      updated_at: '2026-11-24',
    },
    video_hook: {
      headline_opening: '中国出厂$4.5，德国卖€39.9！',
      headline_insight: '专业电工批发与DIY双轨差价惊人',
      cta_text: '上 marketgraphic.cn 查完整图谱',
    },
    supply_origin: {
      local_manufacturing_pct: 22,
      import_pct: 78,
      top_import_sources: [
        { country_name_cn: '中国', share_pct: 61, positioning: '高性价比主力供给', verified_by_comtrade: true },
        { country_name_cn: '波兰', share_pct: 12, positioning: '近岸快反组装', verified_by_comtrade: false },
      ],
    },
    flow_nodes: [
      {
        id: 'tier1_importers',
        tier: 1,
        label_cn: '德国品牌商 / 进口商',
        share_pct: 100,
        typical_margin_range: '25% - 35%',
        buyer_pain_points: ['怕EPREL能效抽检不合格', '怕WEEE合规停售'],
        sales_pitch_angle: '强调全套CE/ERP测试报告与EPREL预注册支持',
        players: [
          { name: 'Paulmann Licht', website: 'paulmann.com', business_model: '德国家用照明品牌与进口分销商' },
        ],
      },
      {
        id: 'tier2_diy',
        tier: 2,
        label_cn: 'DIY 家装零售连锁',
        share_pct: 48,
        typical_margin_range: '35% - 45%',
        buyer_pain_points: ['看重货架陈列与退货率', '要求德语彩盒包装'],
        sales_pitch_angle: '提供德语合规彩盒与低于1.5%不良率承诺',
        players: [
          { name: 'OBI', website: 'obi.de', business_model: '德国头部DIY建材零售连锁' },
        ],
      },
      {
        id: 'tier2_pro',
        tier: 2,
        label_cn: '专业电工批发商 (Pro)',
        share_pct: 52,
        typical_margin_range: '28% - 38%',
        buyer_pain_points: ['现货率与5年质保', '安装工时效率'],
        sales_pitch_angle: '主打免工具快接端子与5年商用质保方案',
        players: [
          { name: 'Sonepar Deutschland', website: 'sonepar.de', business_model: '全球领先电气B2B批发商' },
        ],
      },
    ],
    flow_edges: [
      { source: 'tier1_importers', target: 'tier2_diy', weight_pct: 48 },
      { source: 'tier1_importers', target: 'tier2_pro', weight_pct: 52 },
    ],
    price_waterfall: [
      { stage_name: '中国 FOB 出厂价', price_usd_equiv: 4.5, markup_desc: '含基础包装与国内港杂' },
      { stage_name: '德国到岸清关价', price_usd_equiv: 5.8, markup_desc: '海运+关税+清关' },
      { stage_name: '进口商/品牌加价', price_usd_equiv: 11.2, markup_desc: '合规认证+仓储+品牌毛利' },
      { stage_name: '终端零售含税价', price_usd_equiv: 42.9, markup_desc: '零售加价+19%德国VAT' },
    ],
  };
}

describe('lib/wiki-schema 校验与 GEO 工具', () => {
  it('normalizeWikiSlug 应将下划线与大写规范为语义化连字符 slug', () => {
    expect(normalizeWikiSlug('DE_Lighting_2026')).toBe('de-lighting-2026');
    expect(normalizeWikiSlug('  us  power_tools!! ')).toBe('us-power-tools');
    expect(() => normalizeWikiSlug('___')).toThrow();
  });

  it('validateMarketFlowData 应校验合法数据并拦截算术违规数据', () => {
    const valid = buildSampleFlowData();
    const okResult = validateMarketFlowData(valid);
    expect(okResult.valid).toBe(true);

    // 制造本土+进口不等于 100%
    const badSupply = buildSampleFlowData();
    badSupply.supply_origin.local_manufacturing_pct = 50;
    badSupply.supply_origin.import_pct = 70;
    const supplyRes = validateMarketFlowData(badSupply);
    expect(supplyRes.valid).toBe(false);
    expect(supplyRes.errors.join(' ')).toContain('100%');

    // 制造价格瀑布非严格递增
    const badPrice = buildSampleFlowData();
    badPrice.price_waterfall[2].price_usd_equiv = 5.0;
    const priceRes = validateMarketFlowData(badPrice);
    expect(priceRes.valid).toBe(false);
    expect(priceRes.errors.join(' ')).toContain('严格递增');
  });

  it('generateDefaultFaqs 应根据真实数据派生至少 4 条问答', () => {
    const faqs = generateDefaultFaqs(buildSampleFlowData(), '德国照明产品流通全景');
    expect(faqs.length).toBeGreaterThanOrEqual(4);
    expect(faqs[0].a).toContain('9.5');
    expect(faqs[1].a).toContain('78%');
  });

  it('buildWikiMarkdownExport 应生成含价格表、玩家表与来源链接的纯净 Markdown', () => {
    const flow = buildSampleFlowData();
    const md = buildWikiMarkdownExport({
      slug: 'de-lighting',
      title: '德国照明产品海外流通全景',
      summary: '拆解德国LED照明的DIY与专业电工双轨加价逻辑。',
      country_code: 'DE',
      country_name: '德国',
      market_region: '欧洲',
      industry_name: '照明产品',
      hs_code_6: '940542',
      archetype_id: 'diy_pro_dual',
      flow_data: flow,
      content_md: '## 合规红线\n必须完成 EPREL 注册。',
      faq_items: generateDefaultFaqs(flow, '德国照明产品海外流通全景'),
      sources: [{ title: 'UN Comtrade', url: 'https://comtradeplus.un.org', publisher: 'UN' }],
      updated_at: '2026-11-24T00:00:00.000Z',
    });

    expect(md).toContain('# 德国照明产品海外流通全景');
    expect(md).toContain('| 流通阶段 | 美元等值参考价 (USD) | 加价与成本构成 |');
    expect(md).toContain('Sonepar Deutschland');
    expect(md).toContain('https://marketgraphic.cn/wiki/de-lighting');
  });
});
```

- [ ] **步骤 2：运行测试验证失败**

运行：`npx vitest run tests/wiki-schema.test.ts`
预期：FAIL，报错找不到 `../lib/wiki-schema`

- [ ] **步骤 3：实现 `lib/wiki-schema.ts`**

创建 `lib/wiki-schema.ts`，定义完整类型、5 大流通原型元数据、校验器、默认 FAQ 派生函数及纯净 Markdown 导出函数：

```ts
export type ArchetypeId =
  | 'mass_retail'
  | 'diy_pro_dual'
  | 'heavy_b2b'
  | 'regulated_service'
  | 'seasonal_custom';

export interface WikiPlayer {
  name: string;
  website: string;
  logo_local_path?: string;
  logo_url?: string;
  url_verified?: boolean;
  business_model: string;
}

export interface WikiFlowNode {
  id: string;
  tier: 1 | 2 | 3 | 4;
  label_cn: string;
  share_pct: number;
  typical_margin_range: string;
  buyer_pain_points: string[];
  sales_pitch_angle: string;
  players: WikiPlayer[];
}

export interface WikiFlowEdge {
  source: string;
  target: string;
  weight_pct: number;
}

export interface WikiPriceStage {
  stage_name: string;
  price_usd_equiv: number;
  markup_desc: string;
}

export interface MarketFlowData {
  meta: {
    id: string;
    country_code: string;
    country_name_cn: string;
    category_id?: number;
    category_name_cn: string;
    hs_code_6?: string;
    archetype_id: ArchetypeId;
    currency: string;
    updated_at: string;
  };
  video_hook?: {
    headline_opening: string;
    headline_insight: string;
    cta_text: string;
  };
  supply_origin: {
    local_manufacturing_pct: number;
    import_pct: number;
    top_import_sources: Array<{
      country_name_cn: string;
      share_pct: number;
      positioning: string;
      verified_by_comtrade?: boolean;
    }>;
  };
  flow_nodes: WikiFlowNode[];
  flow_edges: WikiFlowEdge[];
  price_waterfall: WikiPriceStage[];
}

export interface WikiFaqItem {
  q: string;
  a: string;
}

export interface WikiSourceItem {
  title: string;
  url?: string;
  publisher?: string;
}

export interface WikiEntryRecord {
  id: string;
  slug: string;
  title: string;
  summary: string;
  country_code: string;
  country_name: string;
  market_region: string;
  category_id?: number | null;
  industry_name: string;
  hs_code_6?: string | null;
  archetype_id: ArchetypeId;
  flow_data: MarketFlowData;
  content_md: string;
  faq_items: WikiFaqItem[];
  sources: WikiSourceItem[];
  video_url?: string | null;
  cover_image?: string | null;
  status: 'draft' | 'published';
  view_count: number;
  published_at: string;
  created_at: string;
  updated_at: string;
}

export const ARCHETYPE_META: Record<ArchetypeId, { nameCn: string; shortTag: string; accent: string }> = {
  mass_retail: { nameCn: '大众消费品 / 零售驱动型', shortTag: '零售驱动', accent: '#0284c7' },
  diy_pro_dual: { nameCn: 'DIY + 专业技工双轨型', shortTag: 'DIY+专业双轨', accent: '#ea580c' },
  heavy_b2b: { nameCn: '重工业 / B2B 供应链型', shortTag: '重工B2B', accent: '#2563eb' },
  regulated_service: { nameCn: '强监管 / 牌照与服务型', shortTag: '强监管服务', accent: '#7c3aed' },
  seasonal_custom: { nameCn: '定制 / 强季节与礼赠型', shortTag: '定制礼赠', accent: '#db2777' },
};

const VALID_ARCHETYPES = new Set<string>(Object.keys(ARCHETYPE_META));

/**
 * 将原始标识归一化为 SEO/GEO 友好的语义化连字符 slug
 */
export function normalizeWikiSlug(raw: string): string {
  const cleaned = String(raw || '')
    .trim()
    .toLowerCase()
    .replace(/[_\s]+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');

  if (!cleaned || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(cleaned)) {
    throw new Error('无效的 slug：仅允许英文字母、数字与连字符');
  }
  return cleaned.slice(0, 120);
}

/**
 * 校验 MarketFlowData 业务契约与算术自洽性
 */
export function validateMarketFlowData(input: unknown): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  if (!input || typeof input !== 'object') {
    return { valid: false, errors: ['flow_data 必须为非空 JSON 对象'] };
  }

  const data = input as Partial<MarketFlowData>;
  if (!data.meta || typeof data.meta !== 'object') {
    errors.push('缺少 meta 元数据对象');
  } else {
    if (!data.meta.id?.trim()) errors.push('meta.id 不能为空');
    if (!data.meta.country_code || !/^[A-Za-z]{2}$/.test(data.meta.country_code)) {
      errors.push('meta.country_code 必须为 2 位国家代码');
    }
    if (!data.meta.country_name_cn?.trim()) errors.push('meta.country_name_cn 不能为空');
    if (!data.meta.category_name_cn?.trim()) errors.push('meta.category_name_cn 不能为空');
    if (!data.meta.archetype_id || !VALID_ARCHETYPES.has(data.meta.archetype_id)) {
      errors.push('meta.archetype_id 必须为 5 大标准流通原型之一');
    }
    if (data.meta.hs_code_6 && !/^\d{6}$/.test(data.meta.hs_code_6)) {
      errors.push('meta.hs_code_6 必须为 6 位数字');
    }
  }

  if (!data.supply_origin || typeof data.supply_origin !== 'object') {
    errors.push('缺少 supply_origin 供给格局数据');
  } else {
    const localPct = Number(data.supply_origin.local_manufacturing_pct);
    const importPct = Number(data.supply_origin.import_pct);
    if (Number.isNaN(localPct) || Number.isNaN(importPct) || Math.abs(localPct + importPct - 100) > 0.5) {
      errors.push('supply_origin 本土制造占比与进口占比之和必须等于 100%');
    }
  }

  if (!Array.isArray(data.flow_nodes) || data.flow_nodes.length < 3) {
    errors.push('flow_nodes 至少包含 3 个流通节点');
  } else {
    data.flow_nodes.forEach((node, idx) => {
      if (!node.id || !node.label_cn) errors.push(`flow_nodes[${idx}] 缺少 id 或 label_cn`);
      if (![1, 2, 3, 4].includes(node.tier)) errors.push(`flow_nodes[${idx}].tier 必须为 1-4`);
      if (!Array.isArray(node.buyer_pain_points) || node.buyer_pain_points.length === 0) {
        errors.push(`flow_nodes[${idx}] 至少需要 1 条买家痛点`);
      }
      if (!Array.isArray(node.players)) errors.push(`flow_nodes[${idx}].players 必须为数组`);
    });
  }

  if (!Array.isArray(data.flow_edges) || data.flow_edges.length < 2) {
    errors.push('flow_edges 至少包含 2 条流通边');
  }

  if (!Array.isArray(data.price_waterfall) || data.price_waterfall.length < 3) {
    errors.push('price_waterfall 至少包含 3 个价格阶梯');
  } else {
    for (let i = 0; i < data.price_waterfall.length; i++) {
      const cur = Number(data.price_waterfall[i].price_usd_equiv);
      if (Number.isNaN(cur) || cur <= 0) {
        errors.push(`price_waterfall[${i}].price_usd_equiv 必须为正数`);
      }
      if (i > 0 && cur <= Number(data.price_waterfall[i - 1].price_usd_equiv)) {
        errors.push('price_waterfall 中的美元等值价格必须严格递增');
        break;
      }
    }
  }

  return { valid: errors.length === 0, errors };
}

/**
 * 计算 FOB 到终端零售的价格倍率（保留一位小数）
 */
export function calcPriceMultiplier(flow: MarketFlowData): string {
  const list = flow.price_waterfall || [];
  if (list.length < 2 || list[0].price_usd_equiv <= 0) return '-';
  const ratio = list[list.length - 1].price_usd_equiv / list[0].price_usd_equiv;
  return `${ratio.toFixed(1)}x`;
}

/**
 * 当未手动传入 FAQ 时，基于结构化事实自动派生 4 条 GEO 高频问答
 */
export function generateDefaultFaqs(flow: MarketFlowData, title: string): WikiFaqItem[] {
  const country = flow.meta.country_name_cn;
  const category = flow.meta.category_name_cn;
  const firstStage = flow.price_waterfall[0];
  const lastStage = flow.price_waterfall[flow.price_waterfall.length - 1];
  const multiplier = calcPriceMultiplier(flow);
  const topSources = (flow.supply_origin.top_import_sources || [])
    .slice(0, 3)
    .map(s => `${s.country_name_cn}（约 ${s.share_pct}%，${s.positioning}）`)
    .join('、');

  const channelSummary = flow.flow_nodes
    .map(n => {
      const names = n.players.slice(0, 3).map(p => p.name).join('/');
      return `${n.label_cn}（毛利 ${n.typical_margin_range}${names ? `，代表企业：${names}` : ''}）`;
    })
    .join('；');

  const pitchSummary = flow.flow_nodes
    .slice(0, 3)
    .map(n => `面向${n.label_cn}：${n.sales_pitch_angle}`)
    .join('；');

  return [
    {
      q: `${country}${category}从中国 FOB 出厂到当地终端零售大约加价多少倍？`,
      a: `根据《${title}》拆解，典型主流单品从${firstStage.stage_name}（约 $${firstStage.price_usd_equiv}）到${lastStage.stage_name}（约 $${lastStage.price_usd_equiv}），全链路价格倍率约为 ${multiplier}，期间涵盖国际海运关税、进口商合规与品牌加价、区域渠道毛利及当地消费税/VAT。`,
    },
    {
      q: `${country}${category}市场的本土制造与进口依赖度如何？`,
      a: `${country}${category}市场本土制造占比约为 ${flow.supply_origin.local_manufacturing_pct}%，进口占比约为 ${flow.supply_origin.import_pct}%。${topSources ? `主要进口来源国包括：${topSources}。` : ''}`,
    },
    {
      q: `${country}${category}的核心流通渠道和代表买家有哪些？`,
      a: `核心分销层级包括：${channelSummary}。`,
    },
    {
      q: `中国外贸工厂和业务员切入${country}${category}渠道应重点谈什么？`,
      a: `建议按买家类型差异化切入：${pitchSummary}。`,
    },
  ];
}

/**
 * 构建专为 AI 搜索引擎与 Agent 消费的纯净 Markdown 文档
 */
export function buildWikiMarkdownExport(entry: {
  slug: string;
  title: string;
  summary: string;
  country_code: string;
  country_name: string;
  market_region: string;
  industry_name: string;
  hs_code_6?: string | null;
  archetype_id: ArchetypeId;
  flow_data: MarketFlowData;
  content_md: string;
  faq_items?: WikiFaqItem[];
  sources?: WikiSourceItem[];
  updated_at?: string;
}): string {
  const canonicalUrl = `https://marketgraphic.cn/wiki/${entry.slug}`;
  const archetype = ARCHETYPE_META[entry.archetype_id]?.nameCn || entry.archetype_id;
  const multiplier = calcPriceMultiplier(entry.flow_data);
  const updatedDate = (entry.updated_at || new Date().toISOString()).slice(0, 10);

  const lines: string[] = [
    `# ${entry.title}`,
    '',
    `> **来源**：Market Graphic（外贸智友）行业百科 — ${canonicalUrl}`,
    `> **核心摘要**：${entry.summary}`,
    `> **覆盖维度**：${entry.country_name}（${entry.country_code} / ${entry.market_region}） × ${entry.industry_name}${entry.hs_code_6 ? `（HS ${entry.hs_code_6}）` : ''} | 流通原型：${archetype} | 典型价差倍率：${multiplier} | 更新日期：${updatedDate}`,
    '',
    '## 一、供给源头格局',
    '',
    `- 本土制造占比：${entry.flow_data.supply_origin.local_manufacturing_pct}%`,
    `- 进口依赖占比：${entry.flow_data.supply_origin.import_pct}%`,
    '',
  ];

  if (entry.flow_data.supply_origin.top_import_sources?.length) {
    lines.push('| 主要进口来源国 | 估算份额 | 市场生态定位 |');
    lines.push('| :--- | :---: | :--- |');
    for (const src of entry.flow_data.supply_origin.top_import_sources) {
      lines.push(`| ${src.country_name_cn} | ${src.share_pct}% | ${src.positioning} |`);
    }
    lines.push('');
  }

  lines.push('## 二、价格瀑布与加价阶梯');
  lines.push('');
  lines.push('| 流通阶段 | 美元等值参考价 (USD) | 加价与成本构成 |');
  lines.push('| :--- | :---: | :--- |');
  for (const stage of entry.flow_data.price_waterfall) {
    lines.push(`| ${stage.stage_name} | $${stage.price_usd_equiv} | ${stage.markup_desc} |`);
  }
  lines.push('');

  lines.push('## 三、核心流通渠道与代表玩家');
  lines.push('');
  for (const node of entry.flow_data.flow_nodes) {
    lines.push(`### Tier ${node.tier} · ${node.label_cn}（渠道份额约 ${node.share_pct}% · 典型毛利 ${node.typical_margin_range}）`);
    lines.push(`- **买家痛点**：${node.buyer_pain_points.join('；')}`);
    lines.push(`- **谈单切入点**：${node.sales_pitch_angle}`);
    if (node.players.length > 0) {
      lines.push('');
      lines.push('| 代表企业 | 官网域名 | 商业模式简述 |');
      lines.push('| :--- | :--- | :--- |');
      for (const p of node.players) {
        lines.push(`| ${p.name} | ${p.website} | ${p.business_model} |`);
      }
    }
    lines.push('');
  }

  lines.push('## 四、深度图文实战解析');
  lines.push('');
  lines.push(entry.content_md.trim());
  lines.push('');

  const faqs = entry.faq_items && entry.faq_items.length > 0
    ? entry.faq_items
    : generateDefaultFaqs(entry.flow_data, entry.title);
  if (faqs.length > 0) {
    lines.push('## 五、常见问题（FAQ）');
    lines.push('');
    for (const item of faqs) {
      lines.push(`**Q：${item.q}**`);
      lines.push(`A：${item.a}`);
      lines.push('');
    }
  }

  if (entry.sources && entry.sources.length > 0) {
    lines.push('## 参考信源');
    lines.push('');
    for (const s of entry.sources) {
      lines.push(`- ${s.title}${s.publisher ? `（${s.publisher}）` : ''}${s.url ? `：${s.url}` : ''}`);
    }
    lines.push('');
  }

  lines.push('---');
  lines.push(`本文由 Market Graphic（外贸智友）整理发布，交互式图谱与关联海外买家研报请访问：${canonicalUrl}`);
  return lines.join('\n');
}
```

- [ ] **步骤 4：运行测试验证通过并提交**

运行：`npx vitest run tests/wiki-schema.test.ts`
预期：PASS（4/4 通过）

```bash
git add lib/wiki-schema.ts tests/wiki-schema.test.ts
git commit -m "feat(wiki): 实现行业百科数据校验、默认FAQ与GEO纯净Markdown导出"
```

---

### 任务 3：COS 资源上传扩展与玩家站内资产批量联动服务

**文件：**
- 修改：`lib/storage.ts:65-110`
- 创建：`lib/wiki-service.ts`
- 测试：`tests/wiki-service.test.ts`

- [ ] **步骤 1：编写失败的玩家资产联动与隐私脱敏测试**

创建 `tests/wiki-service.test.ts`：

```ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { Client } from 'pg';
import { createTestClient, cleanDatabase } from './helpers/db-test-helper';
import { matchPlayersWithPlatformAssets, upsertWikiEntry } from '../lib/wiki-service';
import { buildSampleFlowData } from './wiki-schema.test';

describe('lib/wiki-service 玩家资产联动与幂等入库', () => {
  let client: Client;
  let sampleReportId = '';

  beforeAll(async () => {
    client = createTestClient();
    await client.connect();
    await cleanDatabase(client);

    // 确保 reports 具备 website_domain 与 clean_company 列
    await client.query(`ALTER TABLE reports ADD COLUMN IF NOT EXISTS website_domain VARCHAR(255)`);
    await client.query(`ALTER TABLE reports ADD COLUMN IF NOT EXISTS clean_company VARCHAR(255)`);

    const repRes = await client.query(
      `INSERT INTO reports (title, category, market_region, summary, content_html, website_domain, clean_company)
       VALUES ($1, 'customer', '德国', 'OBI 深度洞察', '<html></html>', 'obi.de', 'obi')
       RETURNING id`,
      ['OBI 德国 DIY 零售巨头 360° 洞察']
    );
    sampleReportId = repRes.rows[0].id;
  });

  afterAll(async () => {
    await client.query(`DELETE FROM wiki_entries WHERE slug LIKE 'svc-test-%'`).catch(() => {});
    if (sampleReportId) {
      await client.query(`DELETE FROM reports WHERE id = $1`, [sampleReportId]).catch(() => {});
    }
    await client.end();
  });

  it('matchPlayersWithPlatformAssets 应精准命中站内报告且绝不泄露邮箱字段', async () => {
    const flow = buildSampleFlowData();
    const matches = await matchPlayersWithPlatformAssets(flow, client);

    expect(matches['obi.de']).toBeDefined();
    expect(matches['obi.de'].reportId).toBe(sampleReportId);
    expect(matches['obi.de'].reportTitle).toContain('OBI');
    expect(typeof matches['obi.de'].contactCount).toBe('number');
    // 严格脱敏检查：返回对象不得包含 email 或 source_session
    expect(Object.keys(matches['obi.de'])).not.toContain('email');
    expect(Object.keys(matches['obi.de'])).not.toContain('source_session');
  });

  it('upsertWikiEntry 同 slug 重复调用应幂等更新而非报错', async () => {
    const flow = buildSampleFlowData();
    const first = await upsertWikiEntry(client, {
      slug: 'svc-test-de-lighting',
      title: '首版标题',
      summary: '首版摘要',
      flow_data: flow,
      content_md: '首版正文',
    });
    expect(first.action).toBe('created');

    const second = await upsertWikiEntry(client, {
      slug: 'svc-test-de-lighting',
      title: '修订版标题',
      summary: '修订摘要',
      flow_data: flow,
      content_md: '修订正文',
    });
    expect(second.action).toBe('updated');
    expect(second.id).toBe(first.id);

    const row = await client.query(`SELECT title, market_region, faq_items FROM wiki_entries WHERE id = $1`, [first.id]);
    expect(row.rows[0].title).toBe('修订版标题');
    expect(row.rows[0].market_region).toBe('欧洲');
    expect(row.rows[0].faq_items.length).toBeGreaterThanOrEqual(4);
  });
});
```

- [ ] **步骤 2：运行测试验证失败**

运行：`npx vitest run tests/wiki-service.test.ts`
预期：FAIL，报错找不到 `../lib/wiki-service`

- [ ] **步骤 3：在 `lib/storage.ts` 中新增 `uploadWikiAsset`**

在 `lib/storage.ts` 末尾新增通用百科资产上传函数（上传至腾讯云 COS `wiki-assets/{subPath}`，本地未配置 COS 时降级写入 `public/uploads/wiki-assets/`）：

```ts
/**
 * 上传行业百科专用静态资源（如企业 Logo、封面图）到腾讯云 COS 的 wiki-assets/ 目录
 */
export async function uploadWikiAsset(buffer: Buffer, mime: string, safeKeyName: string): Promise<string> {
  const sanitizedKey = safeKeyName.replace(/[^a-zA-Z0-9._/-]/g, '_').replace(/^\/+/, '');
  const cloudPath = `wiki-assets/${sanitizedKey}`;

  if (cosEnabled()) {
    const Bucket = process.env.COS_BUCKET!;
    const Region = process.env.COS_REGION!;
    const cos = getCOSInstance();

    return new Promise((resolve, reject) => {
      cos.putObject(
        {
          Bucket,
          Region,
          Key: cloudPath,
          Body: buffer,
          ContentType: mime,
        },
        (err) => {
          if (err) {
            return reject(new Error(`COS 上传百科资源失败: ${err.message || JSON.stringify(err)}`));
          }
          const domain = process.env.COS_DOMAIN
            ? process.env.COS_DOMAIN.replace(/\/$/, '')
            : `https://${Bucket}.cos.${Region}.myqcloud.com`;
          resolve(`${domain}/${cloudPath}`);
        }
      );
    });
  }

  const fs = require('fs');
  const path = require('path');
  const localPath = path.join(process.cwd(), 'public', 'uploads', cloudPath);
  fs.mkdirSync(path.dirname(localPath), { recursive: true });
  fs.writeFileSync(localPath, buffer);
  return `/uploads/${cloudPath}`;
}
```

- [ ] **步骤 4：实现 `lib/wiki-service.ts`**

创建 `lib/wiki-service.ts`：

```ts
import { PoolClient, Client } from 'pg';
import { extractRootDomain, cleanCompanyNameForLookup } from './crm-service';
import { getRegionByCountryName } from './region-country-mapper';
import {
  MarketFlowData,
  WikiFaqItem,
  WikiSourceItem,
  normalizeWikiSlug,
  validateMarketFlowData,
  generateDefaultFaqs,
} from './wiki-schema';

export type DbQueryable = Pick<PoolClient | Client, 'query'>;

export interface PlayerAssetMatch {
  reportId: string | null;
  reportTitle: string | null;
  contactCount: number;
}

export interface RelatedWikiReport {
  id: string;
  title: string;
  category: string;
  market_region: string;
  summary: string;
}

export interface UpsertWikiPayload {
  slug?: string;
  title: string;
  summary: string;
  flow_data: MarketFlowData;
  content_md: string;
  faq_items?: WikiFaqItem[];
  sources?: WikiSourceItem[];
  video_url?: string | null;
  cover_image?: string | null;
  status?: 'draft' | 'published';
}

/**
 * 批量将百科图谱中的渠道玩家与站内 reports、crm_contacts 碰撞，返回脱敏汇总结果
 */
export async function matchPlayersWithPlatformAssets(
  flowData: MarketFlowData,
  dbClient: DbQueryable
): Promise<Record<string, PlayerAssetMatch>> {
  const result: Record<string, PlayerAssetMatch> = {};
  const domainSet = new Set<string>();
  const cleanNameSet = new Set<string>();
  const playerKeys: Array<{ key: string; domain: string; cleanName: string }> = [];

  for (const node of flowData.flow_nodes || []) {
    for (const player of node.players || []) {
      const domain = extractRootDomain(player.website);
      const cleanName = cleanCompanyNameForLookup(player.name);
      const key = domain || cleanName;
      if (!key) continue;
      if (domain) domainSet.add(domain);
      if (cleanName && cleanName.length >= 3) cleanNameSet.add(cleanName);
      playerKeys.push({ key, domain, cleanName });
      if (!result[key]) {
        result[key] = { reportId: null, reportTitle: null, contactCount: 0 };
      }
    }
  }

  const domains = Array.from(domainSet);
  const cleanNames = Array.from(cleanNameSet);
  if (domains.length === 0 && cleanNames.length === 0) {
    return result;
  }

  // 1. 批量匹配站内已发布的深度研报（按 website_domain 优先，其次 clean_company）
  try {
    const repRes = await dbClient.query(
      `SELECT id, title, website_domain, clean_company
       FROM reports
       WHERE (array_length($1::text[], 1) > 0 AND website_domain = ANY($1::text[]))
          OR (array_length($2::text[], 1) > 0 AND clean_company = ANY($2::text[]))
       ORDER BY created_at DESC`,
      [domains, cleanNames]
    );

    const byDomain = new Map<string, { id: string; title: string }>();
    const byCleanName = new Map<string, { id: string; title: string }>();
    for (const row of repRes.rows) {
      if (row.website_domain && !byDomain.has(row.website_domain)) {
        byDomain.set(row.website_domain, { id: row.id, title: row.title });
      }
      if (row.clean_company && !byCleanName.has(row.clean_company)) {
        byCleanName.set(row.clean_company, { id: row.id, title: row.title });
      }
    }

    for (const pk of playerKeys) {
      const matched = (pk.domain && byDomain.get(pk.domain)) || (pk.cleanName && byCleanName.get(pk.cleanName));
      if (matched) {
        result[pk.key].reportId = matched.id;
        result[pk.key].reportTitle = matched.title;
      }
    }
  } catch (err) {
    console.warn('[WikiService] 匹配站内 reports 降级跳过:', (err as Error).message);
  }

  // 2. 批量聚合匹配 crm_contacts 采购联系人数量（绝不查询或返回邮箱明细与参展届数）
  try {
    const crmRes = await dbClient.query(
      `SELECT website_domain, clean_company_name, COUNT(DISTINCT email)::int AS cnt
       FROM crm_contacts
       WHERE (array_length($1::text[], 1) > 0 AND website_domain = ANY($1::text[]))
          OR (array_length($2::text[], 1) > 0 AND clean_company_name = ANY($2::text[]))
       GROUP BY website_domain, clean_company_name`,
      [domains, cleanNames]
    );

    const countByDomain = new Map<string, number>();
    const countByCleanName = new Map<string, number>();
    for (const row of crmRes.rows) {
      if (row.website_domain) {
        countByDomain.set(row.website_domain, (countByDomain.get(row.website_domain) || 0) + Number(row.cnt || 0));
      }
      if (row.clean_company_name) {
        countByCleanName.set(row.clean_company_name, (countByCleanName.get(row.clean_company_name) || 0) + Number(row.cnt || 0));
      }
    }

    for (const pk of playerKeys) {
      const domainCnt = pk.domain ? (countByDomain.get(pk.domain) || 0) : 0;
      const nameCnt = pk.cleanName ? (countByCleanName.get(pk.cleanName) || 0) : 0;
      result[pk.key].contactCount = domainCnt > 0 ? domainCnt : nameCnt;
    }
  } catch (err) {
    // 测试环境或尚未同步 crm_contacts 表时安全降级为 0
    console.warn('[WikiService] 匹配 crm_contacts 计数降级为 0:', (err as Error).message);
  }

  return result;
}

/**
 * 检索同品类或同国家的站内深度研报，用于详情页底部转化引导
 */
export async function getRelatedReportsForWiki(
  industryName: string,
  countryName: string,
  dbClient: DbQueryable,
  limit = 4
): Promise<RelatedWikiReport[]> {
  try {
    const res = await dbClient.query(
      `SELECT DISTINCT r.id, r.title, r.category, r.market_region, r.summary, r.created_at
       FROM reports r
       LEFT JOIN report_industries ri ON r.id = ri.report_id
       LEFT JOIN industries ind ON ri.industry_id = ind.id
       WHERE ind.name = $1 OR r.market_region ILIKE $2 OR r.title ILIKE $3
       ORDER BY r.created_at DESC
       LIMIT $4`,
      [industryName, `%${countryName}%`, `%${industryName}%`, limit]
    );
    return res.rows.map((r: any) => ({
      id: r.id,
      title: r.title,
      category: r.category || 'customer',
      market_region: r.market_region || '',
      summary: r.summary ? (r.summary.length > 120 ? `${r.summary.slice(0, 120)}...` : r.summary) : '',
    }));
  } catch (err) {
    console.warn('[WikiService] 检索延伸研报失败:', (err as Error).message);
    return [];
  }
}

/**
 * 幂等写入或更新行业百科词条（按 slug Upsert）
 */
export async function upsertWikiEntry(
  dbClient: DbQueryable,
  payload: UpsertWikiPayload
): Promise<{ id: string; slug: string; action: 'created' | 'updated' }> {
  const validation = validateMarketFlowData(payload.flow_data);
  if (!validation.valid) {
    throw new Error(`flow_data 校验失败: ${validation.errors.join('; ')}`);
  }
  if (!payload.title?.trim() || !payload.summary?.trim() || !payload.content_md?.trim()) {
    throw new Error('title、summary、content_md 均不能为空');
  }

  const slug = normalizeWikiSlug(payload.slug || payload.flow_data.meta.id);
  const countryCode = payload.flow_data.meta.country_code.toUpperCase();
  const countryName = payload.flow_data.meta.country_name_cn.trim();
  const marketRegion = getRegionByCountryName(countryName) || '全球';
  const industryName = payload.flow_data.meta.category_name_cn.trim();
  const categoryId = payload.flow_data.meta.category_id ?? null;
  const hsCode6 = payload.flow_data.meta.hs_code_6 || null;
  const archetypeId = payload.flow_data.meta.archetype_id;
  const status = payload.status === 'draft' ? 'draft' : 'published';

  const faqItems = Array.isArray(payload.faq_items) && payload.faq_items.length > 0
    ? payload.faq_items
    : generateDefaultFaqs(payload.flow_data, payload.title.trim());
  const sources = Array.isArray(payload.sources) ? payload.sources : [];

  const existing = await dbClient.query(`SELECT id FROM wiki_entries WHERE slug = $1`, [slug]);
  const action: 'created' | 'updated' = existing.rows.length > 0 ? 'updated' : 'created';

  const upsertRes = await dbClient.query(
    `INSERT INTO wiki_entries (
       slug, title, summary, country_code, country_name, market_region,
       category_id, industry_name, hs_code_6, archetype_id,
       flow_data, content_md, faq_items, sources,
       video_url, cover_image, status, published_at, updated_at
     )
     VALUES (
       $1, $2, $3, $4, $5, $6,
       $7, $8, $9, $10,
       $11::jsonb, $12, $13::jsonb, $14::jsonb,
       $15, $16, $17, CASE WHEN $17 = 'published' THEN NOW() ELSE NULL END, NOW()
     )
     ON CONFLICT (slug) DO UPDATE SET
       title = EXCLUDED.title,
       summary = EXCLUDED.summary,
       country_code = EXCLUDED.country_code,
       country_name = EXCLUDED.country_name,
       market_region = EXCLUDED.market_region,
       category_id = EXCLUDED.category_id,
       industry_name = EXCLUDED.industry_name,
       hs_code_6 = EXCLUDED.hs_code_6,
       archetype_id = EXCLUDED.archetype_id,
       flow_data = EXCLUDED.flow_data,
       content_md = EXCLUDED.content_md,
       faq_items = EXCLUDED.faq_items,
       sources = EXCLUDED.sources,
       video_url = COALESCE(EXCLUDED.video_url, wiki_entries.video_url),
       cover_image = COALESCE(EXCLUDED.cover_image, wiki_entries.cover_image),
       status = EXCLUDED.status,
       published_at = COALESCE(wiki_entries.published_at, EXCLUDED.published_at),
       updated_at = NOW()
     RETURNING id, slug`,
    [
      slug,
      payload.title.trim(),
      payload.summary.trim(),
      countryCode,
      countryName,
      marketRegion,
      categoryId,
      industryName,
      hsCode6,
      archetypeId,
      JSON.stringify(payload.flow_data),
      payload.content_md,
      JSON.stringify(faqItems),
      JSON.stringify(sources),
      payload.video_url || null,
      payload.cover_image || null,
      status,
    ]
  );

  return {
    id: upsertRes.rows[0].id,
    slug: upsertRes.rows[0].slug,
    action,
  };
}
```

- [ ] **步骤 5：运行测试验证通过并提交**

运行：`npx vitest run tests/wiki-service.test.ts`
预期：PASS（2/2 通过）

```bash
git add lib/storage.ts lib/wiki-service.ts tests/wiki-service.test.ts
git commit -m "feat(wiki): 扩展COS百科资产上传并实现玩家站内资产联动与幂等入库服务"
```

---

### 任务 4：自动化推送 API、管理后台 API 与 GEO 机器直读端点

**文件：**
- 创建：`pages/api/agent/wiki.ts`
- 创建：`pages/api/admin/wiki.ts`
- 创建：`pages/api/llms.ts`
- 创建：`pages/api/wiki/[slug]/markdown.ts`
- 测试：`tests/wiki-api.test.ts`

- [ ] **步骤 1：编写失败的 API 集成测试**

创建 `tests/wiki-api.test.ts`：

```ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { Client } from 'pg';
import { createTestClient, cleanDatabase, mockReqRes } from './helpers/db-test-helper';
import { encodeSession } from '../lib/auth';
import agentWikiHandler from '../pages/api/agent/wiki';
import adminWikiHandler from '../pages/api/admin/wiki';
import llmsHandler from '../pages/api/llms';
import wikiMarkdownHandler from '../pages/api/wiki/[slug]/markdown';
import { buildSampleFlowData } from './wiki-schema.test';

describe('行业百科 API 与 GEO 机器直读接口测试', () => {
  let client: Client;
  let adminCookie = '';
  let userCookie = '';
  let createdId = '';

  beforeAll(async () => {
    client = createTestClient();
    await client.connect();
    await cleanDatabase(client);
    process.env.AGENT_API_KEY = 'wiki_test_agent_key';
    adminCookie = `gtb_session=${encodeSession({ userId: '00000000-0000-0000-0000-000000000001', role: 'admin' })}`;
    userCookie = `gtb_session=${encodeSession({ userId: '00000000-0000-0000-0000-000000000002', role: 'user' })}`;
  });

  afterAll(async () => {
    await client.query(`DELETE FROM wiki_entries WHERE slug LIKE 'api-test-%'`).catch(() => {});
    await client.end();
  });

  it('POST /api/agent/wiki 未授权应返回 401', async () => {
    const { req, res, getStatus } = mockReqRes({
      method: 'POST',
      headers: { authorization: 'Bearer wrong_key' },
      body: { title: 'x' },
    });
    await agentWikiHandler(req, res);
    expect(getStatus()).toBe(401);
  });

  it('POST /api/agent/wiki 应校验数据并支持同 slug 幂等推送', async () => {
    const flow = buildSampleFlowData();
    const { req, res, getStatus, getJson } = mockReqRes({
      method: 'POST',
      headers: { authorization: 'Bearer wiki_test_agent_key' },
      body: {
        slug: 'api-test-de-lighting',
        title: '德国照明产品海外流通全景',
        summary: '拆解德国LED照明双轨毛利结构。',
        flow_data: flow,
        content_md: '## 核心结论\n德国市场重认证。',
        status: 'published',
      },
    });
    await agentWikiHandler(req, res);
    expect(getStatus()).toBe(200);
    expect(getJson().success).toBe(true);
    expect(getJson().action).toBe('created');
    createdId = getJson().id;

    // 再次推送同一 slug -> updated
    const second = mockReqRes({
      method: 'POST',
      headers: { authorization: 'Bearer wiki_test_agent_key' },
      body: {
        slug: 'api-test-de-lighting',
        title: '德国照明产品海外流通全景（2026修订）',
        summary: '拆解德国LED照明双轨毛利结构。',
        flow_data: flow,
        content_md: '## 核心结论\n德国市场重认证与现货。',
        status: 'published',
      },
    });
    await agentWikiHandler(second.req, second.res);
    expect(second.getStatus()).toBe(200);
    expect(second.getJson().action).toBe('updated');
  });

  it('GET /api/llms 与 /api/wiki/[slug]/markdown 应输出有效 GEO 文本', async () => {
    let llmsBody = '';
    let llmsStatus = 0;
    const llmsRes: any = {
      status(c: number) { llmsStatus = c; return this; },
      setHeader() { return this; },
      send(b: string) { llmsBody = b; return this; },
      json(b: any) { llmsBody = JSON.stringify(b); return this; },
    };
    await llmsHandler({ method: 'GET', query: {}, headers: {} } as any, llmsRes);
    expect(llmsStatus).toBe(200);
    expect(llmsBody).toContain('Market Graphic');
    expect(llmsBody).toContain('/wiki/api-test-de-lighting');

    let mdBody = '';
    let mdStatus = 0;
    const mdRes: any = {
      status(c: number) { mdStatus = c; return this; },
      setHeader() { return this; },
      send(b: string) { mdBody = b; return this; },
      json(b: any) { mdBody = JSON.stringify(b); return this; },
    };
    await wikiMarkdownHandler({ method: 'GET', query: { slug: 'api-test-de-lighting' }, headers: {} } as any, mdRes);
    expect(mdStatus).toBe(200);
    expect(mdBody).toContain('德国照明产品海外流通全景（2026修订）');
    expect(mdBody).toContain('https://marketgraphic.cn/wiki/api-test-de-lighting');
  });

  it('/api/admin/wiki 应拦截普通用户(403)并允许管理员下架/删除', async () => {
    const forbidden = mockReqRes({
      method: 'GET',
      headers: { cookie: userCookie },
      session: { userId: '00000000-0000-0000-0000-000000000002', role: 'user' },
    });
    await adminWikiHandler(forbidden.req, forbidden.res);
    expect(forbidden.getStatus()).toBe(403);

    // 管理员改为 draft
    const putDraft = mockReqRes({
      method: 'PUT',
      headers: { cookie: adminCookie },
      session: { userId: '00000000-0000-0000-0000-000000000001', role: 'admin' },
      body: { id: createdId, status: 'draft' },
    });
    await adminWikiHandler(putDraft.req, putDraft.res);
    expect(putDraft.getStatus()).toBe(200);

    // draft 状态下公开 markdown 端点应返回 404
    const mdDraft = mockReqRes({
      method: 'GET',
      query: { slug: 'api-test-de-lighting' },
    });
    await wikiMarkdownHandler(mdDraft.req, mdDraft.res);
    expect(mdDraft.getStatus()).toBe(404);

    // 管理员删除
    const del = mockReqRes({
      method: 'DELETE',
      headers: { cookie: adminCookie },
      session: { userId: '00000000-0000-0000-0000-000000000001', role: 'admin' },
      query: { id: createdId },
    });
    await adminWikiHandler(del.req, del.res);
    expect(del.getStatus()).toBe(200);
  });
});
```

- [ ] **步骤 2：运行测试验证失败**

运行：`npx vitest run tests/wiki-api.test.ts`
预期：FAIL，报错找不到对应 API 路由模块

- [ ] **步骤 3：实现 `pages/api/agent/wiki.ts`**

```ts
import { NextApiRequest, NextApiResponse } from 'next';
import { PoolClient } from 'pg';
import { withDb } from '../../../lib/api-handler';
import { uploadWikiAsset } from '../../../lib/storage';
import { extractRootDomain } from '../../../lib/crm-service';
import { MarketFlowData } from '../../../lib/wiki-schema';
import { upsertWikiEntry } from '../../../lib/wiki-service';

export const config = {
  api: {
    bodyParser: {
      sizeLimit: '10mb',
    },
  },
};

function isAgentAuthorized(req: NextApiRequest): boolean {
  const authHeader = req.headers.authorization;
  const token = (authHeader && authHeader.split(' ')[1]) || (req.headers['x-agent-key'] as string);
  const isProd = process.env.NODE_ENV === 'production';
  const expectedToken = process.env.AGENT_API_KEY;
  if (isProd && !expectedToken) return false;
  return isProd
    ? Boolean(token) && token === expectedToken
    : token === (expectedToken || 'automation_agent_secret') || token === 'automation_agent_secret';
}

async function hydrateLogosToCos(flowData: MarketFlowData, logos?: Record<string, string>): Promise<MarketFlowData> {
  if (!logos || typeof logos !== 'object') return flowData;
  const uploadedMap: Record<string, string> = {};

  for (const [rawDomain, dataUrl] of Object.entries(logos)) {
    const domain = extractRootDomain(rawDomain) || rawDomain.trim().toLowerCase();
    const match = typeof dataUrl === 'string' && dataUrl.match(/^data:(image\/[a-zA-Z0-9+.-]+);base64,(.+)$/);
    if (!domain || !match) continue;
    const mime = match[1];
    const ext = mime.includes('svg') ? 'svg' : mime.split('/')[1] || 'png';
    const buffer = Buffer.from(match[2], 'base64');
    uploadedMap[domain] = await uploadWikiAsset(buffer, mime, `logos/${domain}.${ext}`);
  }

  return {
    ...flowData,
    flow_nodes: flowData.flow_nodes.map(node => ({
      ...node,
      players: node.players.map(player => {
        const domain = extractRootDomain(player.website);
        return uploadedMap[domain] ? { ...player, logo_url: uploadedMap[domain] } : player;
      }),
    })),
  };
}

async function agentWikiHandler(req: NextApiRequest, res: NextApiResponse, dbClient: PoolClient) {
  if (!isAgentAuthorized(req)) {
    return res.status(401).json({ error: 'Unauthorized: Invalid Agent API Key' });
  }

  const { slug, title, summary, flow_data, content_md, faq_items, sources, video_url, cover_image, status, logos } = req.body || {};

  try {
    const hydratedFlow = await hydrateLogosToCos(flow_data, logos);
    const saved = await upsertWikiEntry(dbClient, {
      slug,
      title,
      summary,
      flow_data: hydratedFlow,
      content_md,
      faq_items,
      sources,
      video_url,
      cover_image,
      status,
    });

    return res.status(200).json({
      success: true,
      id: saved.id,
      slug: saved.slug,
      url: `/wiki/${saved.slug}`,
      action: saved.action,
    });
  } catch (err: any) {
    return res.status(400).json({ error: err?.message || '参数校验失败' });
  }
}

export default withDb(agentWikiHandler, { methods: ['POST'] });
```

- [ ] **步骤 4：实现 `pages/api/admin/wiki.ts`**

```ts
import { NextApiRequest, NextApiResponse } from 'next';
import { PoolClient } from 'pg';
import { withDb } from '../../../lib/api-handler';
import { requireAdmin } from '../../../lib/auth';

async function adminWikiHandler(req: NextApiRequest, res: NextApiResponse, dbClient: PoolClient) {
  const session = requireAdmin(req);
  if (!session) {
    return res.status(403).json({ error: '权限不足，仅管理员可访问' });
  }

  if (req.method === 'GET') {
    const id = req.query.id as string | undefined;
    if (id) {
      const detailRes = await dbClient.query(`SELECT * FROM wiki_entries WHERE id = $1::uuid`, [id]);
      if (detailRes.rows.length === 0) return res.status(404).json({ error: '百科词条不存在' });
      return res.status(200).json({ data: detailRes.rows[0] });
    }

    const page = Math.max(1, parseInt((req.query.page as string) || '1', 10) || 1);
    const pageSize = Math.min(100, Math.max(1, parseInt((req.query.pageSize as string) || '20', 10) || 20));
    const offset = (page - 1) * pageSize;
    const status = (req.query.status as string) || 'all';
    const q = ((req.query.q as string) || '').trim();

    const conditions: string[] = [];
    const params: any[] = [];
    if (status === 'draft' || status === 'published') {
      params.push(status);
      conditions.push(`status = $${params.length}`);
    }
    if (q) {
      params.push(`%${q}%`);
      conditions.push(`(title ILIKE $${params.length} OR slug ILIKE $${params.length} OR country_name ILIKE $${params.length} OR industry_name ILIKE $${params.length})`);
    }
    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const countRes = await dbClient.query(`SELECT COUNT(*)::int AS total FROM wiki_entries ${whereClause}`, params);
    const listParams = [...params, pageSize, offset];
    const listRes = await dbClient.query(
      `SELECT id, slug, title, summary, country_code, country_name, market_region,
              industry_name, hs_code_6, archetype_id, video_url, status, view_count,
              published_at, updated_at
       FROM wiki_entries
       ${whereClause}
       ORDER BY updated_at DESC
       LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      listParams
    );

    return res.status(200).json({
      data: listRes.rows,
      total: countRes.rows[0].total,
      page,
      pageSize,
    });
  }

  if (req.method === 'PUT') {
    const { id, title, summary, content_md, faq_items, sources, video_url, cover_image, status } = req.body || {};
    if (!id) return res.status(400).json({ error: '缺少词条 id' });

    const fields: string[] = [];
    const params: any[] = [];
    const pushField = (col: string, val: any, cast = '') => {
      params.push(val);
      fields.push(`${col} = $${params.length}${cast}`);
    };

    if (typeof title === 'string' && title.trim()) pushField('title', title.trim());
    if (typeof summary === 'string' && summary.trim()) pushField('summary', summary.trim());
    if (typeof content_md === 'string') pushField('content_md', content_md);
    if (Array.isArray(faq_items)) pushField('faq_items', JSON.stringify(faq_items), '::jsonb');
    if (Array.isArray(sources)) pushField('sources', JSON.stringify(sources), '::jsonb');
    if (video_url !== undefined) pushField('video_url', video_url ? String(video_url).trim() : null);
    if (cover_image !== undefined) pushField('cover_image', cover_image ? String(cover_image).trim() : null);
    if (status === 'draft' || status === 'published') {
      pushField('status', status);
      if (status === 'published') {
        fields.push('published_at = COALESCE(published_at, NOW())');
      }
    }

    if (fields.length === 0) {
      return res.status(400).json({ error: '没有可更新的字段' });
    }
    fields.push('updated_at = NOW()');
    params.push(id);

    const upd = await dbClient.query(
      `UPDATE wiki_entries SET ${fields.join(', ')} WHERE id = $${params.length}::uuid RETURNING id, slug, status, updated_at`,
      params
    );
    if (upd.rows.length === 0) return res.status(404).json({ error: '百科词条不存在' });
    return res.status(200).json({ success: true, data: upd.rows[0] });
  }

  if (req.method === 'DELETE') {
    const id = (req.query.id || req.body?.id) as string;
    if (!id) return res.status(400).json({ error: '缺少词条 id' });
    const del = await dbClient.query(`DELETE FROM wiki_entries WHERE id = $1::uuid RETURNING id`, [id]);
    if (del.rows.length === 0) return res.status(404).json({ error: '百科词条不存在' });
    return res.status(200).json({ success: true });
  }

  return res.status(405).json({ error: 'Method Not Allowed' });
}

export default withDb(adminWikiHandler, { methods: ['GET', 'PUT', 'DELETE'] });
```

- [ ] **步骤 5：实现 GEO 端点 `pages/api/llms.ts` 与 `pages/api/wiki/[slug]/markdown.ts`**

创建 `pages/api/llms.ts`：

```ts
import { NextApiRequest, NextApiResponse } from 'next';
import { PoolClient } from 'pg';
import { withDb } from '../../lib/api-handler';

const BASE_URL = 'https://marketgraphic.cn';

async function llmsHandler(req: NextApiRequest, res: NextApiResponse, dbClient: PoolClient) {
  const wikiRes = await dbClient.query(
    `SELECT slug, title, summary, country_name, industry_name, hs_code_6, updated_at
     FROM wiki_entries
     WHERE status = 'published'
     ORDER BY updated_at DESC
     LIMIT 500`
  );

  const lines: string[] = [
    '# Market Graphic (外贸智友)',
    '',
    '> 面向中国外贸出口商的全球市场结构与商业情报平台，提供 54 个出口大类的海外商品流通图谱、价格加价瀑布、真实买家清单与合规实战百科。',
    '',
    '## 核心公开栏目',
    `- [行业百科大厅](${BASE_URL}/wiki): 免费公开的「国家 × 品类」海外流通全景、利润拆解与合规实战知识库`,
    `- [每日资讯](${BASE_URL}/news): 54 个出口行业海外大买家动态、关税与准入政策追踪`,
    `- [出海研报大厅](${BASE_URL}/reports): 海外买家 360° 洞察与细分品类深度商业报告`,
    '',
    '## 行业百科词条索引（支持追加 .md 获取纯净 Markdown 原文）',
  ];

  for (const row of wikiRes.rows) {
    const hsPart = row.hs_code_6 ? ` · HS ${row.hs_code_6}` : '';
    lines.push(
      `- [${row.title}](${BASE_URL}/wiki/${row.slug}) ([Markdown](${BASE_URL}/wiki/${row.slug}.md)): ${row.country_name}×${row.industry_name}${hsPart} — ${row.summary}`
    );
  }

  res.setHeader('Content-Type', 'text/plain; charset=utf-8');
  res.setHeader('Cache-Control', 'public, max-age=300, stale-while-revalidate=600');
  return res.status(200).send(lines.join('\n'));
}

export default withDb(llmsHandler, { methods: ['GET'] });
```

创建 `pages/api/wiki/[slug]/markdown.ts`：

```ts
import { NextApiRequest, NextApiResponse } from 'next';
import { PoolClient } from 'pg';
import { withDb } from '../../../../lib/api-handler';
import { buildWikiMarkdownExport } from '../../../../lib/wiki-schema';

async function wikiMarkdownHandler(req: NextApiRequest, res: NextApiResponse, dbClient: PoolClient) {
  const rawSlug = String(req.query.slug || '').replace(/\.md$/i, '').trim().toLowerCase();
  if (!rawSlug) {
    return res.status(400).send('# 400 Bad Request\nMissing wiki slug.');
  }

  const queryRes = await dbClient.query(
    `SELECT slug, title, summary, country_code, country_name, market_region,
            industry_name, hs_code_6, archetype_id, flow_data, content_md,
            faq_items, sources, updated_at
     FROM wiki_entries
     WHERE slug = $1 AND status = 'published'
     LIMIT 1`,
    [rawSlug]
  );

  if (queryRes.rows.length === 0) {
    return res.status(404).send('# 404 Not Found\nWiki entry not found.');
  }

  const entry = queryRes.rows[0];
  const markdown = buildWikiMarkdownExport({
    ...entry,
    updated_at: entry.updated_at ? new Date(entry.updated_at).toISOString() : undefined,
  });

  res.setHeader('Content-Type', 'text/markdown; charset=utf-8');
  res.setHeader('Cache-Control', 'public, max-age=300, stale-while-revalidate=600');
  return res.status(200).send(markdown);
}

export default withDb(wikiMarkdownHandler, { methods: ['GET'] });
```

- [ ] **步骤 6：运行测试验证通过并提交**

运行：`npx vitest run tests/wiki-api.test.ts`
预期：PASS（4/4 通过）

```bash
git add pages/api/agent/wiki.ts pages/api/admin/wiki.ts pages/api/llms.ts "pages/api/wiki/[slug]/markdown.ts" tests/wiki-api.test.ts
git commit -m "feat(wiki): 新增Agent推送、后台管理与GEO机器直读接口(/llms.txt与.md)"
```

---

### 任务 5：纯 React 安全 Markdown 渲染器与 JSON-LD 封装组件

**文件：**
- 创建：`components/wiki/SafeMarkdown.tsx`
- 创建：`components/wiki/JsonLdScript.tsx`
- 测试：`tests/wiki-markdown.test.ts`

- [ ] **步骤 1：编写失败的安全渲染与目录提取测试**

创建 `tests/wiki-markdown.test.ts`：

```ts
import { describe, it, expect } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import SafeMarkdown, { extractTocHeadings, sanitizeUrl } from '../components/wiki/SafeMarkdown';
import { serializeJsonLd } from '../components/wiki/JsonLdScript';

describe('SafeMarkdown 与 JsonLdScript 安全性测试', () => {
  it('sanitizeUrl 应阻断 javascript: 与 data: 危险协议', () => {
    expect(sanitizeUrl('https://marketgraphic.cn/reports')).toBe('https://marketgraphic.cn/reports');
    expect(sanitizeUrl('/wiki/de-lighting')).toBe('/wiki/de-lighting');
    expect(sanitizeUrl('javascript:alert(1)')).toBeNull();
    expect(sanitizeUrl('data:text/html,<script>alert(1)</script>')).toBeNull();
  });

  it('extractTocHeadings 应提取 H2/H3 标题并生成稳定锚点 id', () => {
    const md = '## 供给格局\n正文\n### 进口来源国\n## 合规红线';
    const toc = extractTocHeadings(md);
    expect(toc).toHaveLength(3);
    expect(toc[0]).toEqual({ level: 2, text: '供给格局', id: 'section-1' });
    expect(toc[1]).toEqual({ level: 3, text: '进口来源国', id: 'section-2' });
  });

  it('SafeMarkdown 应渲染 GFM 表格、列表、粗体并拦截 XSS 链接', () => {
    const md = [
      '## 成本拆解',
      '重点关注 **FOB 加价** 与 [安全链接](https://obi.de) 以及 [恶意链接](javascript:alert(1))。',
      '',
      '| 阶段 | 价格 |',
      '| :--- | :---: |',
      '| FOB | $4.5 |',
    ].join('\n');

    const html = renderToStaticMarkup(React.createElement(SafeMarkdown, { content: md }));
    expect(html).toContain('<h2 id="section-1"');
    expect(html).toContain('<strong>FOB 加价</strong>');
    expect(html).toContain('href="https://obi.de"');
    expect(html).not.toContain('javascript:alert');
    expect(html).toContain('<table');
    expect(html).toContain('$4.5');
  });

  it('serializeJsonLd 应对 < 进行 Unicode 转义防脚本逃逸', () => {
    const out = serializeJsonLd({ name: 'Test </script><script>alert(1)</script>' });
    expect(out).not.toContain('</script>');
    expect(out).toContain('\\u003c/script>');
  });
});
```

- [ ] **步骤 2：运行测试验证失败**

运行：`npx vitest run tests/wiki-markdown.test.ts`
预期：FAIL，报错找不到 `../components/wiki/SafeMarkdown`

- [ ] **步骤 3：实现 `components/wiki/SafeMarkdown.tsx`**

纯 React JSX 渲染（零 `dangerouslySetInnerHTML`，无 ESM 依赖风险），支持 H2–H4 锚点、段落、GFM 表格、引用块、无序/有序列表、水平分割线、图片、粗体/斜体/行内代码/安全链接：

```tsx
import React from 'react';

export interface TocHeading {
  level: 2 | 3;
  text: string;
  id: string;
}

/**
 * 链接协议白名单：仅允许 http / https / 站内相对路径
 */
export function sanitizeUrl(raw: string): string | null {
  const trimmed = (raw || '').trim();
  if (!trimmed) return null;
  if (trimmed.startsWith('/') || trimmed.startsWith('#')) return trimmed;
  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol === 'http:' || parsed.protocol === 'https:') {
      return parsed.toString();
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * 提取 H2 / H3 章节目录，与正文渲染使用完全一致的序号锚点
 */
export function extractTocHeadings(markdown: string): TocHeading[] {
  const headings: TocHeading[] = [];
  let idx = 0;
  for (const line of (markdown || '').split(/\r?\n/)) {
    const match = line.match(/^(#{2,3})\s+(.+?)\s*$/);
    if (match) {
      idx += 1;
      headings.push({
        level: match[1].length as 2 | 3,
        text: match[2].replace(/\*\*/g, '').trim(),
        id: `section-${idx}`,
      });
    }
  }
  return headings;
}

function renderInline(text: string, keyPrefix: string): React.ReactNode[] {
  const tokens: React.ReactNode[] = [];
  const regex = /(\*\*[^*]+\*\*|`[^`]+`|\[[^\]]+\]\([^)]+\)|\*[^*]+\*)/g;
  let lastIdx = 0;
  let match: RegExpExecArray | null;
  let partIdx = 0;

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIdx) {
      tokens.push(text.slice(lastIdx, match.index));
    }
    const token = match[0];
    const key = `${keyPrefix}-${partIdx++}`;

    if (token.startsWith('**') && token.endsWith('**')) {
      tokens.push(<strong key={key}>{token.slice(2, -2)}</strong>);
    } else if (token.startsWith('`') && token.endsWith('`')) {
      tokens.push(
        <code
          key={key}
          style={{
            background: 'rgba(18, 18, 18, 0.06)',
            padding: '2px 6px',
            borderRadius: '4px',
            fontSize: '0.88em',
          }}
        >
          {token.slice(1, -1)}
        </code>
      );
    } else if (token.startsWith('[')) {
      const linkMatch = token.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
      if (linkMatch) {
        const safeHref = sanitizeUrl(linkMatch[2]);
        if (safeHref) {
          const isExternal = safeHref.startsWith('http');
          tokens.push(
            <a
              key={key}
              href={safeHref}
              target={isExternal ? '_blank' : undefined}
              rel={isExternal ? 'noopener noreferrer' : undefined}
              style={{ color: 'var(--color-accent, #ff641e)', textDecoration: 'underline', fontWeight: 500 }}
            >
              {linkMatch[1]}
            </a>
          );
        } else {
          tokens.push(<span key={key}>{linkMatch[1]}</span>);
        }
      }
    } else if (token.startsWith('*') && token.endsWith('*')) {
      tokens.push(<em key={key}>{token.slice(1, -1)}</em>);
    }
    lastIdx = regex.lastIndex;
  }

  if (lastIdx < text.length) {
    tokens.push(text.slice(lastIdx));
  }
  return tokens;
}

function parseTableRow(line: string): string[] {
  return line
    .trim()
    .replace(/^\|/, '')
    .replace(/\|$/, '')
    .split('|')
    .map(cell => cell.trim());
}

interface SafeMarkdownProps {
  content: string;
}

export default function SafeMarkdown({ content }: SafeMarkdownProps) {
  const lines = (content || '').split(/\r?\n/);
  const elements: React.ReactNode[] = [];
  let i = 0;
  let headingCounter = 0;

  while (i < lines.length) {
    const line = lines[i];
    const trimmed = line.trim();

    if (!trimmed) {
      i += 1;
      continue;
    }

    // 分隔线
    if (/^[-*_]{3,}$/.test(trimmed)) {
      elements.push(<hr key={`hr-${i}`} style={{ border: 'none', borderTop: '1px solid rgba(18,18,18,0.08)', margin: '28px 0' }} />);
      i += 1;
      continue;
    }

    // 标题 (H1-H4)
    const headingMatch = trimmed.match(/^(#{1,4})\s+(.+)$/);
    if (headingMatch) {
      const level = headingMatch[1].length;
      const text = headingMatch[2].trim();
      const anchorId = level === 2 || level === 3 ? `section-${++headingCounter}` : undefined;
      if (level <= 2) {
        elements.push(
          <h2 key={`h-${i}`} id={anchorId} className="font-editorial" style={{ fontSize: '1.5rem', fontWeight: 500, marginTop: '36px', marginBottom: '14px', color: 'var(--color-text)', scrollMarginTop: '96px' }}>
            {renderInline(text, `h-${i}`)}
          </h2>
        );
      } else if (level === 3) {
        elements.push(
          <h3 key={`h-${i}`} id={anchorId} style={{ fontSize: '1.18rem', fontWeight: 600, marginTop: '26px', marginBottom: '10px', color: 'var(--color-text)', scrollMarginTop: '96px' }}>
            {renderInline(text, `h-${i}`)}
          </h3>
        );
      } else {
        elements.push(
          <h4 key={`h-${i}`} style={{ fontSize: '1.02rem', fontWeight: 600, marginTop: '20px', marginBottom: '8px', color: 'var(--color-text)' }}>
            {renderInline(text, `h-${i}`)}
          </h4>
        );
      }
      i += 1;
      continue;
    }

    // 独立图片行
    const imgMatch = trimmed.match(/^!\[([^\]]*)\]\(([^)]+)\)$/);
    if (imgMatch) {
      const safeSrc = sanitizeUrl(imgMatch[2]);
      if (safeSrc) {
        elements.push(
          <figure key={`img-${i}`} style={{ margin: '24px 0' }}>
            <img src={safeSrc} alt={imgMatch[1]} style={{ maxWidth: '100%', borderRadius: '10px', border: '1px solid rgba(18,18,18,0.08)' }} />
            {imgMatch[1] && <figcaption style={{ fontSize: '0.82rem', color: 'var(--color-muted)', marginTop: '6px' }}>{imgMatch[1]}</figcaption>}
          </figure>
        );
      }
      i += 1;
      continue;
    }

    // GFM 表格
    if (trimmed.includes('|') && i + 1 < lines.length && /^\s*\|?\s*:?-{3,}/.test(lines[i + 1])) {
      const headers = parseTableRow(trimmed);
      i += 2;
      const rows: string[][] = [];
      while (i < lines.length && lines[i].trim().includes('|')) {
        rows.push(parseTableRow(lines[i]));
        i += 1;
      }
      elements.push(
        <div key={`tbl-${i}`} style={{ overflowX: 'auto', margin: '20px 0' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.92rem' }}>
            <thead>
              <tr style={{ background: 'rgba(18, 18, 18, 0.04)' }}>
                {headers.map((h, hIdx) => (
                  <th key={hIdx} style={{ textAlign: 'left', padding: '10px 14px', borderBottom: '1px solid rgba(18,18,18,0.12)', fontWeight: 600 }}>
                    {renderInline(h, `th-${i}-${hIdx}`)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((r, rIdx) => (
                <tr key={rIdx} style={{ borderBottom: '1px solid rgba(18,18,18,0.06)' }}>
                  {headers.map((_, cIdx) => (
                    <td key={cIdx} style={{ padding: '10px 14px', color: 'var(--color-text)', lineHeight: 1.6 }}>
                      {renderInline(r[cIdx] || '', `td-${i}-${rIdx}-${cIdx}`)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
      continue;
    }

    // 引用块
    if (trimmed.startsWith('>')) {
      const quoteLines: string[] = [];
      while (i < lines.length && lines[i].trim().startsWith('>')) {
        quoteLines.push(lines[i].trim().replace(/^>\s?/, ''));
        i += 1;
      }
      elements.push(
        <blockquote
          key={`bq-${i}`}
          style={{
            margin: '18px 0',
            padding: '14px 18px',
            borderLeft: '3px solid var(--color-accent, #ff641e)',
            background: 'rgba(255, 100, 30, 0.04)',
            borderRadius: '0 8px 8px 0',
            color: 'var(--color-text)',
            lineHeight: 1.75,
          }}
        >
          {quoteLines.map((ql, qIdx) => (
            <p key={qIdx} style={{ margin: qIdx === 0 ? 0 : '8px 0 0 0' }}>
              {renderInline(ql, `bq-${i}-${qIdx}`)}
            </p>
          ))}
        </blockquote>
      );
      continue;
    }

    // 无序列表
    if (/^[-*+]\s+/.test(trimmed)) {
      const items: string[] = [];
      while (i < lines.length && /^\s*[-*+]\s+/.test(lines[i])) {
        items.push(lines[i].trim().replace(/^[-*+]\s+/, ''));
        i += 1;
      }
      elements.push(
        <ul key={`ul-${i}`} style={{ paddingLeft: '22px', margin: '14px 0', lineHeight: 1.8 }}>
          {items.map((item, idx) => (
            <li key={idx} style={{ marginBottom: '6px' }}>{renderInline(item, `ul-${i}-${idx}`)}</li>
          ))}
        </ul>
      );
      continue;
    }

    // 有序列表
    if (/^\d+\.\s+/.test(trimmed)) {
      const items: string[] = [];
      while (i < lines.length && /^\s*\d+\.\s+/.test(lines[i])) {
        items.push(lines[i].trim().replace(/^\d+\.\s+/, ''));
        i += 1;
      }
      elements.push(
        <ol key={`ol-${i}`} style={{ paddingLeft: '22px', margin: '14px 0', lineHeight: 1.8 }}>
          {items.map((item, idx) => (
            <li key={idx} style={{ marginBottom: '6px' }}>{renderInline(item, `ol-${i}-${idx}`)}</li>
          ))}
        </ol>
      );
      continue;
    }

    // 普通段落
    const paraLines: string[] = [];
    while (
      i < lines.length &&
      lines[i].trim() &&
      !/^(#{1,4}\s|[-*+]\s|\d+\.\s|>|[-*_]{3,}$|!\[)/.test(lines[i].trim())
    ) {
      paraLines.push(lines[i].trim());
      i += 1;
    }
    elements.push(
      <p key={`p-${i}`} style={{ margin: '14px 0', lineHeight: 1.85, fontSize: '1rem', color: 'var(--color-text)' }}>
        {renderInline(paraLines.join(' '), `p-${i}`)}
      </p>
    );
  }

  return <div className="wiki-markdown-body">{elements}</div>;
}
```

- [ ] **步骤 4：实现 `components/wiki/JsonLdScript.tsx`**

```tsx
import React from 'react';

/**
 * 序列化 Schema.org JSON-LD 对象并转义 `<`，防止 </script> 注入
 */
export function serializeJsonLd(data: Record<string, unknown>): string {
  return JSON.stringify(data).replace(/</g, '\\u003c');
}

interface JsonLdScriptProps {
  data: Record<string, unknown>;
}

/**
 * 仅用于在 Next.js <Head> 中输出合法的 application/ld+json 结构化数据
 */
export default function JsonLdScript({ data }: JsonLdScriptProps) {
  return (
    <script
      type="application/ld+json"
      // NOTE: React 18 对 <script> 文本子节点会转义双引号为 &quot; 导致 JSON-LD 失效，
      // 此处严格仅序列化静态 Schema.org JSON 对象并转义 `<`，绝不接收任意 HTML 字符串。
      dangerouslySetInnerHTML={{ __html: serializeJsonLd(data) }}
    />
  );
}
```

- [ ] **步骤 5：运行测试验证通过并提交**

运行：`npx vitest run tests/wiki-markdown.test.ts`
预期：PASS（4/4 通过）

```bash
git add components/wiki/SafeMarkdown.tsx components/wiki/JsonLdScript.tsx tests/wiki-markdown.test.ts
git commit -m "feat(wiki): 实现纯React安全Markdown渲染器与JSON-LD转义封装"
```

---

### 任务 6：交互式数据可视化组件（价格瀑布、分层流通图谱、大厅卡片）

**文件：**
- 创建：`components/wiki/WikiPriceWaterfall.tsx`
- 创建：`components/wiki/WikiFlowMap.tsx`
- 创建：`components/wiki/WikiEntryCard.tsx`

- [ ] **步骤 1：实现 `components/wiki/WikiPriceWaterfall.tsx`**

包含两层互补输出：上方为 `recharts` 交互式价格阶梯柱状图（客户端挂载后平滑渲染，避免 SSR 尺寸告警），下方为**始终 SSR 直出的语义化 HTML `<table>` 价格加价明细表**（兼顾桌面速查与 AI 爬虫无 JS 直读）：

```tsx
import React, { useEffect, useState } from 'react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Cell, CartesianGrid } from 'recharts';
import { WikiPriceStage } from '../../lib/wiki-schema';

interface WikiPriceWaterfallProps {
  stages: WikiPriceStage[];
  currency: string;
}

const BAR_COLORS = ['#64748b', '#0ea5e9', '#f59e0b', '#ff641e', '#dc2626'];

export default function WikiPriceWaterfall({ stages, currency }: WikiPriceWaterfallProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!stages || stages.length === 0) return null;

  const basePrice = stages[0].price_usd_equiv || 1;
  const chartData = stages.map((stage, idx) => {
    const prev = idx > 0 ? stages[idx - 1].price_usd_equiv : 0;
    const delta = idx > 0 ? Number((stage.price_usd_equiv - prev).toFixed(2)) : stage.price_usd_equiv;
    const ratio = Number((stage.price_usd_equiv / basePrice).toFixed(1));
    return {
      ...stage,
      delta,
      ratio,
      color: BAR_COLORS[Math.min(idx, BAR_COLORS.length - 1)],
    };
  });

  return (
    <section aria-labelledby="price-waterfall-heading" style={{ marginBottom: '40px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', flexWrap: 'wrap', gap: '8px', marginBottom: '16px' }}>
        <h2 id="price-waterfall-heading" className="font-editorial" style={{ fontSize: '1.55rem', fontWeight: 500, margin: 0 }}>
          价格瀑布与各环节加价拆解
        </h2>
        <span style={{ fontSize: '0.84rem', color: 'var(--color-muted)' }}>
          统一折算 USD 对比（目标国结算币种：{currency}）
        </span>
      </div>

      <div style={{
        background: 'rgba(255, 255, 255, 0.72)',
        border: '1px solid rgba(18, 18, 18, 0.08)',
        borderRadius: '14px',
        padding: '20px',
      }}>
        {mounted && (
          <div style={{ width: '100%', height: '280px', marginBottom: '18px' }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 12, right: 16, left: 0, bottom: 8 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(18,18,18,0.06)" />
                <XAxis dataKey="stage_name" tick={{ fontSize: 12, fill: '#475569' }} />
                <YAxis tickFormatter={(v) => `$${v}`} tick={{ fontSize: 12, fill: '#475569' }} />
                <Tooltip
                  formatter={(value: any) => [`$${value}`, '美元等值参考价']}
                  contentStyle={{ borderRadius: '8px', border: '1px solid rgba(18,18,18,0.1)' }}
                />
                <Bar dataKey="price_usd_equiv" radius={[6, 6, 0, 0]} maxBarSize={64}>
                  {chartData.map((entry, idx) => (
                    <Cell key={`cell-${idx}`} fill={entry.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* SSR 语义化明细表：确保 AI 爬虫与移动端零 JS 均可直读全量价格数据 */}
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' }}>
            <thead>
              <tr style={{ background: 'rgba(18, 18, 18, 0.04)' }}>
                <th style={{ textAlign: 'left', padding: '10px 12px' }}>流通阶段</th>
                <th style={{ textAlign: 'right', padding: '10px 12px' }}>美元等值价 (USD)</th>
                <th style={{ textAlign: 'right', padding: '10px 12px' }}>较 FOB 倍率</th>
                <th style={{ textAlign: 'left', padding: '10px 12px' }}>成本与加价说明</th>
              </tr>
            </thead>
            <tbody>
              {chartData.map((item, idx) => (
                <tr key={idx} style={{ borderTop: '1px solid rgba(18, 18, 18, 0.06)' }}>
                  <td style={{ padding: '10px 12px', fontWeight: 500 }}>{item.stage_name}</td>
                  <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 600, color: item.color }}>
                    ${item.price_usd_equiv}
                  </td>
                  <td style={{ padding: '10px 12px', textAlign: 'right', color: 'var(--color-muted)' }}>
                    {item.ratio}x
                  </td>
                  <td style={{ padding: '10px 12px', color: 'var(--color-muted)' }}>{item.markup_desc}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
```

- [ ] **步骤 2：实现 `components/wiki/WikiFlowMap.tsx`**

按 `tier`（1 → 4）分层呈现渠道分流、典型毛利区间、纯白圆角 Logo 墙（图片失败自动回退品牌首字母 Monogram）、点击切换痛点与谈单话术，并在玩家卡片上渲染站内 `reports` 链接和 `crm_contacts` 聚合计数徽章：

```tsx
import React, { useState } from 'react';
import Link from 'next/link';
import { WikiFlowNode, WikiPlayer } from '../../lib/wiki-schema';
import { PlayerAssetMatch } from '../../lib/wiki-service';
import { extractRootDomain, cleanCompanyNameForLookup } from '../../lib/crm-service';

interface WikiFlowMapProps {
  nodes: WikiFlowNode[];
  playerMatches: Record<string, PlayerAssetMatch>;
  onRequestCustomReport?: () => void;
}

function PlayerLogoBadge({ player }: { player: WikiPlayer }) {
  const [imgFailed, setImgFailed] = useState(false);
  const logoSrc = player.logo_url || null;
  const initials = (player.name || '?')
    .split(/\s+/)
    .slice(0, 2)
    .map(w => w[0]?.toUpperCase() || '')
    .join('')
    .slice(0, 2) || 'MG';

  return (
    <div style={{
      width: '44px',
      height: '44px',
      minWidth: '44px',
      borderRadius: '10px',
      background: '#ffffff',
      border: '1px solid rgba(18, 18, 18, 0.08)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      overflow: 'hidden',
      padding: '4px',
    }}>
      {logoSrc && !imgFailed ? (
        <img
          src={logoSrc}
          alt={`${player.name} logo`}
          onError={() => setImgFailed(true)}
          style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }}
        />
      ) : (
        <span style={{ fontWeight: 700, fontSize: '0.85rem', color: '#334155', letterSpacing: '0.5px' }}>
          {initials}
        </span>
      )}
    </div>
  );
}

export default function WikiFlowMap({ nodes, playerMatches, onRequestCustomReport }: WikiFlowMapProps) {
  const [activeNodeId, setActiveNodeId] = useState<string>(nodes[0]?.id || '');

  if (!nodes || nodes.length === 0) return null;

  const tiers = [1, 2, 3, 4].filter(t => nodes.some(n => n.tier === t));

  const getPlayerMatch = (player: WikiPlayer): PlayerAssetMatch | undefined => {
    const domain = extractRootDomain(player.website);
    const clean = cleanCompanyNameForLookup(player.name);
    return playerMatches[domain] || playerMatches[clean];
  };

  return (
    <section aria-labelledby="flow-map-heading" style={{ marginBottom: '44px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', flexWrap: 'wrap', gap: '8px', marginBottom: '16px' }}>
        <h2 id="flow-map-heading" className="font-editorial" style={{ fontSize: '1.55rem', fontWeight: 500, margin: 0 }}>
          全链路渠道流通图谱与真实买家名录
        </h2>
        <span style={{ fontSize: '0.84rem', color: 'var(--color-muted)' }}>
          点击任意渠道层级查看买家痛点与谈单切入话术
        </span>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
        {tiers.map((tier) => {
          const tierNodes = nodes.filter(n => n.tier === tier);
          return (
            <div key={tier} style={{
              background: 'rgba(255, 255, 255, 0.72)',
              border: '1px solid rgba(18, 18, 18, 0.08)',
              borderRadius: '14px',
              padding: '18px 20px',
            }}>
              <div style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--color-accent, #ff641e)', letterSpacing: '1px', textTransform: 'uppercase', marginBottom: '12px' }}>
                TIER {tier} 流通层级
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(290px, 1fr))', gap: '16px' }}>
                {tierNodes.map((node) => {
                  const isActive = activeNodeId === node.id;
                  return (
                    <article
                      key={node.id}
                      onClick={() => setActiveNodeId(node.id)}
                      style={{
                        cursor: 'pointer',
                        background: isActive ? 'rgba(255, 100, 30, 0.04)' : '#ffffff',
                        border: isActive ? '1.5px solid var(--color-accent, #ff641e)' : '1px solid rgba(18, 18, 18, 0.08)',
                        borderRadius: '12px',
                        padding: '16px',
                        transition: 'all 0.2s ease',
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
                        <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 600 }}>{node.label_cn}</h3>
                        <span style={{
                          fontSize: '0.78rem',
                          fontWeight: 600,
                          padding: '3px 9px',
                          borderRadius: '999px',
                          background: 'rgba(18, 18, 18, 0.06)',
                        }}>
                          占比 {node.share_pct}% · 毛利 {node.typical_margin_range}
                        </span>
                      </div>

                      {/* 买家痛点与谈单建议始终存在于 SSR DOM 中，兼顾可读性与 GEO 爬虫抓取 */}
                      <div style={{ marginBottom: '12px', fontSize: '0.86rem', lineHeight: 1.65 }}>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '8px' }}>
                          {node.buyer_pain_points.map((pt, idx) => (
                            <span key={idx} style={{
                              background: 'rgba(239, 68, 68, 0.08)',
                              color: '#b91c1c',
                              padding: '2px 8px',
                              borderRadius: '6px',
                              fontSize: '0.78rem',
                            }}>
                              痛点：{pt}
                            </span>
                          ))}
                        </div>
                        <p style={{ margin: 0, color: '#334155' }}>
                          <strong>谈单切入：</strong>{node.sales_pitch_angle}
                        </p>
                      </div>

                      {/* 真实企业玩家 Logo 墙 + 站内研报与采购联系人转化入口 */}
                      {node.players.length > 0 && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', borderTop: '1px solid rgba(18,18,18,0.06)', paddingTop: '12px' }}>
                          {node.players.map((player, pIdx) => {
                            const matched = getPlayerMatch(player);
                            const safeDomain = extractRootDomain(player.website) || player.website;
                            return (
                              <div key={pIdx} style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
                                <PlayerLogoBadge player={player} />
                                <div style={{ flex: 1, minWidth: 0 }}>
                                  <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '6px' }}>
                                    <span style={{ fontWeight: 600, fontSize: '0.92rem' }}>{player.name}</span>
                                    <a
                                      href={`https://${safeDomain}`}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      onClick={(e) => e.stopPropagation()}
                                      style={{ fontSize: '0.78rem', color: 'var(--color-muted)', textDecoration: 'underline' }}
                                    >
                                      {safeDomain}
                                    </a>
                                  </div>
                                  <div style={{ fontSize: '0.8rem', color: 'var(--color-muted)', marginTop: '2px' }}>
                                    {player.business_model}
                                  </div>
                                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '6px' }}>
                                    {matched?.reportId && (
                                      <Link
                                        href={`/reports/${matched.reportId}`}
                                        onClick={(e) => e.stopPropagation()}
                                        style={{
                                          fontSize: '0.74rem',
                                          fontWeight: 600,
                                          color: '#ff641e',
                                          background: 'rgba(255, 100, 30, 0.1)',
                                          border: '1px solid rgba(255, 100, 30, 0.25)',
                                          padding: '2px 8px',
                                          borderRadius: '6px',
                                          textDecoration: 'none',
                                        }}
                                      >
                                        查看 360° 客户研报 →
                                      </Link>
                                    )}
                                    {matched && matched.contactCount > 0 && (
                                      matched.reportId ? (
                                        <Link
                                          href={`/reports/${matched.reportId}`}
                                          onClick={(e) => e.stopPropagation()}
                                          style={{
                                            fontSize: '0.74rem',
                                            fontWeight: 600,
                                            color: '#2563eb',
                                            background: 'rgba(37, 99, 235, 0.08)',
                                            border: '1px solid rgba(37, 99, 235, 0.2)',
                                            padding: '2px 8px',
                                            borderRadius: '6px',
                                            textDecoration: 'none',
                                          }}
                                        >
                                          已收录 {matched.contactCount} 位采购联系人
                                        </Link>
                                      ) : (
                                        <button
                                          type="button"
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            onRequestCustomReport?.();
                                          }}
                                          style={{
                                            fontSize: '0.74rem',
                                            fontWeight: 600,
                                            color: '#2563eb',
                                            background: 'rgba(37, 99, 235, 0.08)',
                                            border: '1px solid rgba(37, 99, 235, 0.2)',
                                            padding: '2px 8px',
                                            borderRadius: '6px',
                                            cursor: 'pointer',
                                          }}
                                        >
                                          已收录 {matched.contactCount} 位采购联系人 · 申请研报解锁
                                        </button>
                                      )
                                    )}
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </article>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
```

- [ ] **步骤 3：实现 `components/wiki/WikiEntryCard.tsx`**

```tsx
import React from 'react';
import Link from 'next/link';
import { ARCHETYPE_META, ArchetypeId } from '../../lib/wiki-schema';

export interface WikiListItem {
  id: string;
  slug: string;
  title: string;
  summary: string;
  country_code: string;
  country_name: string;
  market_region: string;
  industry_name: string;
  hs_code_6?: string | null;
  archetype_id: ArchetypeId;
  price_multiplier: string;
  player_count: number;
  view_count: number;
  updated_at: string;
}

export default function WikiEntryCard({ item }: { item: WikiListItem }) {
  const archetype = ARCHETYPE_META[item.archetype_id] || { nameCn: item.archetype_id, shortTag: '流通图谱', accent: '#ff641e' };

  return (
    <Link href={`/wiki/${item.slug}`} style={{ textDecoration: 'none', color: 'inherit', display: 'block' }}>
      <article
        style={{
          background: 'rgba(255, 255, 255, 0.78)',
          border: '1px solid rgba(18, 18, 18, 0.08)',
          borderRadius: '14px',
          padding: '22px',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          transition: 'transform 0.2s ease, box-shadow 0.2s ease',
          boxSizing: 'border-box',
        }}
      >
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', alignItems: 'center', marginBottom: '12px' }}>
          <span style={{ fontSize: '0.75rem', fontWeight: 600, padding: '3px 9px', borderRadius: '6px', background: 'rgba(18,18,18,0.06)' }}>
            {item.country_name} · {item.industry_name}
          </span>
          <span style={{
            fontSize: '0.74rem',
            fontWeight: 600,
            padding: '3px 9px',
            borderRadius: '6px',
            color: archetype.accent,
            background: `${archetype.accent}14`,
          }}>
            {archetype.shortTag}
          </span>
          {item.hs_code_6 && (
            <span style={{ fontSize: '0.74rem', color: 'var(--color-muted)', marginLeft: 'auto' }}>
              HS {item.hs_code_6}
            </span>
          )}
        </div>

        <h2 className="font-editorial" style={{ fontSize: '1.22rem', fontWeight: 500, margin: '0 0 10px 0', lineHeight: 1.4 }}>
          {item.title}
        </h2>

        <p style={{ margin: '0 0 18px 0', fontSize: '0.9rem', color: 'var(--color-muted)', lineHeight: 1.65, flex: 1 }}>
          {item.summary}
        </p>

        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          paddingTop: '12px',
          borderTop: '1px solid rgba(18, 18, 18, 0.06)',
          fontSize: '0.82rem',
          color: 'var(--color-muted)',
        }}>
          <span>
            价差倍率 <strong style={{ color: 'var(--color-accent, #ff641e)' }}>{item.price_multiplier}</strong> · 玩家 <strong>{item.player_count}</strong> 家
          </span>
          <span style={{ color: 'var(--color-accent, #ff641e)', fontWeight: 500 }}>免费阅读 →</span>
        </div>
      </article>
    </Link>
  );
}
```

- [ ] **步骤 4：提交前端可视化组件**

```bash
git add components/wiki/WikiPriceWaterfall.tsx components/wiki/WikiFlowMap.tsx components/wiki/WikiEntryCard.tsx
git commit -m "feat(wiki): 实现价格瀑布、分层流通图谱与百科大厅卡片组件"
```

---

### 任务 7：前台「行业百科」大厅页与详情页（公开 SSR + GEO）

**文件：**
- 创建：`pages/wiki/index.tsx`
- 创建：`pages/wiki/[slug].tsx`
- 测试：`tests/wiki-geo-ssr.test.ts`

- [ ] **步骤 1：编写失败的 SSR & GEO 验证测试**

创建 `tests/wiki-geo-ssr.test.ts`：

```ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { Client } from 'pg';
import { createTestClient, cleanDatabase } from './helpers/db-test-helper';
import { upsertWikiEntry } from '../lib/wiki-service';
import { buildSampleFlowData } from './wiki-schema.test';
import WikiDetailPage, { getServerSideProps as getDetailSsp } from '../pages/wiki/[slug]';

describe('行业百科详情页 SSR 与 GEO 输出测试', () => {
  let client: Client;

  beforeAll(async () => {
    client = createTestClient();
    await client.connect();
    await cleanDatabase(client);

    await upsertWikiEntry(client, {
      slug: 'geo-test-de-lighting',
      title: '德国照明产品海外流通全景',
      summary: '拆解德国LED照明从中国FOB到DIY与专业批发终端的加价阶梯。',
      flow_data: buildSampleFlowData(),
      content_md: '## 合规准入红线\n必须完成 EPREL 能效注册。',
      status: 'published',
    });

    await upsertWikiEntry(client, {
      slug: 'geo-test-draft-item',
      title: '草稿词条不可公开',
      summary: '草稿摘要',
      flow_data: buildSampleFlowData(),
      content_md: '草稿内容',
      status: 'draft',
    });
  });

  afterAll(async () => {
    await client.query(`DELETE FROM wiki_entries WHERE slug LIKE 'geo-test-%'`).catch(() => {});
    await client.end();
  });

  it('草稿词条访问详情页 getServerSideProps 应返回 notFound: true', async () => {
    const res = await getDetailSsp({ params: { slug: 'geo-test-draft-item' }, req: { headers: {} } } as any);
    expect((res as any).notFound).toBe(true);
  });

  it('已发布词条 SSR 应返回完整结构化数据并渲染出价格明细表与FAQ', async () => {
    const res = await getDetailSsp({ params: { slug: 'geo-test-de-lighting' }, req: { headers: {} } } as any);
    expect((res as any).props).toBeDefined();
    const html = renderToStaticMarkup(React.createElement(WikiDetailPage, (res as any).props));

    expect(html).toContain('德国照明产品海外流通全景');
    expect(html).toContain('中国 FOB 出厂价');
    expect(html).toContain('$42.9');
    expect(html).toContain('Sonepar Deutschland');
    expect(html).toContain('必须完成 EPREL 能效注册');
    expect(html).toContain('常见问题');
  });
});
```

- [ ] **步骤 2：运行测试验证失败**

运行：`npx vitest run tests/wiki-geo-ssr.test.ts`
预期：FAIL，报错找不到 `../pages/wiki/[slug]`

- [ ] **步骤 3：实现 `pages/wiki/index.tsx`（行业百科大厅）**

完整公开 SSR 页面：顶部与 `pages/reports/index.tsx`、`pages/news/index.tsx` 保持一致视觉规范，支持关键词、市场大区、54 标准品类、5 大流通原型筛选及触底无限加载（初始 20 条、每次追加 12 条），并注入 `CollectionPage` + `BreadcrumbList` JSON-LD：

```tsx
import React, { useState, useEffect, useRef } from 'react';
import { GetServerSideProps } from 'next';
import Head from 'next/head';
import pool from '../../lib/db';
import { resolveSsrAuth } from '../../lib/ssr-auth';
import { STANDARD_CATEGORIES } from '../../lib/category-mapper';
import { isNodeInRegion } from '../../lib/region-country-mapper';
import { ARCHETYPE_META, ArchetypeId, calcPriceMultiplier, MarketFlowData } from '../../lib/wiki-schema';
import Navbar from '../../components/Navbar';
import Footer from '../../components/Footer';
import AuthModal from '../../components/AuthModal';
import WikiEntryCard, { WikiListItem } from '../../components/wiki/WikiEntryCard';
import JsonLdScript from '../../components/wiki/JsonLdScript';

interface WikiIndexPageProps {
  entries: WikiListItem[];
  userId: string | null;
  userRole: string;
  quota: number;
  nickname: string;
}

const REGIONS = ['All', '欧洲', '北美洲', '亚洲', '东南亚', '中东', '南美洲', '大洋洲', '非洲'];

export default function WikiIndexPage({ entries, userId, userRole, quota, nickname }: WikiIndexPageProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedRegion, setSelectedRegion] = useState('All');
  const [selectedIndustry, setSelectedIndustry] = useState('All');
  const [selectedArchetype, setSelectedArchetype] = useState<string>('All');
  const [showAuthModal, setShowAuthModal] = useState(false);

  const INITIAL_COUNT = 20;
  const STEP_COUNT = 12;
  const [visibleCount, setVisibleCount] = useState(INITIAL_COUNT);
  const observerRef = useRef<HTMLDivElement | null>(null);

  const filtered = entries.filter((item) => {
    const q = searchQuery.trim().toLowerCase();
    const matchQuery = !q ||
      item.title.toLowerCase().includes(q) ||
      item.summary.toLowerCase().includes(q) ||
      item.country_name.toLowerCase().includes(q) ||
      item.industry_name.toLowerCase().includes(q) ||
      (item.hs_code_6 || '').includes(q);
    const matchRegion = selectedRegion === 'All' || isNodeInRegion(item.market_region, selectedRegion) || isNodeInRegion(item.country_name, selectedRegion);
    const matchIndustry = selectedIndustry === 'All' || item.industry_name === selectedIndustry;
    const matchArchetype = selectedArchetype === 'All' || item.archetype_id === selectedArchetype;
    return matchQuery && matchRegion && matchIndustry && matchArchetype;
  });

  useEffect(() => {
    setVisibleCount(INITIAL_COUNT);
  }, [searchQuery, selectedRegion, selectedIndustry, selectedArchetype]);

  useEffect(() => {
    if (visibleCount >= filtered.length) return;
    const target = observerRef.current;
    if (!target || typeof IntersectionObserver === 'undefined') return;
    const observer = new IntersectionObserver(
      (obsEntries) => {
        if (obsEntries[0].isIntersecting) {
          setVisibleCount(prev => Math.min(prev + STEP_COUNT, filtered.length));
        }
      },
      { rootMargin: '300px 0px' }
    );
    observer.observe(target);
    return () => observer.disconnect();
  }, [visibleCount, filtered.length]);

  const displayed = filtered.slice(0, visibleCount);

  return (
    <div style={{ background: 'transparent', color: 'var(--color-text)', minHeight: '100vh', position: 'relative' }}>
      <Head>
        <title>全球出海行业百科 | 海外渠道流通图谱与利润拆解 - Market Graphic (外贸智友)</title>
        <meta name="description" content="完全免费开放的外贸行业百科：覆盖 54 个出口大类与主要海外市场，深度拆解从中国 FOB 到海外终端的渠道流通链路、各环节加价毛利、真实买手名录与强制合规认证。" />
        <meta name="robots" content="index, follow" />
        <link rel="canonical" href="https://marketgraphic.cn/wiki" />
        <JsonLdScript
          data={{
            '@context': 'https://schema.org',
            '@type': 'CollectionPage',
            name: 'Market Graphic 行业百科',
            url: 'https://marketgraphic.cn/wiki',
            description: '全球主要市场与 54 个出口品类的海外流通图谱、价格加价阶梯与渠道买家实战知识库。',
          }}
        />
      </Head>

      <div className="ambient-glow-container">
        <div className="ambient-light ambient-light-1" />
      </div>

      <Navbar
        userId={userId}
        userRole={userRole}
        quota={quota}
        nickname={nickname}
        onShowAuthModal={() => setShowAuthModal(true)}
      />

      <main className="responsive-page-container">
        <header style={{ marginBottom: '36px' }}>
          <span style={{ color: 'var(--color-accent)', fontSize: '0.85rem', letterSpacing: '2px', textTransform: 'uppercase', fontWeight: 600 }}>
            Industry Wiki · Open Access
          </span>
          <h1 className="font-editorial" style={{ fontSize: '2.8rem', margin: '8px 0 0 0', fontWeight: 400 }}>
            行业百科
          </h1>
          <p style={{ color: 'var(--color-muted)', fontSize: '1rem', fontWeight: 300, marginTop: '8px', maxWidth: '760px', lineHeight: 1.7 }}>
            完全免费开放的海外市场流通图谱知识库——看懂每个「国家 × 品类」的供给格局、价格加价瀑布、真实渠道玩家与合规红线。
          </p>
        </header>

        {/* 多维筛选面板 */}
        <section style={{
          background: 'rgba(255, 255, 255, 0.55)',
          backdropFilter: 'blur(15px)',
          border: '1px solid rgba(18, 18, 18, 0.06)',
          padding: '18px 22px',
          borderRadius: '14px',
          marginBottom: '32px',
        }}>
          <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'center', marginBottom: '14px' }}>
            <input
              type="text"
              placeholder="搜索国家、品类、HS编码或关键词..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                flex: 1,
                minWidth: '240px',
                padding: '11px 14px',
                borderRadius: '8px',
                border: '1px solid rgba(18, 18, 18, 0.1)',
                background: '#ffffff',
                fontSize: '0.9rem',
              }}
            />
            <select
              value={selectedRegion}
              onChange={(e) => setSelectedRegion(e.target.value)}
              style={{ padding: '10px 12px', borderRadius: '8px', border: '1px solid rgba(18,18,18,0.1)', background: '#ffffff' }}
            >
              <option value="All">全部市场大区</option>
              {REGIONS.filter(r => r !== 'All').map(r => <option key={r} value={r}>{r}</option>)}
            </select>
            <select
              value={selectedIndustry}
              onChange={(e) => setSelectedIndustry(e.target.value)}
              style={{ padding: '10px 12px', borderRadius: '8px', border: '1px solid rgba(18,18,18,0.1)', background: '#ffffff', maxWidth: '220px' }}
            >
              <option value="All">全部 54 标准品类</option>
              {STANDARD_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>

          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            <button
              type="button"
              onClick={() => setSelectedArchetype('All')}
              style={{
                padding: '6px 12px',
                borderRadius: '999px',
                border: '1px solid rgba(18,18,18,0.1)',
                background: selectedArchetype === 'All' ? 'var(--color-accent, #ff641e)' : '#ffffff',
                color: selectedArchetype === 'All' ? '#ffffff' : 'var(--color-text)',
                fontSize: '0.82rem',
                cursor: 'pointer',
              }}
            >
              全部流通原型
            </button>
            {(Object.keys(ARCHETYPE_META) as ArchetypeId[]).map((archId) => (
              <button
                key={archId}
                type="button"
                onClick={() => setSelectedArchetype(archId)}
                style={{
                  padding: '6px 12px',
                  borderRadius: '999px',
                  border: '1px solid rgba(18,18,18,0.1)',
                  background: selectedArchetype === archId ? ARCHETYPE_META[archId].accent : '#ffffff',
                  color: selectedArchetype === archId ? '#ffffff' : 'var(--color-text)',
                  fontSize: '0.82rem',
                  cursor: 'pointer',
                }}
              >
                {ARCHETYPE_META[archId].shortTag}
              </button>
            ))}
          </div>
        </section>

        {displayed.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '72px 20px', color: 'var(--color-muted)' }}>
            暂无匹配的行业百科词条，换个国家或品类试试。
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '20px' }}>
            {displayed.map(item => <WikiEntryCard key={item.id} item={item} />)}
          </div>
        )}

        {visibleCount < filtered.length && <div ref={observerRef} style={{ height: '40px' }} />}
      </main>

      <Footer />
      <AuthModal isOpen={showAuthModal} onClose={() => setShowAuthModal(false)} />
    </div>
  );
}

export const getServerSideProps: GetServerSideProps = async (context) => {
  let dbClient: any = null;
  try {
    dbClient = await pool.connect();
    const auth = await resolveSsrAuth(context, dbClient);
    const res = await dbClient.query(
      `SELECT id, slug, title, summary, country_code, country_name, market_region,
              industry_name, hs_code_6, archetype_id, flow_data, view_count, updated_at
       FROM wiki_entries
       WHERE status = 'published'
       ORDER BY published_at DESC NULLS LAST, updated_at DESC`
    );

    const entries: WikiListItem[] = res.rows.map((row: any) => {
      const flow = row.flow_data as MarketFlowData;
      const playerCount = (flow?.flow_nodes || []).reduce((acc, n) => acc + (n.players?.length || 0), 0);
      return {
        id: row.id,
        slug: row.slug,
        title: row.title,
        summary: row.summary,
        country_code: row.country_code,
        country_name: row.country_name,
        market_region: row.market_region,
        industry_name: row.industry_name,
        hs_code_6: row.hs_code_6 || null,
        archetype_id: row.archetype_id,
        price_multiplier: calcPriceMultiplier(flow),
        player_count: playerCount,
        view_count: row.view_count || 0,
        updated_at: row.updated_at ? new Date(row.updated_at).toISOString() : '',
      };
    });

    return {
      props: {
        entries,
        userId: auth.userId || null,
        userRole: auth.userRole || 'guest',
        quota: auth.freeQuota || 0,
        nickname: auth.nickname || '',
      },
    };
  } catch (err) {
    console.error('[WikiIndex] SSR 加载失败:', err);
    return {
      props: { entries: [], userId: null, userRole: 'guest', quota: 0, nickname: '' },
    };
  } finally {
    if (dbClient) dbClient.release();
  }
};
```

- [ ] **步骤 4：实现 `pages/wiki/[slug].tsx`（行业百科详情页 + 完整 GEO 结构化数据）**

创建 `pages/wiki/[slug].tsx`，涵盖：
- 完整 Schema.org JSON-LD（`Article` + `BreadcrumbList` + `FAQPage` + `Dataset`）
- 顶部 GEO 速览卡 + 可选 35 秒竖屏视频播放器（无 `video_url` 自动隐藏）
- 供给格局进度条 + Top 进口来源国生态定位
- `WikiPriceWaterfall` + `WikiFlowMap`（带站内研报与脱敏买手计数跳转）
- `SafeMarkdown` + TOC 目录 + 权威信源 + FAQ 可视化区 + 延伸深度研报推荐
- 浏览统计埋点（`POST /api/track/pageview` 传 `content_type: 'wiki'`）

```tsx
import React, { useEffect, useState } from 'react';
import { GetServerSideProps } from 'next';
import Head from 'next/head';
import Link from 'next/link';
import pool from '../../lib/db';
import { resolveSsrAuth } from '../../lib/ssr-auth';
import {
  ARCHETYPE_META,
  WikiEntryRecord,
  calcPriceMultiplier,
  generateDefaultFaqs,
} from '../../lib/wiki-schema';
import {
  matchPlayersWithPlatformAssets,
  getRelatedReportsForWiki,
  PlayerAssetMatch,
  RelatedWikiReport,
} from '../../lib/wiki-service';
import Navbar from '../../components/Navbar';
import Footer from '../../components/Footer';
import AuthModal from '../../components/AuthModal';
import FeedbackModal from '../../components/FeedbackModal';
import SafeMarkdown, { extractTocHeadings, sanitizeUrl } from '../../components/wiki/SafeMarkdown';
import JsonLdScript from '../../components/wiki/JsonLdScript';
import WikiPriceWaterfall from '../../components/wiki/WikiPriceWaterfall';
import WikiFlowMap from '../../components/wiki/WikiFlowMap';

interface WikiDetailProps {
  entry: WikiEntryRecord;
  playerMatches: Record<string, PlayerAssetMatch>;
  relatedReports: RelatedWikiReport[];
  userId: string | null;
  userRole: string;
  quota: number;
  nickname: string;
}

export default function WikiDetailPage({
  entry,
  playerMatches,
  relatedReports,
  userId,
  userRole,
  quota,
  nickname,
}: WikiDetailProps) {
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [showCustomModal, setShowCustomModal] = useState(false);

  const canonicalUrl = `https://marketgraphic.cn/wiki/${entry.slug}`;
  const markdownUrl = `${canonicalUrl}.md`;
  const archetype = ARCHETYPE_META[entry.archetype_id] || { nameCn: entry.archetype_id, shortTag: '流通图谱', accent: '#ff641e' };
  const multiplier = calcPriceMultiplier(entry.flow_data);
  const totalPlayers = (entry.flow_data.flow_nodes || []).reduce((acc, n) => acc + (n.players?.length || 0), 0);
  const tocHeadings = extractTocHeadings(entry.content_md);
  const faqs = entry.faq_items && entry.faq_items.length > 0 ? entry.faq_items : generateDefaultFaqs(entry.flow_data, entry.title);
  const updatedDate = (entry.updated_at || entry.published_at || '').slice(0, 10);

  // 页面浏览量与停留时长追踪（复用全站 pageview API）
  useEffect(() => {
    let viewId: string | null = null;
    const startTime = Date.now();

    fetch('/api/track/pageview', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content_type: 'wiki', content_id: entry.id }),
    })
      .then(res => res.json())
      .then(data => {
        if (data?.view_id) viewId = data.view_id;
      })
      .catch(() => {});

    const sendDuration = () => {
      if (!viewId) return;
      const durationSeconds = Math.round((Date.now() - startTime) / 1000);
      if (durationSeconds <= 0) return;
      fetch('/api/track/pageview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ view_id: viewId, duration_seconds: durationSeconds }),
        keepalive: true,
      }).catch(() => {});
    };

    window.addEventListener('beforeunload', sendDuration);
    return () => {
      sendDuration();
      window.removeEventListener('beforeunload', sendDuration);
    };
  }, [entry.id]);

  return (
    <div style={{ background: 'transparent', color: 'var(--color-text)', minHeight: '100vh', position: 'relative' }}>
      <Head>
        <title>{entry.title} | 行业百科 - Market Graphic (外贸智友)</title>
        <meta name="description" content={entry.summary} />
        <meta
          name="keywords"
          content={[entry.country_name, entry.industry_name, entry.hs_code_6 ? `HS ${entry.hs_code_6}` : '', '海外流通渠道', '外贸价格加价', '行业百科', 'Market Graphic'].filter(Boolean).join(', ')}
        />
        <meta name="robots" content="index, follow" />
        <link rel="canonical" href={canonicalUrl} />
        <link rel="alternate" type="text/markdown" href={markdownUrl} title={`${entry.title} (Markdown)`} />
        <meta property="og:type" content="article" />
        <meta property="og:title" content={`${entry.title} | Market Graphic 行业百科`} />
        <meta property="og:description" content={entry.summary} />
        <meta property="og:url" content={canonicalUrl} />
        <meta property="og:image" content={entry.cover_image || 'https://marketgraphic.cn/images/discover_focus_panorama.jpg'} />

        {/* GEO / SEO 多维结构化数据：Article + BreadcrumbList + FAQPage + Dataset */}
        <JsonLdScript
          data={{
            '@context': 'https://schema.org',
            '@type': 'Article',
            headline: entry.title,
            description: entry.summary,
            datePublished: entry.published_at || entry.created_at,
            dateModified: entry.updated_at,
            inLanguage: 'zh-CN',
            mainEntityOfPage: canonicalUrl,
            about: [entry.country_name, entry.industry_name, entry.hs_code_6 ? `HS ${entry.hs_code_6}` : '国际贸易'],
            publisher: {
              '@type': 'Organization',
              name: 'Market Graphic (外贸智友)',
              url: 'https://marketgraphic.cn',
            },
          }}
        />
        <JsonLdScript
          data={{
            '@context': 'https://schema.org',
            '@type': 'BreadcrumbList',
            itemListElement: [
              { '@type': 'ListItem', position: 1, name: '首页', item: 'https://marketgraphic.cn' },
              { '@type': 'ListItem', position: 2, name: '行业百科', item: 'https://marketgraphic.cn/wiki' },
              { '@type': 'ListItem', position: 3, name: entry.title, item: canonicalUrl },
            ],
          }}
        />
        <JsonLdScript
          data={{
            '@context': 'https://schema.org',
            '@type': 'FAQPage',
            mainEntity: faqs.map(item => ({
              '@type': 'Question',
              name: item.q,
              acceptedAnswer: { '@type': 'Answer', text: item.a },
            })),
          }}
        />
        <JsonLdScript
          data={{
            '@context': 'https://schema.org',
            '@type': 'Dataset',
            name: `${entry.country_name}${entry.industry_name}海外流通与价格阶梯数据集`,
            description: entry.summary,
            url: canonicalUrl,
            dateModified: entry.updated_at,
            creator: { '@type': 'Organization', name: 'Market Graphic (外贸智友)' },
            distribution: [
              { '@type': 'DataDownload', encodingFormat: 'text/markdown', contentUrl: markdownUrl },
            ],
          }}
        />
      </Head>

      <div className="ambient-glow-container">
        <div className="ambient-light ambient-light-1" />
      </div>

      <Navbar
        userId={userId}
        userRole={userRole}
        quota={quota}
        nickname={nickname}
        onShowAuthModal={() => setShowAuthModal(true)}
      />

      <main style={{ maxWidth: '1160px', margin: '0 auto', padding: '110px 24px 64px 24px', position: 'relative', zIndex: 5 }}>
        {/* 面包屑 */}
        <nav aria-label="breadcrumb" style={{ fontSize: '0.85rem', color: 'var(--color-muted)', marginBottom: '18px', display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          <Link href="/" style={{ color: 'inherit', textDecoration: 'none' }}>首页</Link>
          <span>/</span>
          <Link href="/wiki" style={{ color: 'inherit', textDecoration: 'none' }}>行业百科</Link>
          <span>/</span>
          <span style={{ color: 'var(--color-text)' }}>{entry.country_name} · {entry.industry_name}</span>
        </nav>

        {/* 标题与 GEO 速览区（含可选 35 秒竖屏短视频位） */}
        <header style={{ display: 'flex', gap: '28px', flexWrap: 'wrap', alignItems: 'flex-start', marginBottom: '36px' }}>
          <div style={{ flex: '1 1 560px', minWidth: 0 }}>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center', marginBottom: '12px' }}>
              <span style={{ fontSize: '0.78rem', fontWeight: 600, padding: '4px 10px', borderRadius: '6px', background: 'rgba(18,18,18,0.06)' }}>
                {entry.country_name} ({entry.country_code})
              </span>
              <span style={{ fontSize: '0.78rem', fontWeight: 600, padding: '4px 10px', borderRadius: '6px', background: 'rgba(18,18,18,0.06)' }}>
                {entry.industry_name}
              </span>
              {entry.hs_code_6 && (
                <span style={{ fontSize: '0.78rem', padding: '4px 10px', borderRadius: '6px', border: '1px solid rgba(18,18,18,0.1)' }}>
                  HS {entry.hs_code_6}
                </span>
              )}
              <span style={{ fontSize: '0.78rem', fontWeight: 600, padding: '4px 10px', borderRadius: '6px', color: archetype.accent, background: `${archetype.accent}14` }}>
                {archetype.nameCn}
              </span>
            </div>

            <h1 className="font-editorial" style={{ fontSize: '2.35rem', fontWeight: 400, margin: '0 0 14px 0', lineHeight: 1.28 }}>
              {entry.title}
            </h1>

            <p style={{ fontSize: '1.02rem', color: 'var(--color-muted)', lineHeight: 1.75, margin: '0 0 20px 0' }}>
              {entry.summary}
            </p>

            {/* 核心事实指标卡片（TL;DR） */}
            <dl style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
              gap: '12px',
              margin: '0 0 16px 0',
            }}>
              <div style={{ background: 'rgba(255,255,255,0.78)', border: '1px solid rgba(18,18,18,0.08)', borderRadius: '12px', padding: '14px' }}>
                <dt style={{ fontSize: '0.78rem', color: 'var(--color-muted)' }}>进口依赖度 / 本土制造</dt>
                <dd style={{ margin: '6px 0 0 0', fontSize: '1.25rem', fontWeight: 700 }}>
                  {entry.flow_data.supply_origin.import_pct}% / {entry.flow_data.supply_origin.local_manufacturing_pct}%
                </dd>
              </div>
              <div style={{ background: 'rgba(255,255,255,0.78)', border: '1px solid rgba(18,18,18,0.08)', borderRadius: '12px', padding: '14px' }}>
                <dt style={{ fontSize: '0.78rem', color: 'var(--color-muted)' }}>FOB → 终端零售倍率</dt>
                <dd style={{ margin: '6px 0 0 0', fontSize: '1.25rem', fontWeight: 700, color: 'var(--color-accent, #ff641e)' }}>
                  {multiplier}
                </dd>
              </div>
              <div style={{ background: 'rgba(255,255,255,0.78)', border: '1px solid rgba(18,18,18,0.08)', borderRadius: '12px', padding: '14px' }}>
                <dt style={{ fontSize: '0.78rem', color: 'var(--color-muted)' }}>收录真实渠道玩家</dt>
                <dd style={{ margin: '6px 0 0 0', fontSize: '1.25rem', fontWeight: 700 }}>
                  {totalPlayers} 家
                </dd>
              </div>
            </dl>

            <div style={{ fontSize: '0.82rem', color: 'var(--color-muted)', display: 'flex', gap: '16px', flexWrap: 'wrap', alignItems: 'center' }}>
              <span>更新日期：{updatedDate}</span>
              <a href={`/wiki/${entry.slug}.md`} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--color-accent)', textDecoration: 'underline' }}>
                查看机器直读 Markdown (.md)
              </a>
            </div>
          </div>

          {/* 35 秒竖屏动态图谱视频位（仅当 video_url 存在时显示） */}
          {entry.video_url && sanitizeUrl(entry.video_url) && (
            <aside style={{
              width: '240px',
              flex: '0 0 240px',
              background: '#0f172a',
              borderRadius: '16px',
              overflow: 'hidden',
              border: '1px solid rgba(18,18,18,0.12)',
              boxShadow: '0 12px 32px rgba(15, 23, 42, 0.14)',
            }}>
              <video
                src={sanitizeUrl(entry.video_url) || undefined}
                poster={entry.cover_image || undefined}
                controls
                playsInline
                preload="metadata"
                style={{ width: '100%', aspectRatio: '9 / 16', display: 'block', objectFit: 'cover' }}
              />
              <div style={{ padding: '8px 12px', color: '#cbd5e1', fontSize: '0.76rem', textAlign: 'center' }}>
                35 秒动态流通图谱速览
              </div>
            </aside>
          )}
        </header>

        {/* 一、供给源头格局 */}
        <section aria-labelledby="supply-origin-heading" style={{ marginBottom: '40px' }}>
          <h2 id="supply-origin-heading" className="font-editorial" style={{ fontSize: '1.55rem', fontWeight: 500, marginBottom: '14px' }}>
            供给源头格局（本土制造 vs 进口来源）
          </h2>
          <div style={{ background: 'rgba(255,255,255,0.72)', border: '1px solid rgba(18,18,18,0.08)', borderRadius: '14px', padding: '20px' }}>
            <div style={{ display: 'flex', height: '16px', borderRadius: '999px', overflow: 'hidden', marginBottom: '12px', background: '#e2e8f0' }}>
              <div style={{ width: `${entry.flow_data.supply_origin.local_manufacturing_pct}%`, background: '#334155' }} />
              <div style={{ width: `${entry.flow_data.supply_origin.import_pct}%`, background: 'var(--color-accent, #ff641e)' }} />
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.86rem', marginBottom: '18px' }}>
              <span>本土制造：<strong>{entry.flow_data.supply_origin.local_manufacturing_pct}%</strong></span>
              <span>海外进口：<strong style={{ color: 'var(--color-accent, #ff641e)' }}>{entry.flow_data.supply_origin.import_pct}%</strong></span>
            </div>

            {entry.flow_data.supply_origin.top_import_sources?.length > 0 && (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: '12px' }}>
                {entry.flow_data.supply_origin.top_import_sources.map((src, idx) => (
                  <div key={idx} style={{ background: '#ffffff', border: '1px solid rgba(18,18,18,0.08)', borderRadius: '10px', padding: '12px 14px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 600, marginBottom: '4px' }}>
                      <span>{src.country_name_cn}</span>
                      <span style={{ color: 'var(--color-accent)' }}>{src.share_pct}%</span>
                    </div>
                    <div style={{ fontSize: '0.84rem', color: 'var(--color-muted)' }}>{src.positioning}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>

        {/* 二、价格瀑布图 + 语义化明细表 */}
        <WikiPriceWaterfall stages={entry.flow_data.price_waterfall} currency={entry.flow_data.meta.currency} />

        {/* 三、分层渠道流通图谱 + 玩家站内资产联动 */}
        <WikiFlowMap
          nodes={entry.flow_data.flow_nodes}
          playerMatches={playerMatches}
          onRequestCustomReport={() => setShowCustomModal(true)}
        />

        {/* 四、深度图文实战解析 + 章节目录 */}
        <section style={{ display: 'flex', gap: '28px', alignItems: 'flex-start', flexWrap: 'wrap', marginBottom: '48px' }}>
          <article style={{
            flex: '1 1 680px',
            minWidth: 0,
            background: 'rgba(255,255,255,0.82)',
            border: '1px solid rgba(18,18,18,0.08)',
            borderRadius: '16px',
            padding: '28px 32px',
          }}>
            <SafeMarkdown content={entry.content_md} />

            {entry.sources && entry.sources.length > 0 && (
              <div style={{ marginTop: '36px', paddingTop: '20px', borderTop: '1px solid rgba(18,18,18,0.08)' }}>
                <h3 style={{ fontSize: '1.05rem', marginBottom: '10px' }}>权威数据信源</h3>
                <ul style={{ margin: 0, paddingLeft: '20px', fontSize: '0.88rem', color: 'var(--color-muted)', lineHeight: 1.8 }}>
                  {entry.sources.map((src, idx) => {
                    const safeHref = src.url ? sanitizeUrl(src.url) : null;
                    return (
                      <li key={idx}>
                        {safeHref ? (
                          <a href={safeHref} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--color-text)' }}>
                            {src.title}
                          </a>
                        ) : src.title}
                        {src.publisher ? `（${src.publisher}）` : ''}
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}
          </article>

          {tocHeadings.length > 0 && (
            <aside style={{
              width: '240px',
              flex: '0 0 240px',
              position: 'sticky',
              top: '96px',
              background: 'rgba(255,255,255,0.7)',
              border: '1px solid rgba(18,18,18,0.08)',
              borderRadius: '12px',
              padding: '16px',
            }}>
              <div style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--color-muted)', marginBottom: '10px', letterSpacing: '0.5px' }}>
                本篇目录
              </div>
              <nav style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {tocHeadings.map(h => (
                  <a
                    key={h.id}
                    href={`#${h.id}`}
                    style={{
                      fontSize: h.level === 2 ? '0.86rem' : '0.8rem',
                      paddingLeft: h.level === 3 ? '12px' : '0',
                      color: 'var(--color-text)',
                      textDecoration: 'none',
                      lineHeight: 1.45,
                    }}
                  >
                    {h.text}
                  </a>
                ))}
              </nav>
            </aside>
          )}
        </section>

        {/* 五、常见问题 FAQ（与 FAQPage JSON-LD 100% 同步） */}
        <section aria-labelledby="wiki-faq-heading" style={{ marginBottom: '48px' }}>
          <h2 id="wiki-faq-heading" className="font-editorial" style={{ fontSize: '1.55rem', fontWeight: 500, marginBottom: '16px' }}>
            常见问题（FAQ）
          </h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {faqs.map((item, idx) => (
              <div key={idx} style={{ background: 'rgba(255,255,255,0.75)', border: '1px solid rgba(18,18,18,0.08)', borderRadius: '12px', padding: '16px 20px' }}>
                <h3 style={{ margin: '0 0 8px 0', fontSize: '1rem', fontWeight: 600 }}>Q：{item.q}</h3>
                <p style={{ margin: 0, fontSize: '0.92rem', color: 'var(--color-muted)', lineHeight: 1.7 }}>{item.a}</p>
              </div>
            ))}
          </div>
        </section>

        {/* 六、站内转化：关联深度研报 + 定制入口 */}
        <section style={{
          background: 'rgba(255, 100, 30, 0.05)',
          border: '1px solid rgba(255, 100, 30, 0.18)',
          borderRadius: '16px',
          padding: '24px 28px',
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px', marginBottom: relatedReports.length > 0 ? '18px' : '0' }}>
            <div>
              <h2 className="font-editorial" style={{ margin: 0, fontSize: '1.35rem', fontWeight: 500 }}>
                想深挖某家海外大买家的财报、组织架构与采购邮箱？
              </h2>
              <p style={{ margin: '6px 0 0 0', fontSize: '0.9rem', color: 'var(--color-muted)' }}>
                前往「报告大厅」解锁 360° 客户穿透研报，或提交定制需求让 AI 专项调研。
              </p>
            </div>
            <div style={{ display: 'flex', gap: '10px' }}>
              <Link href="/reports" className="sand-btn" style={{ textDecoration: 'none', padding: '10px 18px', borderRadius: '8px', fontSize: '0.9rem' }}>
                浏览报告大厅
              </Link>
              <button
                type="button"
                onClick={() => setShowCustomModal(true)}
                style={{
                  background: '#ffffff',
                  border: '1px solid rgba(18,18,18,0.15)',
                  padding: '10px 16px',
                  borderRadius: '8px',
                  fontSize: '0.9rem',
                  cursor: 'pointer',
                }}
              >
                定制专项报告
              </button>
            </div>
          </div>

          {relatedReports.length > 0 && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '12px' }}>
              {relatedReports.map(rep => (
                <Link
                  key={rep.id}
                  href={`/reports/${rep.id}`}
                  style={{
                    background: '#ffffff',
                    border: '1px solid rgba(18,18,18,0.08)',
                    borderRadius: '10px',
                    padding: '14px',
                    textDecoration: 'none',
                    color: 'inherit',
                  }}
                >
                  <div style={{ fontSize: '0.75rem', color: 'var(--color-accent)', marginBottom: '4px' }}>
                    {rep.category === 'customer' ? '客户洞察' : '品类分析'} · {rep.market_region}
                  </div>
                  <div style={{ fontWeight: 600, fontSize: '0.92rem', lineHeight: 1.45 }}>{rep.title}</div>
                </Link>
              ))}
            </div>
          )}
        </section>
      </main>

      <Footer />
      <AuthModal isOpen={showAuthModal} onClose={() => setShowAuthModal(false)} />
      <FeedbackModal
        isOpen={showCustomModal}
        onClose={() => setShowCustomModal(false)}
        mode="custom_report"
        userId={userId}
        onShowAuthModal={() => setShowAuthModal(true)}
      />
    </div>
  );
}

export const getServerSideProps: GetServerSideProps = async (context) => {
  const rawSlug = String(context.params?.slug || '').trim().toLowerCase();
  if (!rawSlug) return { notFound: true };

  let dbClient: any = null;
  try {
    dbClient = await pool.connect();
    const auth = await resolveSsrAuth(context, dbClient);

    const res = await dbClient.query(
      `SELECT * FROM wiki_entries WHERE slug = $1 AND status = 'published' LIMIT 1`,
      [rawSlug]
    );
    if (res.rows.length === 0) {
      return { notFound: true };
    }

    const row = res.rows[0];
    const entry: WikiEntryRecord = {
      ...row,
      published_at: row.published_at ? new Date(row.published_at).toISOString() : '',
      created_at: row.created_at ? new Date(row.created_at).toISOString() : '',
      updated_at: row.updated_at ? new Date(row.updated_at).toISOString() : '',
      faq_items: Array.isArray(row.faq_items) ? row.faq_items : [],
      sources: Array.isArray(row.sources) ? row.sources : [],
    };

    const [playerMatches, relatedReports] = await Promise.all([
      matchPlayersWithPlatformAssets(entry.flow_data, dbClient),
      getRelatedReportsForWiki(entry.industry_name, entry.country_name, dbClient, 4),
    ]);

    return {
      props: {
        entry,
        playerMatches,
        relatedReports,
        userId: auth.userId || null,
        userRole: auth.userRole || 'guest',
        quota: auth.freeQuota || 0,
        nickname: auth.nickname || '',
      },
    };
  } catch (err) {
    console.error('[WikiDetail] SSR 渲染异常:', err);
    return { notFound: true };
  } finally {
    if (dbClient) dbClient.release();
  }
};
```

- [ ] **步骤 5：运行测试验证通过并提交**

运行：`npx vitest run tests/wiki-geo-ssr.test.ts`
预期：PASS（2/2 通过）

```bash
git add pages/wiki/index.tsx "pages/wiki/[slug].tsx" tests/wiki-geo-ssr.test.ts
git commit -m "feat(wiki): 实现行业百科公开SSR大厅页与GEO详情页"
```

---

### 任务 8：管理后台「行业百科」轻量管理页

**文件：**
- 创建：`pages/admin/wiki.tsx`
- 修改：`components/admin/AdminLayout.tsx:26-37`

- [ ] **步骤 1：在 `components/admin/AdminLayout.tsx` 侧边栏加入「📚 行业百科」入口**

在 `navItems` 中 `📰 资讯管理` 下方插入：

```ts
    { name: '📰 资讯管理', id: 'news', path: '/admin/news' },
    { name: '📚 行业百科', id: 'wiki', path: '/admin/wiki' },
```

- [ ] **步骤 2：实现 `pages/admin/wiki.tsx`**

复用 `AdminLayout`（`currentPage="wiki"`），提供：
1. **列表视图**：关键词搜索、状态筛选（全部 / 已发布 / 草稿）、展示标题 / Slug / 国家×品类 / 原型 / 阅读数 / 更新时间 / 状态切换按钮 / 预览前台链接 / 编辑按钮 / 删除按钮 + 分页控制。
2. **编辑视图**：编辑标题、摘要、状态、`video_url`、`cover_image`、`content_md`（支持“编辑 / `SafeMarkdown` 实时预览”一键切换）与 `faq_items` JSON 文本编辑，点击保存调用 `PUT /api/admin/wiki`。

```tsx
import React, { useState, useEffect } from 'react';
import AdminLayout from '../../components/admin/AdminLayout';
import SafeMarkdown from '../../components/wiki/SafeMarkdown';
import { ARCHETYPE_META, ArchetypeId } from '../../lib/wiki-schema';

interface AdminWikiRow {
  id: string;
  slug: string;
  title: string;
  summary: string;
  country_name: string;
  industry_name: string;
  archetype_id: ArchetypeId;
  video_url: string | null;
  status: 'draft' | 'published';
  view_count: number;
  updated_at: string;
}

export default function AdminWikiPage() {
  const [view, setView] = useState<'list' | 'editor'>('list');
  const [rows, setRows] = useState<AdminWikiRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('all');
  const [searchQ, setSearchQ] = useState('');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const pageSize = 20;

  // 编辑器状态
  const [editId, setEditId] = useState<string | null>(null);
  const [editSlug, setEditSlug] = useState('');
  const [title, setTitle] = useState('');
  const [summary, setSummary] = useState('');
  const [contentMd, setContentMd] = useState('');
  const [videoUrl, setVideoUrl] = useState('');
  const [coverImage, setCoverImage] = useState('');
  const [faqJson, setFaqJson] = useState('[]');
  const [status, setStatus] = useState<'draft' | 'published'>('published');
  const [previewMode, setPreviewMode] = useState(false);
  const [saving, setSaving] = useState(false);

  const loadList = async (targetPage = page) => {
    setLoading(true);
    try {
      const qs = new URLSearchParams({
        page: String(targetPage),
        pageSize: String(pageSize),
        status: statusFilter,
        q: searchQ,
      });
      const res = await fetch(`/api/admin/wiki?${qs.toString()}`);
      if (res.ok) {
        const json = await res.json();
        setRows(json.data || []);
        setTotal(json.total || 0);
        setPage(json.page || 1);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadList(1);
  }, [statusFilter]);

  const openEditor = async (id: string) => {
    const res = await fetch(`/api/admin/wiki?id=${id}`);
    if (!res.ok) {
      alert('读取词条详情失败');
      return;
    }
    const { data } = await res.json();
    setEditId(data.id);
    setEditSlug(data.slug);
    setTitle(data.title || '');
    setSummary(data.summary || '');
    setContentMd(data.content_md || '');
    setVideoUrl(data.video_url || '');
    setCoverImage(data.cover_image || '');
    setFaqJson(JSON.stringify(data.faq_items || [], null, 2));
    setStatus(data.status === 'draft' ? 'draft' : 'published');
    setPreviewMode(false);
    setView('editor');
  };

  const handleToggleStatus = async (row: AdminWikiRow) => {
    const nextStatus = row.status === 'published' ? 'draft' : 'published';
    const res = await fetch('/api/admin/wiki', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: row.id, status: nextStatus }),
    });
    if (res.ok) {
      loadList(page);
    } else {
      alert('更新状态失败');
    }
  };

  const handleDelete = async (row: AdminWikiRow) => {
    if (!confirm(`确认永久删除行业百科「${row.title}」吗？`)) return;
    const res = await fetch(`/api/admin/wiki?id=${row.id}`, { method: 'DELETE' });
    if (res.ok) {
      loadList(page);
    } else {
      alert('删除失败');
    }
  };

  const handleSave = async () => {
    if (!editId) return;
    let parsedFaqs: any[] = [];
    try {
      parsedFaqs = JSON.parse(faqJson);
      if (!Array.isArray(parsedFaqs)) throw new Error('FAQ 必须是 JSON 数组');
    } catch (e: any) {
      alert(`FAQ JSON 格式有误: ${e.message}`);
      return;
    }

    setSaving(true);
    try {
      const res = await fetch('/api/admin/wiki', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: editId,
          title,
          summary,
          content_md: contentMd,
          video_url: videoUrl || null,
          cover_image: coverImage || null,
          faq_items: parsedFaqs,
          status,
        }),
      });
      if (res.ok) {
        setView('list');
        loadList(page);
      } else {
        const err = await res.json().catch(() => ({}));
        alert(err.error || '保存失败');
      }
    } finally {
      setSaving(false);
    }
  };

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <AdminLayout currentPage="wiki">
      <div style={{ padding: '8px 0' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <div>
            <h1 style={{ margin: 0, fontSize: '1.5rem' }}>📚 行业百科管理</h1>
            <p style={{ margin: '6px 0 0 0', fontSize: '0.88rem', color: '#64748b' }}>
              由 MG推广 管线自动推送至 <code>/api/agent/wiki</code>，此处支持内容微调、视频位配置、上下架与删除。
            </p>
          </div>
          {view === 'editor' && (
            <button type="button" onClick={() => setView('list')} style={{ padding: '8px 16px', cursor: 'pointer' }}>
              ← 返回列表
            </button>
          )}
        </div>

        {view === 'list' ? (
          <>
            <div style={{ display: 'flex', gap: '10px', marginBottom: '16px', flexWrap: 'wrap' }}>
              <input
                type="text"
                value={searchQ}
                onChange={(e) => setSearchQ(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && loadList(1)}
                placeholder="搜索标题 / slug / 国家 / 品类..."
                style={{ padding: '8px 12px', minWidth: '260px', borderRadius: '6px', border: '1px solid #cbd5e1' }}
              />
              <button type="button" onClick={() => loadList(1)} style={{ padding: '8px 14px', cursor: 'pointer' }}>
                搜索
              </button>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                style={{ padding: '8px 12px', borderRadius: '6px', border: '1px solid #cbd5e1' }}
              >
                <option value="all">全部状态</option>
                <option value="published">已发布</option>
                <option value="draft">草稿/下架</option>
              </select>
            </div>

            {loading ? (
              <p>加载中...</p>
            ) : rows.length === 0 ? (
              <p style={{ color: '#64748b' }}>暂无行业百科词条。</p>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse', background: '#fff', borderRadius: '8px', overflow: 'hidden' }}>
                <thead>
                  <tr style={{ background: '#f8fafc', textAlign: 'left', fontSize: '0.85rem' }}>
                    <th style={{ padding: '12px' }}>标题 / Slug</th>
                    <th style={{ padding: '12px' }}>国家 × 品类</th>
                    <th style={{ padding: '12px' }}>原型</th>
                    <th style={{ padding: '12px' }}>浏览</th>
                    <th style={{ padding: '12px' }}>状态</th>
                    <th style={{ padding: '12px' }}>操作</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.id} style={{ borderTop: '1px solid #e2e8f0', fontSize: '0.88rem' }}>
                      <td style={{ padding: '12px' }}>
                        <div style={{ fontWeight: 600 }}>{r.title}</div>
                        <div style={{ fontSize: '0.78rem', color: '#64748b' }}>/wiki/{r.slug}</div>
                      </td>
                      <td style={{ padding: '12px' }}>{r.country_name} · {r.industry_name}</td>
                      <td style={{ padding: '12px' }}>{ARCHETYPE_META[r.archetype_id]?.shortTag || r.archetype_id}</td>
                      <td style={{ padding: '12px' }}>{r.view_count}</td>
                      <td style={{ padding: '12px' }}>
                        <span style={{
                          padding: '3px 8px',
                          borderRadius: '999px',
                          fontSize: '0.76rem',
                          background: r.status === 'published' ? '#dcfce7' : '#f1f5f9',
                          color: r.status === 'published' ? '#15803d' : '#475569',
                        }}>
                          {r.status === 'published' ? '已发布' : '草稿'}
                        </span>
                      </td>
                      <td style={{ padding: '12px', display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                        {r.status === 'published' && (
                          <a href={`/wiki/${r.slug}`} target="_blank" rel="noopener noreferrer" style={{ fontSize: '0.82rem' }}>
                            前台预览
                          </a>
                        )}
                        <button type="button" onClick={() => openEditor(r.id)} style={{ cursor: 'pointer', fontSize: '0.82rem' }}>编辑</button>
                        <button type="button" onClick={() => handleToggleStatus(r)} style={{ cursor: 'pointer', fontSize: '0.82rem' }}>
                          {r.status === 'published' ? '下架' : '发布'}
                        </button>
                        <button type="button" onClick={() => handleDelete(r)} style={{ cursor: 'pointer', fontSize: '0.82rem', color: '#dc2626' }}>删除</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}

            <div style={{ marginTop: '16px', display: 'flex', gap: '12px', alignItems: 'center', fontSize: '0.86rem' }}>
              <span>共 {total} 条 · 第 {page} / {totalPages} 页</span>
              <button type="button" disabled={page <= 1} onClick={() => loadList(page - 1)}>上一页</button>
              <button type="button" disabled={page >= totalPages} onClick={() => loadList(page + 1)}>下一页</button>
            </div>
          </>
        ) : (
          <div style={{ background: '#fff', padding: '20px', borderRadius: '10px', border: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div style={{ fontSize: '0.84rem', color: '#64748b' }}>Slug：<code>/wiki/{editSlug}</code></div>
            <label>
              <div style={{ fontWeight: 600, marginBottom: '4px' }}>词条标题</div>
              <input value={title} onChange={(e) => setTitle(e.target.value)} style={{ width: '100%', padding: '8px 10px' }} />
            </label>
            <label>
              <div style={{ fontWeight: 600, marginBottom: '4px' }}>核心摘要（SEO / GEO Description）</div>
              <textarea value={summary} onChange={(e) => setSummary(e.target.value)} rows={2} style={{ width: '100%', padding: '8px 10px' }} />
            </label>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 160px', gap: '12px' }}>
              <label>
                <div style={{ fontWeight: 600, marginBottom: '4px' }}>35 秒竖屏视频 URL（可选）</div>
                <input value={videoUrl} onChange={(e) => setVideoUrl(e.target.value)} placeholder="https://...cos.../video.mp4" style={{ width: '100%', padding: '8px 10px' }} />
              </label>
              <label>
                <div style={{ fontWeight: 600, marginBottom: '4px' }}>封面图 URL（可选）</div>
                <input value={coverImage} onChange={(e) => setCoverImage(e.target.value)} placeholder="https://...cos.../cover.jpg" style={{ width: '100%', padding: '8px 10px' }} />
              </label>
              <label>
                <div style={{ fontWeight: 600, marginBottom: '4px' }}>发布状态</div>
                <select value={status} onChange={(e) => setStatus(e.target.value as 'draft' | 'published')} style={{ width: '100%', padding: '8px 10px' }}>
                  <option value="published">已发布</option>
                  <option value="draft">草稿/下架</option>
                </select>
              </label>
            </div>
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                <span style={{ fontWeight: 600 }}>深度图文长文（Markdown）</span>
                <button type="button" onClick={() => setPreviewMode(!previewMode)} style={{ cursor: 'pointer', fontSize: '0.82rem' }}>
                  {previewMode ? '切换回源码编辑' : '实时渲染预览'}
                </button>
              </div>
              {previewMode ? (
                <div style={{ border: '1px solid #e2e8f0', borderRadius: '8px', padding: '16px', maxHeight: '420px', overflowY: 'auto' }}>
                  <SafeMarkdown content={contentMd} />
                </div>
              ) : (
                <textarea value={contentMd} onChange={(e) => setContentMd(e.target.value)} rows={14} style={{ width: '100%', padding: '10px', fontFamily: 'monospace' }} />
              )}
            </div>
            <label>
              <div style={{ fontWeight: 600, marginBottom: '4px' }}>GEO 高频问答 FAQ（JSON 数组：`[{`{"q":"...","a":"..."}`}]`）</div>
              <textarea value={faqJson} onChange={(e) => setFaqJson(e.target.value)} rows={6} style={{ width: '100%', padding: '10px', fontFamily: 'monospace' }} />
            </label>
            <div style={{ display: 'flex', gap: '12px' }}>
              <button type="button" disabled={saving} onClick={handleSave} style={{ padding: '10px 22px', background: '#ff641e', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer' }}>
                {saving ? '保存中...' : '保存修改'}
              </button>
              <button type="button" onClick={() => setView('list')} style={{ padding: '10px 18px', cursor: 'pointer' }}>
                取消
              </button>
            </div>
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
```

- [ ] **步骤 3：提交后台管理页与侧边栏变更**

```bash
git add pages/admin/wiki.tsx components/admin/AdminLayout.tsx
git commit -m "feat(wiki): 新增后台行业百科轻量管理页与侧边栏入口"
```

---

### 任务 9：全站导航、Next.js GEO 重写/CSP、robots.txt、Sitemap、百度推送与全量验证

**文件：**
- 修改：`components/Navbar.tsx`（PC 端第 137 行后 + 移动端抽屉第 480 行后新增 `行业百科`）
- 修改：`components/Footer.tsx`（右侧导航增加 `行业百科`）
- 修改：`next.config.js`（`beforeFiles` 重写 `/llms.txt` 与 `/wiki/:slug.md`，CSP 添加 `media-src 'self' blob: https:`）
- 修改：`public/robots.txt`（显式放行主流 AI 爬虫）
- 修改：`pages/sitemap.xml.tsx`（纳入 `/wiki` 与全部已发布 `/wiki/[slug]`）
- 修改：`bin/push-to-baidu.js`（纳入 `wiki_entries` 优先推送与时间戳回写）

- [ ] **步骤 1：更新 `components/Navbar.tsx` 与 `components/Footer.tsx`**

在 `components/Navbar.tsx` 的 PC `<nav>` 和移动端抽屉中，均在 `每日资讯` 与 `报告大厅` 之间插入：
```tsx
<Link href="/wiki" style={{ textDecoration: 'none', color: 'var(--color-text)', fontSize: '1rem', fontWeight: 400, transition: 'color 0.2s' }} className="nav-menu-item">行业百科</Link>
```
（移动端抽屉同步添加带 `onClick={() => setMobileMenuOpen(false)}` 的 `<Link href="/wiki">行业百科</Link>`）。

在 `components/Footer.tsx` 的 `每日资讯` 链接旁添加 `行业百科` (`/wiki`) 链接。

- [ ] **步骤 2：更新 `next.config.js`（GEO 路由重写 + 视频 CSP 放行）**

```js
  async rewrites() {
    return {
      beforeFiles: [
        {
          source: '/llms.txt',
          destination: '/api/llms',
        },
        {
          source: '/wiki/:slug.md',
          destination: '/api/wiki/:slug/markdown',
        },
      ],
      afterFiles: [
        {
          source: '/baidu_verify_:slug*.html',
          destination: '/api/verify-baidu',
        },
      ],
    };
  },
```
并在 `Content-Security-Policy` 数组中加入 `"media-src 'self' blob: https:"`。

- [ ] **步骤 3：更新 `public/robots.txt`**

```txt
User-agent: *
Allow: /
Allow: /wiki
Allow: /llms.txt
Disallow: /admin/
Disallow: /api/
Disallow: /my-graph
Disallow: /story-demo

# 显式欢迎主流 AI 搜索引擎与生成式模型爬虫索引公开百科与资讯
User-agent: GPTBot
Allow: /wiki
Allow: /llms.txt
Allow: /news
Disallow: /admin/
Disallow: /api/

User-agent: OAI-SearchBot
Allow: /wiki
Allow: /llms.txt
Allow: /news
Disallow: /admin/
Disallow: /api/

User-agent: PerplexityBot
Allow: /wiki
Allow: /llms.txt
Allow: /news
Disallow: /admin/
Disallow: /api/

User-agent: ClaudeBot
Allow: /wiki
Allow: /llms.txt
Allow: /news
Disallow: /admin/
Disallow: /api/

User-agent: Bytespider
Allow: /wiki
Allow: /llms.txt
Allow: /news
Disallow: /admin/
Disallow: /api/

Sitemap: https://marketgraphic.cn/sitemap.xml
```

- [ ] **步骤 4：更新 `pages/sitemap.xml.tsx` 与 `bin/push-to-baidu.js`**

在 `pages/sitemap.xml.tsx` 中查询 `SELECT slug, updated_at FROM wiki_entries WHERE status = 'published' ORDER BY updated_at DESC`（若表不存在用 `try/catch` 容错），向 `<urlset>` 追加 `/wiki`（priority `0.9`）与所有 `/wiki/{slug}`（priority `0.85`）。

在 `bin/push-to-baidu.js` 中：
1. `--include-static` 补上 `${BASE_URL}/wiki`；
2. 在未推送报告之后、轮询存量之前，优先查询未推送过的 `wiki_entries`（`WHERE status = 'published' AND baidu_pushed_at IS NULL`）加入队列（`type: 'wiki'`）；
3. 推送成功后批量执行 `UPDATE wiki_entries SET baidu_pushed_at = NOW() WHERE id = ANY($1::uuid[])`。

- [ ] **步骤 5：运行全量测试与 Next.js 生产构建验证**

运行：
1. `npx vitest run tests/wiki-db-schema.test.ts tests/wiki-schema.test.ts tests/wiki-service.test.ts tests/wiki-api.test.ts tests/wiki-markdown.test.ts tests/wiki-geo-ssr.test.ts`
   预期：全部 PASS（零跳过、零报错）
2. `npm.cmd run build`
   预期：Next.js TypeScript 类型检查与生产构建全部成功，`/wiki`、`/wiki/[slug]`、`/admin/wiki`、`/api/agent/wiki`、`/api/admin/wiki`、`/api/llms` 均正常编译输出。

- [ ] **步骤 6：提交收尾变更**

```bash
git add components/Navbar.tsx components/Footer.tsx next.config.js public/robots.txt pages/sitemap.xml.tsx bin/push-to-baidu.js
git commit -m "feat(wiki): 接入全站导航、GEO重写与CSP、robots.txt、Sitemap及百度主动推送"
```
