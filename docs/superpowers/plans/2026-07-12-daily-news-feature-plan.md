# 每日资讯功能实现计划

> **面向 AI 代理的工作者：** 必需子技能：使用 superpowers:subagent-driven-development（推荐）或 superpowers:executing-plans 逐任务实现此计划。步骤使用复选框（`- [ ]`）语法来跟踪进度。

**目标：** 在主页 Hero 区域下方增加每日资讯区块，增加导航栏“资讯”入口并建立独立的资讯列表与详情页，支持区域/国家/行业筛选及 localStorage 偏好保存，并向外提供统一的 Agent 生成/管理员手动发布 API，所有资讯页面均采用 SSR 渲染以全面优化 SEO 收录。

**架构：**
- 底层设计 `articles` 表与 `article_entities` 表，共享已有的 `entities` 实体库，但不参与 Obsidian 关系图谱的可视化渲染。
- 后端实现 `/api/agent/publish`（通过 `AGENT_API_KEY` 鉴权）和 `/api/admin/articles/create` 两个上传/推送接口，并在上传时利用已有的 `runDehydration` 剥离 Base64 大图、利用 `extractAndNormalizeEntities` 进行实体与角色解析。
- 新增 `/api/articles` 公开查询列表接口，支持分类筛选和分页。
- 前端新增 `pages/news/index.tsx` 和 `pages/news/[id].tsx` 作为独立的网页，并在主页 Hero 区域下增加按用户喜好展示的资讯推荐组件。

**技术栈：** Next.js Pages Router (SSR), PostgreSQL (pg pool), Vitest

---

## 计划变更文件清单
1. **[NEW]** `supabase/migrations/20260712000000_daily_news_schema.sql`：资讯及资讯关联实体表的建表 SQL。
2. **[NEW]** `tests/db-schema-news.test.ts`：数据库新表结构和约束验证测试。
3. **[NEW]** `pages/api/agent/publish.ts`：外部 Agent / 管理员统一推送的公开/鉴权发布 API。
4. **[NEW]** `pages/api/admin/articles/create.ts`：管理员手动发布资讯 API。
5. **[NEW]** `pages/api/user/articles.ts`：前台公开列表与分类筛选 API。
6. **[NEW]** `tests/news-api.test.ts`：资讯发布与查询 API 单元/集成测试。
7. **[NEW]** `pages/news/index.tsx`：独立的资讯列表页面（带 localStorage 喜好缓存及筛选器）。
8. **[NEW]** `pages/news/[id].tsx`：独立的资讯详情页面（支持完整 SSR 及 SEO meta 标签渲染）。
9. **[MODIFY]** `pages/index.tsx`：更新导航栏入口，在 Hero 区域下方增加按喜好展示的 3~6 条资讯组件，配置 SSR 获取初始数据。

---

## 实施任务

### 任务 1：数据库迁移与 Schema 验证 (TDD)

**文件：**
- 新建：`supabase/migrations/20260712000000_daily_news_schema.sql`
- 测试：`tests/db-schema-news.test.ts`

- [ ] **步骤 1：编写失败的数据库 Schema 验证测试**
  
  在 `tests/db-schema-news.test.ts` 中写入：
  ```typescript
  import { expect, it, describe, beforeAll, afterAll } from 'vitest';
  import { Client } from 'pg';

  describe('Daily News Schema Tests', () => {
    let dbClient: Client;

    beforeAll(async () => {
      dbClient = new Client({
        connectionString: process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/postgres'
      });
      await dbClient.connect();
    });

    afterAll(async () => {
      await dbClient.end();
    });

    it('should verify articles and article_entities tables exist with correct fields', async () => {
      const articlesRes = await dbClient.query(`
        SELECT column_name, data_type 
        FROM information_schema.columns 
        WHERE table_name = 'articles'
      `);
      expect(articlesRes.rows.length).toBeGreaterThan(0);
      const columns = articlesRes.rows.map(r => r.column_name);
      expect(columns).toContain('id');
      expect(columns).toContain('title');
      expect(columns).toContain('summary');
      expect(columns).toContain('content_html');
      expect(columns).toContain('region');
      expect(columns).toContain('country');
      expect(columns).toContain('industry');
      expect(columns).toContain('source');
      expect(columns).toContain('published_at');

      const entitiesRes = await dbClient.query(`
        SELECT column_name, data_type 
        FROM information_schema.columns 
        WHERE table_name = 'article_entities'
      `);
      expect(entitiesRes.rows.length).toBeGreaterThan(0);
    });
  });
  ```

