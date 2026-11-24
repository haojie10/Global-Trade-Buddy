# 行业百科（Industry Wiki）模块设计规格说明书

**日期**：2026-11-24  
**模块名称**：行业百科（`Industry Wiki`）  
**路由前缀**：`/wiki`  
**项目架构基准**：腾讯云轻量应用服务器 + 自建 PostgreSQL + 腾讯云 COS + Next.js 14 (Pages Router)

---

## 1. 背景与目标

本模块用于承接 `MG推广` 项目（单源多发 COPE 管线）产出的「国家 × 品类」海外流通图谱与深度图文报告，在 `marketgraphic.cn` 上构建**完全免费开放、面向搜索引擎与 AI 生成式引擎（GEO）友好**的常青行业知识库。

### 核心业务目标
1. **公域引流承接**：无缝承接视频号、抖音、微信公众号末尾的 `marketgraphic.cn` 流量，提供比公众号图文更直观的交互式渠道流通图谱与价格瀑布体验。
2. **原生 GEO / SEO 流量收割**：免登录全量 SSR 输出，面向 ChatGPT Search、Perplexity、DeepSeek、豆包、Kimi、Google AI Overviews 与百度搜索提供高置信度结构化事实与机器直读端点（`/llms.txt`、`/wiki/[slug].md`、`FAQPage` / `Article` / `Dataset` JSON-LD）。
3. **站内商业化转化闭环**：通过玩家域名自动碰撞平台现有的 `reports`（客户 360° 研报）与 `crm_contacts`（19 万海外采购商库），在不泄露敏感联系人明细的前提下点亮站内跳转徽章，自然引导用户前往「报告大厅」解锁变现或提交定制需求。

### 全站导航与漏斗位置
顶部导航（`components/Navbar.tsx`）保持四字工整对齐，将 `行业百科` 插入 `每日资讯` 与 `报告大厅` 之间：
- `每日资讯` (`/news`)：免费短期动态
- **`行业百科` (`/wiki`)**：免费常青行业流通图谱与实战百科（新增）
- `报告大厅` (`/reports`)：付费深度买家/品类研报
- `个人图谱` (`/my-graph`)：用户沉淀的关系网络

---

## 2. 数据库设计（PostgreSQL）

新增迁移文件：`supabase/migrations/20261124000000_wiki_entries_schema.sql`（遵循仓库 `supabase/migrations/` 时间戳规范，确保生产迁移与 `tests/helpers/db-test-helper.ts` 隔离测试库自动建表一致）。

### 2.1 `wiki_entries` 表结构

