# 每日资讯功能设计规格书

## 1. 背景与目标

### 问题
当前 Global Trade Buddy 平台的内容形态只有"报告（Reports）"，需要解锁才能查看，且报告详情以展示框方式呈现，无法被搜索引擎有效收录，不利于 SEO 和自然流量获取。

### 目标
新增"每日资讯（Articles）"内容模块，作为平台的公开内容层，实现以下目标：
- **SEO 引流**：每篇资讯是一个独立的、可被搜索引擎索引的真实网页。
- **内容丰富度**：通过手动上传和外部 Agent 自动推送两种方式持续产出内容。
- **实体关联**：资讯与现有报告共享同一套实体标签系统（`entities` 表），使资讯中提到的公司、产品、渠道能与报告形成关联。

### 与现有报告的核心区别

| 维度 | 报告 (Reports) | 资讯 (Articles) |
|------|----------------|-----------------|
| 访问权限 | 需消耗额度解锁 | 全文公开免费 |
| 呈现方式 | 展示框内渲染 | 独立的完整网页 |
| SEO | 不可被搜索引擎收录 | 可被搜索引擎收录，SSR 渲染 |
| 定位 | 核心付费内容 | 引流与用户留存 |

---

## 2. 数据模型

### 2.1 新增 `articles` 表

```sql
CREATE TABLE IF NOT EXISTS articles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title VARCHAR(200) NOT NULL,
    summary TEXT,
    content_html TEXT NOT NULL,
    region VARCHAR(100),        -- 区域，如"欧洲"、"中东"、"东南亚"
    country VARCHAR(100),       -- 国家，如"俄罗斯"、"德国"
    industry VARCHAR(100),      -- 行业，如"汽配"、"玩具"、"家居"
    source VARCHAR(20) NOT NULL DEFAULT 'manual',  -- 'manual' | 'agent'
    published_at TIMESTAMP DEFAULT NOW(),
    created_at TIMESTAMP DEFAULT NOW()
);
```

### 2.2 新增 `article_entities` 关联表

```sql
CREATE TABLE IF NOT EXISTS article_entities (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    article_id UUID REFERENCES articles(id) ON DELETE CASCADE,
    entity_id UUID REFERENCES entities(id) ON DELETE CASCADE,
    role VARCHAR(50),           -- 实体在该资讯中的角色
    created_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(article_id, entity_id)
);
```

### 2.3 与现有表的关系

- `article_entities` 通过 `entity_id` 连接到已有的 `entities` 表，与 `report_entities` 共享同一套实体。
- 不新增任何字段到现有的 `reports`、`entities`、`users` 等表。
- 在市场图谱中，资讯和报告可以通过共享实体节点产生关联线。

---

## 3. API 端点

### 3.1 外部 Agent 统一推送接口

**端点**：`POST /api/agent/publish`

**鉴权**：通过请求头传入 API Key：
```
Authorization: Bearer <API_KEY>
```
API Key 在服务端通过环境变量 `AGENT_API_KEY` 配置。

**请求体**：
```json
{
  "type": "article",
  "title": "俄罗斯玩具市场 Q3 动态",
  "summary": "2026年第三季度俄罗斯玩具市场的最新趋势...",
  "contentHtml": "<div>正文内容...</div>",
  "region": "欧洲",
  "country": "俄罗斯",
  "industry": "玩具",
  "tags": {
    "companies": ["Detsky Mir", "儿童世界"],
    "products": ["毛绒玩具"],
    "regions": ["俄罗斯"]
  }
}
```

**`type` 字段决定内容类型**：
- `type = "article"`：写入 `articles` 表，`source` 设为 `agent`，执行实体标签匹配与归并。
- `type = "report"`：走现有的报告上传流程（脱水处理、实体提取、查重判定、关系自动推理等），`manualTags` 使用 `tags` 字段的内容。

**响应**：
```json
{
  "success": true,
  "id": "uuid-of-created-content",
  "type": "article"
}
```

### 3.2 管理员手动上传资讯

**端点**：`POST /api/admin/articles/create`

**鉴权**：管理员 Cookie Session。

**请求体**：与 Agent 推送接口的 `article` 类型结构一致，但 `source` 自动设为 `manual`。同样支持 `tags` 字段进行实体标签关联。

同样执行图片脱水处理（提取 Base64 内联图片并转存为静态文件）。

### 3.3 公开资讯列表接口

**端点**：`GET /api/articles`

**鉴权**：无（公开接口）。

**查询参数**：
| 参数 | 说明 | 示例 |
|------|------|------|
| `region` | 按区域筛选 | `?region=欧洲` |
| `country` | 按国家筛选 | `?country=俄罗斯` |
| `industry` | 按行业筛选 | `?industry=玩具` |
| `page` | 分页页码 | `?page=2` |
| `pageSize` | 每页条数（默认 20） | `?pageSize=10` |

**响应**：
```json
{
  "articles": [
    {
      "id": "...",
      "title": "...",
      "summary": "...",
      "region": "欧洲",
      "country": "俄罗斯",
      "industry": "玩具",
      "published_at": "2026-07-12T00:00:00Z"
    }
  ],
  "total": 128,
  "page": 1,
  "pageSize": 20
}
```

---

## 4. 前端页面

### 4.1 主页资讯区域
- 位于 Hero 区域下方。
- 展示最新 3~6 条资讯卡片（标题 + 摘要 + 区域/行业标签 + 发布时间）。
- 点击卡片跳转到资讯详情页。

### 4.2 导航栏
- 新增"资讯"按钮，点击跳转到资讯列表页。

### 4.3 资讯列表页（独立页面）
- 提供区域、国家、行业三个维度的筛选器。
- 用户的筛选偏好存入浏览器 `localStorage`，下次访问时自动恢复。
- 支持分页。
- 使用 SSR（`getServerSideProps`）渲染以确保搜索引擎可索引。

### 4.4 资讯详情页（独立页面）
- 每篇资讯是一个**完整独立的网页**，不在弹窗或展示框中渲染。
- 使用 SSR 渲染，输出完整 HTML。
- 包含完善的 SEO 元素：
  - `<title>` 标签：使用资讯标题。
  - `<meta name="description">`：使用资讯摘要。
  - Open Graph 标签（`og:title`, `og:description`, `og:type` 等）。
  - 语义化 HTML 结构（`<article>`, `<h1>`, `<time>` 等）。
- 底部可展示关联的其他资讯或相关报告。

---

## 5. 不做规定的部分（交给实现者自由发挥）

以下内容本规格书**不做限定**：
- 资讯页面的 UI 风格、配色、布局与交互动效。
- URL 路由结构（如 `/news/[id]`、`/news/[slug]` 等）。
- 筛选器的具体交互形式（下拉菜单、标签云、侧边栏等）。
- 首页资讯卡片的展示风格与数量。
- 是否生成 `sitemap.xml`。
- 资讯详情页的具体排版与阅读体验设计。
- 前端框架或 UI 库选择。

---

## 6. 实体标签处理流程

无论是手动上传还是 Agent 推送，资讯的实体标签处理遵循以下流程：

1. **解析 `tags` 字段**：提取 `companies`、`products`、`channels`、`regions` 等列表。
2. **实体匹配与创建**：对每个标签名，在 `entities` 表和 `entity_aliases` 表中查找是否已存在。如存在则复用其 `entity_id`，如不存在则创建新实体。
3. **写入 `article_entities`**：将资讯 ID 与匹配到的实体 ID 关联写入。
4. **别名归并**：如果 `tags.companies` 中有多个名称指向同一个实体，自动归并为别名。

此流程与现有报告上传中的实体处理逻辑保持一致。