- [ ] **步骤 2：运行测试验证失败**
  
  运行：`npx vitest run tests/db-schema-news.test.ts`
  预期：FAIL（报错指明 `articles` 表不存在）

- [ ] **步骤 3：编写 SQL 迁移建表脚本**
  
  在 `supabase/migrations/20260712000000_daily_news_schema.sql` 中写入：
  ```sql
  CREATE TABLE IF NOT EXISTS articles (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      title VARCHAR(200) NOT NULL,
      summary TEXT,
      content_html TEXT NOT NULL,
      region VARCHAR(100),
      country VARCHAR(100),
      industry VARCHAR(100),
      source VARCHAR(20) NOT NULL DEFAULT 'manual', -- 'manual' | 'agent'
      published_at TIMESTAMP DEFAULT NOW(),
      created_at TIMESTAMP DEFAULT NOW()
  );

  CREATE TABLE IF NOT EXISTS article_entities (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      article_id UUID REFERENCES articles(id) ON DELETE CASCADE,
      entity_id UUID REFERENCES entities(id) ON DELETE CASCADE,
      role VARCHAR(50),
      created_at TIMESTAMP DEFAULT NOW(),
      UNIQUE(article_id, entity_id)
  );

  CREATE INDEX IF NOT EXISTS idx_articles_region ON articles(region);
  CREATE INDEX IF NOT EXISTS idx_articles_country ON articles(country);
  CREATE INDEX IF NOT EXISTS idx_articles_industry ON articles(industry);
  CREATE INDEX IF NOT EXISTS idx_article_entities_article ON article_entities(article_id);
  ```

- [ ] **步骤 4：运行测试验证通过**
  
  运行：`npx vitest run tests/db-schema-news.test.ts`
  预期：PASS

- [ ] **步骤 5：Commit**
  
  ```bash
  git add supabase/migrations/20260712000000_daily_news_schema.sql tests/db-schema-news.test.ts
  git commit -m "migration: create articles and article_entities tables"
  ```

---

### 任务 2：实现发布与列表 API 接口 (TDD)

**文件：**
- 新建：`pages/api/agent/publish.ts`
- 新建：`pages/api/admin/articles/create.ts`
- 新建：`pages/api/user/articles.ts`
- 测试：`tests/news-api.test.ts`

- [ ] **步骤 1：编写失败的 API 行为测试**
  
  在 `tests/news-api.test.ts` 中写入：
  ```typescript
  import { expect, it, describe, beforeAll, afterAll } from 'vitest';
  import { Client } from 'pg';
  import publishHandler from '../pages/api/agent/publish';
  import createHandler from '../pages/api/admin/articles/create';
  import listHandler from '../pages/api/user/articles';

  describe('News API System Tests', () => {
    let dbClient: Client;

    beforeAll(async () => {
      dbClient = new Client({
        connectionString: process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/postgres'
      });
      await dbClient.connect();
      process.env.AGENT_API_KEY = 'test_agent_secret';
    });

    afterAll(async () => {
      await dbClient.query(`DELETE FROM articles WHERE title LIKE '测试资讯%'`);
      await dbClient.end();
    });

    it('should fail publishing if AGENT_API_KEY is unauthorized', async () => {
      // 验证未授权行为
      const mockReq = {
        method: 'POST',
        headers: { authorization: 'Bearer bad_key' },
        body: { type: 'article', title: '测试资讯A', contentHtml: '<div>Content</div>' }
      } as any;
      
      let statusVal = 0;
      let jsonVal: any = null;
      const mockRes = {
        status: (code: number) => { statusVal = code; return mockRes; },
        json: (data: any) => { jsonVal = data; }
      } as any;

      await publishHandler(mockReq, mockRes);
      expect(statusVal).toBe(401);
    });
  });
  ```