| 字段名 | 类型 | 约束 / 默认值 | 说明 |
| :--- | :--- | :--- | :--- |
| `id` | `UUID` | `PRIMARY KEY DEFAULT gen_random_uuid()` | 主键 |
| `slug` | `VARCHAR(120)` | `UNIQUE NOT NULL` | 语义化英文路由键，如 `de-lighting`，作为幂等 Upsert 唯一键 |
| `title` | `VARCHAR(255)` | `NOT NULL` | 词条完整中文标题 |
| `summary` | `TEXT` | `NOT NULL` | 一句话核心结论（卡片摘要 + Meta Description + GEO TL;DR） |
| `country_code` | `VARCHAR(10)` | `NOT NULL` | 两位 ISO 国家代码，如 `DE` |
| `country_name` | `VARCHAR(100)` | `NOT NULL` | 国家中文名，如 `德国` |
| `market_region` | `VARCHAR(50)` | `NOT NULL DEFAULT '全球'` | 所属市场大区（通过 `lib/region-country-mapper.ts` 映射，如 `欧洲`） |
| `category_id` | `INT` | 可空 | 54 标准品类编号（1–54） |
| `industry_name` | `VARCHAR(100)` | `NOT NULL` | 54 标准品类中文名（对齐 `STANDARD_CATEGORIES`） |
| `hs_code_6` | `VARCHAR(12)` | 可空 | 6 位 HS 编码，如 `940542` |
| `archetype_id` | `VARCHAR(40)` | `NOT NULL` | 5 大流通原型：`mass_retail` / `diy_pro_dual` / `heavy_b2b` / `regulated_service` / `seasonal_custom` |
| `flow_data` | `JSONB` | `NOT NULL` | 标准 `MarketFlowData` 结构化 JSON |
| `content_md` | `TEXT` | `NOT NULL` | 深度图文长文（GFM Markdown） |
| `faq_items` | `JSONB` | `NOT NULL DEFAULT '[]'::jsonb` | 结构化问答数组 `Array<{ q: string; a: string }>` |
| `sources` | `JSONB` | `NOT NULL DEFAULT '[]'::jsonb` | 权威信源数组 `Array<{ title: string; url?: string; publisher?: string }>` |
| `video_url` | `TEXT` | 可空 | 腾讯云 COS 托管的 35 秒竖屏动态视频链接（空值隐藏） |
| `cover_image` | `TEXT` | 可空 | COS 封面图链接（OG / 微信分享卡片） |
| `status` | `VARCHAR(20)` | `NOT NULL DEFAULT 'published'` | `'draft' \| 'published'` |
| `view_count` | `INT` | `NOT NULL DEFAULT 0` | 累计阅读计数 |
| `baidu_pushed_at` | `TIMESTAMPTZ` | 可空 | 百度搜索资源平台最后推送时间 |
| `published_at` | `TIMESTAMPTZ` | `DEFAULT NOW()` | 发布时间 |
| `created_at` | `TIMESTAMPTZ` | `DEFAULT NOW()` | 创建时间 |
| `updated_at` | `TIMESTAMPTZ` | `DEFAULT NOW()` | 最后更新时间（SEO/GEO `dateModified`） |

### 2.2 索引与关联约束更新
- `idx_wiki_entries_status_pub` ON `wiki_entries (status, published_at DESC)`
- `idx_wiki_entries_industry` ON `wiki_entries (industry_name)`
- `idx_wiki_entries_country` ON `wiki_entries (country_code)`
- `idx_wiki_entries_archetype` ON `wiki_entries (archetype_id)`
- `idx_wiki_entries_baidu_pushed_at` ON `wiki_entries (baidu_pushed_at)`
- **扩展 `page_views` 约束**：现有 `page_views.content_type` 存在 `CHECK (content_type IN ('report', 'news'))`，本迁移同步放宽为 `CHECK (content_type IN ('report', 'news', 'wiki'))`，并在 `pages/api/track/pageview.ts` 新建 `content_type = 'wiki'` 记录时同步累加 `wiki_entries.view_count`。

---

## 3. 核心领域逻辑与数据结构 (`lib/wiki-schema.ts` & `lib/wiki-service.ts`)

### 3.1 数据契约与硬校验 (`lib/wiki-schema.ts`)
与 `MG推广/config/schema.ts` 完全对齐，使用纯 TypeScript 运行时校验器（零额外重型依赖，避免 ESM 打包问题）：
- `normalizeWikiSlug(raw: string): string`：转小写、下划线与空格转连字符 `-`、移除非法字符，强制匹配 `/^[a-z0-9]+(?:-[a-z0-9]+)*$/`。
- `validateMarketFlowData(input: unknown)`：校验：
  1. `meta`：`id`、`country_code`（2 位大写字母）、`country_name_cn`、`category_name_cn`、`hs_code_6`（可选或 6 位数字）、`archetype_id`（5 大枚举之一）。
  2. `supply_origin`：`local_manufacturing_pct + import_pct` 与 `100` 的绝对误差 `<= 0.5`。
  3. `flow_nodes`：至少 3 个节点，每个节点包含 `id`、`tier (1|2|3|4)`、`label_cn`、`share_pct`、`typical_margin_range`、`buyer_pain_points`（非空数组）、`sales_pitch_angle`、`players`（含 `name`、`website`、`business_model`、`logo_url?`）。
  4. `flow_edges`：至少 2 条边。
  5. `price_waterfall`：至少 3 个阶段，且 `price_usd_equiv` **严格单调递增**。