- [ ] **步骤 2：运行测试验证失败**
  
  运行：`npx vitest run tests/news-api.test.ts`
  预期：FAIL（接口尚未定义）

- [ ] **步骤 3：编写 Agent 自动发布接口逻辑**
  
  在 `pages/api/agent/publish.ts` 中写入：
  ```typescript
  import { NextApiRequest, NextApiResponse } from 'next';
  import { PoolClient } from 'pg';
  import { withDb } from '../../../lib/api-handler';
  import { runDehydration, extractAndNormalizeEntities } from '../../../lib/entity-extractor';

  async function publishHandler(req: NextApiRequest, res: NextApiResponse, dbClient: PoolClient) {
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.split(' ')[1];
    const expectedToken = process.env.AGENT_API_KEY || 'test_agent_secret';

    if (!token || token !== expectedToken) {
      return res.status(401).json({ error: 'Unauthorized: Invalid Agent API Key' });
    }

    const { type, title, summary, contentHtml, region, country, industry, tags } = req.body;

    if (!title || !contentHtml) {
      return res.status(400).json({ error: 'Missing title or contentHtml' });
    }

    await dbClient.query('BEGIN');

    // 图片脱水处理
    const mockUpload = async (buffer: Buffer, mime: string) => {
      const ext = mime.split('/')[1] || 'png';
      const fileName = `img_${Date.now()}_${Math.floor(Math.random() * 1000)}.${ext}`;
      const fs = require('fs');
      const path = require('path');
      const uploadDir = path.join(process.cwd(), 'public', 'uploads');
      if (!fs.existsSync(uploadDir)) {
        fs.mkdirSync(uploadDir, { recursive: true });
      }
      fs.writeFileSync(path.join(uploadDir, fileName), buffer);
      return `/uploads/${fileName}`;
    };

    const { cleanHtml } = await runDehydration(contentHtml, mockUpload);

    if (type === 'report') {
      // 转发写入现有报告
      const insertReportRes = await dbClient.query(
        `INSERT INTO reports (title, category, market_region, summary, content_html)
         VALUES ($1, $2, $3, $4, $5) RETURNING id`,
        [title, 'product', market_region_helper(region, country), summary, cleanHtml]
      );
      const newReportId = insertReportRes.rows[0].id;
      
      const resolvedEntities = await extractAndNormalizeEntities(contentHtml, title, dbClient, tags);
      for (const ent of resolvedEntities) {
        await dbClient.query(
          `INSERT INTO report_entities (report_id, entity_id, role) 
           VALUES ($1, $2, $3) ON CONFLICT (report_id, entity_id) DO NOTHING`,
          [newReportId, ent.id, ent.role]
        );
      }
      await dbClient.query('COMMIT');
      return res.status(200).json({ success: true, id: newReportId, type: 'report' });
    } else {
      // 写入资讯表
      const insertArticleRes = await dbClient.query(
        `INSERT INTO articles (title, summary, content_html, region, country, industry, source)
         VALUES ($1, $2, $3, $4, $5, $6, 'agent') RETURNING id`,
        [title, summary || '', cleanHtml, region || null, country || null, industry || null]
      );
      const newArticleId = insertArticleRes.rows[0].id;

      // 提取实体与归一化
      const resolvedEntities = await extractAndNormalizeEntities(contentHtml, title, dbClient, tags);
      for (const ent of resolvedEntities) {
        await dbClient.query(
          `INSERT INTO article_entities (article_id, entity_id, role)
           VALUES ($1, $2, $3) ON CONFLICT (article_id, entity_id) DO NOTHING`,
          [newArticleId, ent.id, ent.role]
        );
      }
      await dbClient.query('COMMIT');
      return res.status(200).json({ success: true, id: newArticleId, type: 'article' });
    }
  }

  function market_region_helper(region?: string, country?: string) {
    if (region && country) return `${region}, ${country}`;
    return region || country || '全球';
  }

  export default withDb(publishHandler, { methods: ['POST'] });
  ```