- `generateDefaultFaqs(flowData, title)`：当推送未显式提供 `faq_items` 时，基于真实数值自动生成 4 条高价值外贸高频问答（FOB 到终端加价倍率、主要进口来源格局、核心渠道玩家与毛利区间、业务员谈单切入策略）。
- `buildWikiMarkdownExport(entry)`：将 `wiki_entries` 记录组装为包含 YAML Frontmatter 摘要 + 供给表 + 价格瀑布表 + 渠道玩家表 + 深度长文 + FAQ + 来源声明 (`https://marketgraphic.cn/wiki/{slug}`) 的标准纯净 Markdown，专供 `/wiki/[slug].md` 与 AI 检索使用。

### 3.2 玩家资产批量联动 (`lib/wiki-service.ts`)
`matchPlayersWithPlatformAssets(flowData, dbClient)`：
1. 从 `flow_data.flow_nodes[].players[]` 提取所有玩家的 `extractRootDomain(player.website)` 与 `cleanCompanyNameForLookup(player.name)`（直接复用 `lib/crm-service.ts` 精确匹配规则，杜绝子串误匹配）。
2. 执行 **2 条批量 SQL**（无 N+1 查询）：
   - 查询 `reports` 表（利用已建索引 `idx_reports_website_domain`、`idx_reports_clean_company`），匹配该玩家对应的客户 360° 报告（返回 `reportId`、`reportTitle`）。
   - 查询 `crm_contacts` 表（利用已建索引 `idx_crm_contacts_comp_domain`），按 `website_domain` / `clean_company_name` 聚合统计 **`COUNT(DISTINCT email)`**，仅返回正整数 `contactCount`。
3. **隐私红线**：返回结果严格不包含任何邮箱、电话、姓名或 `source_session`。若 `crm_contacts` 查询超时或表不存在（如测试库未导入 CRM 数据），安全降级为 `contactCount: 0`，绝不阻塞百科页面渲染。

---

## 4. API 与同步管线设计

### 4.1 自动化推送接口：`POST /api/agent/wiki`
- **鉴权**：复用 `AGENT_API_KEY`（支持 `Authorization: Bearer <key>` 与 `x-agent-key`，与 `pages/api/agent/publish.ts` 一致）。
- **请求体**：
  - `slug`（可选，默认从 `flow_data.meta.id` 归一化生成）
  - `title`、`summary`、`flow_data`、`content_md`
  - 可选：`faq_items`、`sources`、`video_url`、`cover_image`、`status`（默认 `'published'`）
  - 可选：`logos?: Record<string, string>`（键为根域名如 `sonepar.de`，值为 `data:image/png;base64,...`），服务端自动调用扩展后的 `uploadWikiAsset()` 上传至腾讯云 COS `wiki-assets/logos/{domain}.{ext}` 并回写至 `flow_data` 中对应玩家的 `logo_url`。
- **行为**：严格校验 `flow_data` 与 `slug` → 自动补全 `market_region` 与默认 `faq_items` → 按 `slug` 执行 `INSERT ... ON CONFLICT (slug) DO UPDATE` 幂等落库 → 返回 `{ success: true, id, slug, url: '/wiki/' + slug, action: 'created' | 'updated' }`。
- **Body 上限**：配置 `api: { bodyParser: { sizeLimit: '10mb' } }` 以容纳多张 Base64 企业 Logo。

### 4.2 管理后台接口：`/api/admin/wiki`
- **鉴权**：严格使用 `requireAdmin(req)`（返回 403 拦截非管理员）。
- **方法**：
  - `GET /api/admin/wiki?page=1&pageSize=20&status=all&q=`：分页列表 + 筛选。
  - `GET /api/admin/wiki?id=<uuid>`：获取单条完整记录（含 `content_md`、`faq_items`、`sources`、`video_url`）。
  - `PUT /api/admin/wiki`：编辑标题、摘要、`content_md`、`faq_items`、`sources`、`video_url`、`cover_image`、`status`（支持快速上架/下架切换，自动刷新 `updated_at`）。
  - `DELETE /api/admin/wiki?id=<uuid>`：删除词条。

### 4.3 GEO 机器直读接口
- `GET /api/llms`（通过 `next.config.js` rewrite 暴露为 **`/llms.txt`**）：
  - `Content-Type: text/plain; charset=utf-8`、`Cache-Control: public, max-age=300, stale-while-revalidate=600`。
  - 按 `llmstxt.org` 标准输出平台定位、核心栏目入口及所有已发布行业百科词条列表（含一句话核心结论、HTML 链接、`.md` 直读链接）。
- `GET /api/wiki/[slug]/markdown`（通过 `next.config.js` rewrite 暴露为 **`/wiki/[slug].md`**）：
  - `Content-Type: text/markdown; charset=utf-8`、`Cache-Control: public, max-age=300, stale-while-revalidate=600`。
  - 仅返回 `status = 'published'` 的词条（不存在或草稿返回 404）。

---

## 5. 前端页面与组件设计

### 5.1 公共组件拆分（高内聚、零 `dangerouslySetInnerHTML` 正文渲染）
- `components/wiki/SafeMarkdown.tsx`：纯 React GFM Markdown 渲染组件（支持 H2–H4 自动生成锚点 `id`、段落、粗体/斜体/行内代码、安全链接协议白名单、引用块、有序/无序列表、响应式表格、图片、分隔线；并导出 `extractTocHeadings(md)` 生成章节目录）。
- `components/wiki/WikiPriceWaterfall.tsx`：使用 `recharts` 渲染价格瀑布柱状图（`FOB` → 终端零售含税价与加价倍率），**并在图表下方同步渲染语义化 HTML `<table>` 价格明细表**，保证用户速查与 AI 爬虫零 JS 直读。
- `components/wiki/WikiFlowMap.tsx`：分层（Tier 1–4）渠道流通可视化与白色圆角企业 Logo 墙（`#FFFFFF` 底板 + `object-fit: contain` + 失败降级 Monogram 徽章）；点击/切换渠道节点展示 `+Margin`、买家核心痛点与谈单切入话术；玩家卡片展示站内匹配结果（`深度研报` 链接与 `已收录 N 位采购联系人` 转化徽章）；并同步输出简洁可读的语义化渠道摘要数据供爬虫抓取。
- `components/wiki/WikiEntryCard.tsx`：百科大厅卡片组件，展示国家、品类、HS 编码、流通原型标签、FOB→终端倍率亮点与摘要。
- `components/wiki/JsonLdScript.tsx`：专用于 `<Head>` 中输出 Schema.org `application/ld+json` 的受控封装组件，仅接收纯 JSON 对象并进行 `<` → `\u003c` 严格转义，绝不接收任意 HTML 字符串。

### 5.2 前台页面
- `pages/wiki/index.tsx`（行业百科大厅）：
  - 全量 SSR，完全公开免登录。
  - 筛选栏：关键词搜索、市场大区下拉、54 标准品类筛选、5 大流通原型快捷标签。
  - 初始展示 20 条、触底无限加载每次追加 12 条（对齐 `pages/reports/index.tsx` 与 `pages/news/index.tsx` 体验）。
- `pages/wiki/[slug].tsx`（行业百科详情页）：
  - 全量 SSR（仅 `status = 'published'` 对公众可见；未命中返回 `notFound: true` 404）。
  - 区块顺序：
    1. 面包屑 + 标题 + 元数据徽章（国家、标准品类、HS 编码、原型、更新日期）+ 复制纯净 Markdown 链接按钮
    2. 顶部 GEO 核心事实速览卡（本土/进口占比、FOB→终端倍率、收录玩家数）+ 可选 35 秒竖屏视频播放器（仅 `video_url` 存在时渲染）
    3. 供给源头格局条 + Top 进口来源国卡片
    4. 价格瀑布图 + 语义化价格阶梯明细表（`WikiPriceWaterfall`）
    5. 分层渠道流通图谱 + 玩家 Logo 墙与站内研报/买手联动（`WikiFlowMap`）
    6. 深度实操长文（`SafeMarkdown` + 右侧/顶部章节目录 TOC）+ 权威信源区
    7. 高频问答区（FAQ，与 `FAQPage` JSON-LD 100% 同步）
    8. 同品类/同国家「报告大厅」深度研报推荐 + 「报告定制」入口
  - 页面浏览追踪：复用 `/api/track/pageview`（`content_type: 'wiki'`）并异步累加 `wiki_entries.view_count`。