- [ ] **步骤 4：编写管理员手动发布接口逻辑**
  
  在 `pages/api/admin/articles/create.ts` 中写入：
  ```typescript
  import { NextApiRequest, NextApiResponse } from 'next';
  import { PoolClient } from 'pg';
  import { withDb } from '../../../lib/api-handler';
  import { requireAdmin } from '../../../lib/auth';
  import { runDehydration, extractAndNormalizeEntities } from '../../../lib/entity-extractor';

  async function createHandler(req: NextApiRequest, res: NextApiResponse, dbClient: PoolClient) {
    const adminSession = requireAdmin(req);
    if (!adminSession) {
      return res.status(403).json({ error: '权限不足，仅管理员可发布资讯' });
    }

    const { title, summary, contentHtml, region, country, industry, tags } = req.body;
    if (!title || !contentHtml) {
      return res.status(400).json({ error: 'Missing title or contentHtml' });
    }

    await dbClient.query('BEGIN');

    const mockUpload = async (buffer: Buffer, mime: string) => {
      const ext = mime.split('/')[1] || 'png';
      const fileName = `img_${Date.now()}_${Math.floor(Math.random() * 1000)}.${ext}`;
      const fs = require('fs');
      const path = require('path');
      const uploadDir = path.join(process.cwd(), 'public', 'uploads');
      if (!fs.existsSync(uploadDir)) {
        fs.mkdirSync(uploadDir, { recursive: true });
      }
      fs.writeFileSync(path.join(uploadDir, fileName), buffer);
      return `/uploads/${fileName}`;
    };

    const { cleanHtml } = await runDehydration(contentHtml, mockUpload);

    const insertRes = await dbClient.query(
      `INSERT INTO articles (title, summary, content_html, region, country, industry, source)
       VALUES ($1, $2, $3, $4, $5, $6, 'manual') RETURNING id`,
      [title, summary || '', cleanHtml, region || null, country || null, industry || null]
    );
    const newId = insertRes.rows[0].id;

    const resolvedEntities = await extractAndNormalizeEntities(contentHtml, title, dbClient, tags);
    for (const ent of resolvedEntities) {
      await dbClient.query(
        `INSERT INTO article_entities (article_id, entity_id, role)
         VALUES ($1, $2, $3) ON CONFLICT (article_id, entity_id) DO NOTHING`,
        [newId, ent.id, ent.role]
      );
    }

    await dbClient.query('COMMIT');
    return res.status(200).json({ success: true, id: newId });
  }

  export default withDb(createHandler, { methods: ['POST'] });
  ```