### 5.3 后台轻量管理页 (`pages/admin/wiki.tsx`)
- 使用 `AdminLayout`（`currentPage="wiki"`）。
- 列表视图：展示标题、Slug、国家/品类、原型、状态徽章、浏览数、更新时间，支持搜索、状态筛选、一键切换上架/下架、预览前台、编辑、删除。
- 编辑视图：修改标题、摘要、`content_md`（带实时 `SafeMarkdown` 预览切换）、`video_url`、`cover_image`、`faq_items`（JSON 或条目列表编辑）、`status`。

---

## 6. 原生 GEO / SEO 与安全配置更新

1. **`next.config.js`**：
   - `rewrites()` 使用 `{ beforeFiles, afterFiles }` 结构：在 `beforeFiles` 中配置 `/llms.txt` → `/api/llms` 与 `/wiki/:slug.md` → `/api/wiki/:slug/markdown`（确保优先于动态路由 `pages/wiki/[slug].tsx` 命中），原百度验证重写保留在 `afterFiles`。
   - CSP 响应头新增 `media-src 'self' blob: https:`，确保腾讯云 COS 托管的 Remotion 短视频可正常播放。
2. **`public/robots.txt`**：
   - 显式声明放行 `GPTBot`、`OAI-SearchBot`、`ChatGPT-User`、`PerplexityBot`、`ClaudeBot`、`Google-Extended`、`Bytespider`、`Baiduspider` 访问 `/wiki`、`/llms.txt` 等公开内容，保持 `Disallow: /admin/` 与 `/api/`（通过 rewrite 访问 `/llms.txt` 与 `/wiki/*.md`）。
3. **`pages/sitemap.xml.tsx`**：
   - 查询 `wiki_entries WHERE status = 'published'`，输出 `/wiki`（priority `0.9`）与所有 `/wiki/{slug}`（priority `0.85`）。
4. **`bin/push-to-baidu.js`**：
   - 在每日百度主动推送队列中纳入未推送的 `wiki_entries`（`baidu_pushed_at IS NULL` 优先，推送成功后更新 `baidu_pushed_at = NOW()`）。
5. **导航与页脚**：
   - `components/Navbar.tsx`（PC 端与移动端抽屉菜单）与 `components/Footer.tsx` 均补充 `行业百科` (`/wiki`) 入口。
   - `components/admin/AdminLayout.tsx` 侧边栏补充 `📚 行业百科` (`/admin/wiki`) 入口。

---

## 7. 验证与测试策略（Vitest）

1. **`tests/wiki-schema.test.ts`**：`normalizeWikiSlug`、`validateMarketFlowData`（算术占比和=100、价格严格递增、缺字段报错）、`generateDefaultFaqs`、`buildWikiMarkdownExport`、安全 Markdown 协议过滤与 TOC 提取单测。
2. **`tests/wiki-api.test.ts`**：
   - `POST /api/agent/wiki` 鉴权拦截（401）、脏数据拦截（400）、首次创建（200 created）、同 `slug` 幂等更新（200 updated）。
   - `GET/PUT/DELETE /api/admin/wiki` 非管理员拦截（403）与管理员完整 CRUD 流程。
   - `GET /api/llms` 与 `GET /api/wiki/[slug]/markdown` 输出格式与草稿 404 隔离验证。
   - `matchPlayersWithPlatformAssets` 域名匹配与隐私脱敏（确保不返回 email / `source_session`）验证。
3. **全量构建验证**：运行 `npx vitest run` 与 `npm.cmd run build`，确保 TypeScript 零报错、所有新老测试全绿。