- [ ] **步骤 5：编写公开资讯列表接口逻辑**
  
  在 `pages/api/user/articles.ts` 中写入：
  ```typescript
  import { NextApiRequest, NextApiResponse } from 'next';
  import { PoolClient } from 'pg';
  import { withDb } from '../../../lib/api-handler';

  async function listHandler(req: NextApiRequest, res: NextApiResponse, dbClient: PoolClient) {
    const { region, country, industry, page = '1', pageSize = '20' } = req.query;

    const p = parseInt(page as string) || 1;
    const size = parseInt(pageSize as string) || 20;
    const offset = (p - 1) * size;

    let queryText = `SELECT id, title, summary, region, country, industry, published_at FROM articles WHERE 1=1`;
    let countText = `SELECT COUNT(*) FROM articles WHERE 1=1`;
    const params: any[] = [];
    let pCount = 1;

    if (region) {
      queryText += ` AND region = $${pCount}`;
      countText += ` AND region = $${pCount}`;
      params.push(region);
      pCount++;
    }
    if (country) {
      queryText += ` AND country = $${pCount}`;
      countText += ` AND country = $${pCount}`;
      params.push(country);
      pCount++;
    }
    if (industry) {
      queryText += ` AND industry = $${pCount}`;
      countText += ` AND industry = $${pCount}`;
      params.push(industry);
      pCount++;
    }

    // 获取总数
    const countRes = await dbClient.query(countText, params);
    const total = parseInt(countRes.rows[0].count) || 0;

    // 获取分页列表
    queryText += ` ORDER BY published_at DESC LIMIT $${pCount} OFFSET $${pCount + 1}`;
    params.push(size, offset);

    const listRes = await dbClient.query(queryText, params);

    return res.status(200).json({
      articles: listRes.rows,
      total,
      page: p,
      pageSize: size
    });
  }

  export default withDb(listHandler, { methods: ['GET'] });
  ```

- [ ] **步骤 6：扩展接口集成验证测试**
  
  在 `tests/news-api.test.ts` 中追加：
  ```typescript
  it('should successfully publish an article and query it back via user list api', async () => {
    // 1. 推送资讯
    const mockReq = {
      method: 'POST',
      headers: { authorization: 'Bearer test_agent_secret' },
      body: {
        type: 'article',
        title: '测试资讯B-俄罗斯玩具市场',
        summary: '俄罗斯玩具深度动态',
        contentHtml: '<div>测试玩具内容</div>',
        region: '欧洲',
        country: '俄罗斯',
        industry: '玩具'
      }
    } as any;
    
    let statusVal = 0;
    let jsonVal: any = null;
    const mockRes = {
      status: (code: number) => { statusVal = code; return mockRes; },
      json: (data: any) => { jsonVal = data; }
    } as any;

    await publishHandler(mockReq, mockRes);
    expect(statusVal).toBe(200);
    expect(jsonVal.success).toBe(true);
    const newId = jsonVal.id;

    // 2. 调用列表 API 检索
    const mockListReq = {
      method: 'GET',
      query: { country: '俄罗斯', industry: '玩具' }
    } as any;
    let listStatus = 0;
    let listJson: any = null;
    const mockListRes = {
      status: (code: number) => { listStatus = code; return mockListRes; },
      json: (data: any) => { listJson = data; }
    } as any;

    await listHandler(mockListReq, mockListRes);
    expect(listStatus).toBe(200);
    expect(listJson.articles.length).toBeGreaterThan(0);
    const matched = listJson.articles.find((a: any) => a.id === newId);
    expect(matched.title).toBe('测试资讯B-俄罗斯玩具市场');
  });
  ```

- [ ] **步骤 7：运行测试验证通过**
  
  运行：`npx vitest run tests/news-api.test.ts`
  预期：PASS

- [ ] **步骤 8：Commit**
  
  ```bash
  git add pages/api/agent/publish.ts pages/api/admin/articles/create.ts pages/api/user/articles.ts tests/news-api.test.ts
  git commit -m "feat: implement daily news publish and retrieval APIs with tests"
  ```

---

### 任务 3：前台独立页面与列表路由配置

**文件：**
- 新建：`pages/news/index.tsx`
- 新建：`pages/news/[id].tsx`

- [ ] **步骤 1：创建独立的资讯列表页**
  
  在 `pages/news/index.tsx` 中写入完整的带地区/行业筛选及 `localStorage` 自动存储过滤选项的 SSR 列表展现逻辑：
  ```typescript
  import { GetServerSideProps } from 'next';
  import React, { useState, useEffect } from 'react';
  import Link from 'next/link';
  import pool from '../../lib/db';

  interface Article {
    id: string;
    title: string;
    summary: string;
    region: string;
    country: string;
    industry: string;
    published_at: string;
  }

  interface NewsIndexProps {
    initialArticles: Article[];
    totalCount: number;
    regions: string[];
    countries: string[];
    industries: string[];
  }

  export default function NewsIndexPage({
    initialArticles,
    totalCount,
    regions,
    countries,
    industries
  }: NewsIndexProps) {
    const [articles, setArticles] = useState<Article[]>(initialArticles);
    const [selRegion, setSelRegion] = useState('All');
    const [selCountry, setSelCountry] = useState('All');
    const [selIndustry, setSelIndustry] = useState('All');
    const [page, setPage] = useState(1);

    // 1. 生命周期恢复用户的 preference 过滤条件
    useEffect(() => {
      const cacheRegion = localStorage.getItem('gtb_news_region') || 'All';
      const cacheCountry = localStorage.getItem('gtb_news_country') || 'All';
      const cacheIndustry = localStorage.getItem('gtb_news_industry') || 'All';
      setSelRegion(cacheRegion);
      setSelCountry(cacheCountry);
      setSelIndustry(cacheIndustry);
      
      fetchFiltered(cacheRegion, cacheCountry, cacheIndustry, 1);
    }, []);

    const fetchFiltered = async (reg: string, cnt: string, ind: string, pNum: number) => {
      let url = `/api/user/articles?page=${pNum}`;
      if (reg !== 'All') url += `&region=${encodeURIComponent(reg)}`;
      if (cnt !== 'All') url += `&country=${encodeURIComponent(cnt)}`;
      if (ind !== 'All') url += `&industry=${encodeURIComponent(ind)}`;

      const res = await fetch(url);
      const data = await res.json();
      if (data.articles) {
        setArticles(data.articles);
      }
    };

    const handleFilterChange = (type: 'reg' | 'cnt' | 'ind', val: string) => {
      let r = selRegion;
      let c = selCountry;
      let i = selIndustry;

      if (type === 'reg') {
        r = val;
        setSelRegion(val);
        localStorage.setItem('gtb_news_region', val);
      } else if (type === 'cnt') {
        c = val;
        setSelCountry(val);
        localStorage.setItem('gtb_news_country', val);
      } else {
        i = val;
        setSelIndustry(val);
        localStorage.setItem('gtb_news_industry', val);
      }

      setPage(1);
      fetchFiltered(r, c, i, 1);
    };

    return (
      <div style={{ padding: '40px', maxWidth: '1200px', margin: '0 auto', fontFamily: 'sans-serif' }}>
        <header style={{ marginBottom: '30px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h1 style={{ fontSize: '2rem', margin: 0 }}>每日全球资讯厅</h1>
          <Link href="/" style={{ textDecoration: 'none', color: '#ff641e' }}>返回主页</Link>
        </header>

        {/* 筛选菜单栏 */}
        <section style={{ display: 'flex', gap: '20px', marginBottom: '40px', background: '#f5f5f5', padding: '16px', borderRadius: '4px' }}>
          <div>
            <label style={{ marginRight: '8px', fontSize: '0.9rem' }}>区域:</label>
            <select value={selRegion} onChange={(e) => handleFilterChange('reg', e.target.value)}>
              <option value="All">全部区域</option>
              {regions.map(r => <option key={r} value={r}>{r}</option>)}
            </select>
          </div>
          <div>
            <label style={{ marginRight: '8px', fontSize: '0.9rem' }}>国家:</label>
            <select value={selCountry} onChange={(e) => handleFilterChange('cnt', e.target.value)}>
              <option value="All">全部国家</option>
              {countries.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div>
            <label style={{ marginRight: '8px', fontSize: '0.9rem' }}>行业:</label>
            <select value={selIndustry} onChange={(e) => handleFilterChange('ind', e.target.value)}>
              <option value="All">全部行业</option>
              {industries.map(i => <option key={i} value={i}>{i}</option>)}
            </select>
          </div>
        </section>

        {/* 资讯卡片展现 */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '30px' }}>
          {articles.map((art) => (
            <div key={art.id} style={{ border: '1px solid #ddd', padding: '20px', borderRadius: '4px' }}>
              <span style={{ fontSize: '0.75rem', color: '#ff641e', textTransform: 'uppercase', fontWeight: 600 }}>
                {art.industry || '综合'}
              </span>
              <h3 style={{ margin: '8px 0', fontSize: '1.2rem' }}>
                <Link href={`/news/${art.id}`} style={{ textDecoration: 'none', color: '#333' }}>
                  {art.title}
                </Link>
              </h3>
              <p style={{ color: '#666', fontSize: '0.9rem', lineHeight: '1.5' }}>{art.summary}</p>
              <div style={{ marginTop: '15px', fontSize: '0.8rem', color: '#999' }}>
                <span>{art.region} {art.country}</span> • <span>{new Date(art.published_at).toLocaleDateString()}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  export const getServerSideProps: GetServerSideProps = async () => {
    const dbClient = await pool.connect();
    try {
      const articlesRes = await dbClient.query(
        `SELECT id, title, summary, region, country, industry, published_at 
         FROM articles ORDER BY published_at DESC LIMIT 20`
      );
      const regions = await dbClient.query(`SELECT DISTINCT region FROM articles WHERE region IS NOT NULL`);
      const countries = await dbClient.query(`SELECT DISTINCT country FROM articles WHERE country IS NOT NULL`);
      const industries = await dbClient.query(`SELECT DISTINCT industry FROM articles WHERE industry IS NOT NULL`);

      return {
        props: {
          initialArticles: articlesRes.rows.map(r => ({ ...r, published_at: r.published_at.toISOString() })),
          totalCount: articlesRes.rows.length,
          regions: regions.rows.map(r => r.region),
          countries: countries.rows.map(c => c.country),
          industries: industries.rows.map(i => i.industry)
        }
      };
    } finally {
      dbClient.release();
    }
  };
  ```

- [ ] **步骤 2:: 创建独立的资讯详情页 (含全量 SEO 配置)**
  
  在 `pages/news/[id].tsx` 中写入利用 SSR 渲染提供搜索引擎抓取的页面逻辑：
  ```typescript
  import { GetServerSideProps } from 'next';
  import Head from 'next/head';
  import React from 'react';
  import pool from '../../lib/db';
  import Link from 'next/link';

  interface Article {
    id: string;
    title: string;
    summary: string;
    content_html: string;
    region: string;
    country: string;
    industry: string;
    published_at: string;
  }

  interface RelatedReport {
    id: string;
    title: string;
    category: string;
    market_region: string;
  }

  interface NewsDetailProps {
    article: Article | null;
    relatedReports: RelatedReport[];
  }

  export default function NewsDetailPage({ article, relatedReports }: NewsDetailProps) {
    if (!article) {
      return <div style={{ padding: '50px', textAlign: 'center' }}>资讯未找到</div>;
    }

    return (
      <div style={{ padding: '40px', maxWidth: '800px', margin: '0 auto', fontFamily: 'sans-serif' }}>
        <Head>
          <title>{article.title} - Global Trade Buddy</title>
          <meta name="description" content={article.summary || article.title} />
          <meta property="og:title" content={article.title} />
          <meta property="og:description" content={article.summary || article.title} />
          <meta property="og:type" content="article" />
        </Head>

        <header style={{ marginBottom: '30px' }}>
          <Link href="/news" style={{ textDecoration: 'none', color: '#ff641e' }}>← 返回资讯大厅</Link>
        </header>

        <article>
          <h1 style={{ fontSize: '2.5rem', marginBottom: '10px' }}>{article.title}</h1>
          <div style={{ color: '#999', fontSize: '0.9rem', marginBottom: '30px', borderBottom: '1px solid #eee', paddingBottom: '15px' }}>
            <span>分类: {article.industry || '全能'}</span> • <span>发布于: {new Date(article.published_at).toLocaleDateString()}</span>
          </div>

          <div 
            style={{ lineHeight: 1.8, fontSize: '1.1rem', color: '#222' }}
            dangerouslySetInnerHTML={{ __html: article.content_html }} 
          />
        </article>

        {relatedReports.length > 0 && (
          <section style={{ marginTop: '60px', borderTop: '2px solid #ff641e', paddingTop: '30px' }}>
            <h3>相关行业报告推荐</h3>
            <ul style={{ paddingLeft: '20px' }}>
              {relatedReports.map((rep) => (
                <li key={rep.id} style={{ margin: '12px 0' }}>
                  <Link href={`/reports/${rep.id}`} style={{ color: '#333', textDecoration: 'none', fontWeight: 500 }}>
                    [{rep.market_region}] {rep.title} ({rep.category === 'product' ? '品类报告' : '公司报告'})
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>
    );
  }

  export const getServerSideProps: GetServerSideProps = async (context) => {
    const { id } = context.params || {};
    const dbClient = await pool.connect();
    try {
      const artRes = await dbClient.query(
        `SELECT id, title, summary, content_html, region, country, industry, published_at 
         FROM articles WHERE id = $1`,
        [id]
      );

      if (artRes.rows.length === 0) {
        return { props: { article: null, relatedReports: [] } };
      }

      const article = artRes.rows[0];

      // 通过关联实体获取相同主体的付费报告推荐（限制 5 条）
      const relatedReportsRes = await dbClient.query(
        `SELECT DISTINCT r.id, r.title, r.category, r.market_region 
         FROM reports r
         JOIN report_entities re ON r.id = re.report_id
         WHERE re.entity_id IN (
             SELECT entity_id FROM article_entities WHERE article_id = $1
         ) LIMIT 5`,
        [id]
      );

      return {
        props: {
          article: {
            ...article,
            published_at: article.published_at.toISOString()
          },
          relatedReports: relatedReportsRes.rows
        }
      };
    } finally {
      dbClient.release();
    }
  };
  ```

- [ ] **步骤 3:: Commit**
  
  ```bash
  git add pages/news/index.tsx pages/news/[id].tsx
  git commit -m "feat: add news listing index page and news detail SSR SEO page"
  ```

---

### 任务 4：主页入口联动与资讯推荐区块

**文件：**
- 修改：`pages/index.tsx`

- [ ] **步骤 1：主页中集成资讯展示与喜好联动**
  
  修改 [pages/index.tsx](file:///Users/jason/Documents/Antigravity/Project/Globaltradebuddy/pages/index.tsx)，在主页 SSR 中获取初始资讯列表，在 Hero 区下方渲染每日资讯板块，在导航条渲染进入资讯页的入口链接。

  - 更新 `HomeProps` 接口以支持资讯数据：
    ```typescript
    interface HomeProps {
      // 现有属性...
      latestArticles: any[];
    }
    ```
  - 更新 `getServerSideProps`：
    ```typescript
    // 在最后返回 props 之前读取最新资讯数据
    const latestArticlesRes = await dbClient.query(
      `SELECT id, title, summary, region, country, industry, published_at 
       FROM articles ORDER BY published_at DESC LIMIT 6`
    );
    // 放入 props 返回
    ```
  - 在页面渲染组件时：
    1. 在 `Header`（导航栏）添加进入 `/news` 的链接标签。
    2. 在 `Hero`（页头）的正下方位置，渲染基于 `localStorage` 动态检索出的用户首选行业/国家的 3~6 条资讯，如未设置则展示 SSR 传入的 `latestArticles`。

- [ ] **步骤 2：进行编译构建检查**
  
  运行：`npm run build`
  预期：SUCCESS (完成全部 Next.js 静态及动态页面编译打包且无 TS 错误)

- [ ] **步骤 3：Commit**
  
  ```bash
  git add pages/index.tsx
  git commit -m "feat: link navigation links and display preference news block in homepage hero footer"
  ```
