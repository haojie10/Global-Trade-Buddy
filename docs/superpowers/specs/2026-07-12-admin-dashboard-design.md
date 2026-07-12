# GTB 管理后台设计规格

> 日期: 2026-07-12
> 状态: 待审核

## 1. 项目目标

为 Global Trade Buddy (GTB) 搭建一个**内容策略决策工具**——管理后台，帮助创始人：
- 盘点现有内容资产（报告 + 资讯）的行业/区域/国家分布
- 追踪用户行为（浏览、停留、搜索、解锁），识别内容消费热点
- 发现内容缺口和行业趋势，指导报告和资讯的产出方向
- 统一管理报告上传、资讯发布、标签维护

## 2. 使用者

仅创始人本人（admin 角色），无需多用户权限体系。

## 3. 设计决策摘要

| 决策项 | 选择 |
|--------|------|
| 布局 | 独立全屏页面 `/admin`，经典侧边栏 + 多页面 |
| 主题 | 暗色系 (深色背景 + 紫色主色调 `#7c6fff`) |
| 总览风格 | 指标优先型：KPI 卡片 → 图表 → 预警列表 |
| 行业维度 | 新增 `industries` 参照表 + 报告/资讯关联 |
| 地理维度 | 两级结构：区域(Region) → 国家(Country) |
| 行为追踪 | 中等精度：页面浏览次数、停留时长、搜索关键词 |
| 资讯功能 | 独立模块，标签体系与报告统一 |

## 4. 信息架构 (侧边栏 7 个模块)

```
🌐 GTB Admin
├── 📊 数据总览 (/admin)
├── 📋 内容分析 (/admin/content)
├── 👥 用户分析 (/admin/users)
├── 🔥 趋势洞察 (/admin/trends)
├── 📤 报告管理 (/admin/reports)
├── 📰 资讯管理 (/admin/news)
├── 🔗 邀请转化 (/admin/referrals)
└── ⚙️ 设置    (/admin/settings)
```

## 5. 各模块详细设计

### 5.1 📊 数据总览

**布局**: 时间范围筛选器 → 6 个 KPI 卡片 → 双栏图表 → 三栏预警

**KPI 卡片 (带环比变化)**:
| KPI | 数据来源 |
|-----|---------|
| 总报告数 | `COUNT(reports)` |
| 注册用户数 | `COUNT(users)` |
| 总浏览次数 | `SUM(page_views)` (新表) |
| 平均停留时长 | `AVG(page_views.duration_seconds)` |
| 解锁率 | `COUNT(unlocks) / COUNT(page_views WHERE type='report')` |
| 过期报告预警 | `COUNT(reports WHERE created_at < NOW() - 90 days)` |

**图表区**:
- 左: 浏览量趋势折线图 (按日/周切换)
- 右: 热门报告 Top 5 排行

**预警区 (三栏)**:
- 🔍 搜索缺口 (无结果的关键词 + 搜索次数)
- ⚠️ 过期报告 (超过 90 天未更新)
- 👥 用户活跃分层 (高/中/沉默)

### 5.2 📋 内容分析

- **行业 × 区域热力图矩阵**: 行列交叉展示报告数量密度
- **按行业/区域/国家的筛选表格**: 可展开收起的树形结构
- **报告新鲜度看板**: 按上传时间排序，色彩标记老化程度 (绿→黄→红)
- **内容缺口建议**: 综合搜索缺口 + 用户关注维度 vs 现有报告覆盖

### 5.3 👥 用户分析

- **用户增长曲线**: 按日/周/月的新增注册折线图
- **行为热力**: 哪些报告被看最多、停留最久 (表格 + 条形图)
- **搜索关键词排行**: 含"无结果"红色标记
- **用户活跃分层**: 高活跃 (7天内有行为) / 中活跃 (30天内) / 沉默 (>30天)
- **用户地域 vs 报告覆盖**: 用户关注的区域 vs 现有报告的区域，可视化匹配度

### 5.4 🔥 趋势洞察

- **实体热度排行**: 按浏览量/关联报告数排序，显示趋势箭头
- **热度趋势折线**: 选定实体的关注度随时间变化
- **新兴关键词**: 最近 7/30 天新出现的搜索词
- **行业关注度变化**: 各行业的浏览量环比增减

### 5.5 📤 报告管理

- **迁移现有 AdminPanel**: 上传报告、编辑、删除功能
- **新增标签管理**: 行业标签、国家标签的选择器 (上传时选择)
- **报告列表**: 支持按行业/区域/国家/类别筛选、关键词搜索
- **批量操作**: 批量打标签、批量删除

### 5.6 📰 资讯管理

**资讯数据模型**:
- 标题、摘要、正文 (富文本或 Markdown)
- 来源链接 (可选)
- 行业标签、区域、国家 (与报告共享标签体系)
- 发布状态 (草稿/已发布)
- 发布时间

**管理功能**:
- 资讯 CRUD (创建、编辑、删除、发布/取消发布)
- 资讯列表：按行业/区域/国家/时间筛选
- 资讯数据分析: 浏览量排行、热门行业/区域分布

**前台展示** (主页新增):
- "每日资讯"模块，展示最新资讯列表
- 支持按行业/区域筛选
- 点击进入资讯详情页

### 5.7 🔗 邀请转化

- **邀请漏斗**: 发出邀请 → 注册 → 首次解锁 → 持续活跃 (漏斗图)
- **邀请人排行**: 谁邀请的人最多 (表格)
- **转化率指标**: 邀请注册率、激活率

## 6. 数据库设计

### 6.1 新增表

```sql
-- 行业参照表
CREATE TABLE industries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(50) UNIQUE NOT NULL,  -- 如: 汽配、家居建材、照明
    created_at TIMESTAMP DEFAULT NOW()
);

-- 国家参照表 (含区域映射)
CREATE TABLE countries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(50) UNIQUE NOT NULL,   -- 如: 美国、德国、日本
    region VARCHAR(50) NOT NULL,         -- 如: 北美、欧洲、亚太
    code VARCHAR(5),                     -- ISO 代码: US, DE, JP
    created_at TIMESTAMP DEFAULT NOW()
);

-- 报告-行业关联 (多对多)
CREATE TABLE report_industries (
    report_id UUID REFERENCES reports(id) ON DELETE CASCADE,
    industry_id UUID REFERENCES industries(id) ON DELETE CASCADE,
    PRIMARY KEY (report_id, industry_id)
);

-- 报告-国家关联 (多对多)
CREATE TABLE report_countries (
    report_id UUID REFERENCES reports(id) ON DELETE CASCADE,
    country_id UUID REFERENCES countries(id) ON DELETE CASCADE,
    PRIMARY KEY (report_id, country_id)
);

-- 页面浏览追踪
CREATE TABLE page_views (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    content_type VARCHAR(10) NOT NULL CHECK (content_type IN ('report', 'news')),
    content_id UUID NOT NULL,              -- 报告ID 或 资讯ID
    duration_seconds INT DEFAULT 0,        -- 停留时长
    created_at TIMESTAMP DEFAULT NOW()
);

-- 搜索日志
CREATE TABLE search_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    query VARCHAR(200) NOT NULL,
    results_count INT DEFAULT 0,           -- 0 = 无结果
    created_at TIMESTAMP DEFAULT NOW()
);

-- 资讯表
CREATE TABLE news (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title VARCHAR(255) NOT NULL,
    summary TEXT,
    content TEXT,                           -- 正文 (Markdown)
    source_url VARCHAR(500),               -- 来源链接
    status VARCHAR(10) DEFAULT 'draft' CHECK (status IN ('draft', 'published')),
    published_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- 资讯-行业关联
CREATE TABLE news_industries (
    news_id UUID REFERENCES news(id) ON DELETE CASCADE,
    industry_id UUID REFERENCES industries(id) ON DELETE CASCADE,
    PRIMARY KEY (news_id, industry_id)
);

-- 资讯-国家关联
CREATE TABLE news_countries (
    news_id UUID REFERENCES news(id) ON DELETE CASCADE,
    country_id UUID REFERENCES countries(id) ON DELETE CASCADE,
    PRIMARY KEY (news_id, country_id)
);
```

### 6.2 索引

```sql
CREATE INDEX idx_page_views_content ON page_views(content_type, content_id);
CREATE INDEX idx_page_views_user ON page_views(user_id);
CREATE INDEX idx_page_views_created ON page_views(created_at);
CREATE INDEX idx_search_logs_query ON search_logs(query);
CREATE INDEX idx_search_logs_created ON search_logs(created_at);
CREATE INDEX idx_news_status ON news(status, published_at);
```

### 6.3 预置数据

```sql
-- 常见行业
INSERT INTO industries (name) VALUES
('汽车零部件'), ('家居建材'), ('园艺工具'), ('照明电器'),
('消费电子'), ('环保包装'), ('紧固件'), ('工程机械');

-- 常见国家+区域
INSERT INTO countries (name, region, code) VALUES
('美国', '北美', 'US'), ('加拿大', '北美', 'CA'), ('墨西哥', '北美', 'MX'),
('德国', '欧洲', 'DE'), ('英国', '欧洲', 'GB'), ('法国', '欧洲', 'FR'),
('日本', '亚太', 'JP'), ('韩国', '亚太', 'KR'), ('澳大利亚', '亚太', 'AU'),
('巴西', '南美', 'BR'), ('阿联酋', '中东', 'AE'), ('沙特', '中东', 'SA'),
('俄罗斯', '独联体', 'RU'), ('南非', '非洲', 'ZA');
```

## 7. 前端埋点设计

### 7.1 页面浏览追踪

在报告详情页 (`/reports/[id]`) 和资讯详情页 (新增) 中:
- **进入时**: 调用 `POST /api/track/pageview` 记录 `content_type` + `content_id`，返回 `view_id`
- **离开时**: 通过 `navigator.sendBeacon` 调用 `PATCH /api/track/pageview` 更新 `duration_seconds`
- 使用 `visibilitychange` 事件处理标签页切换场景

### 7.2 搜索追踪

在图谱搜索和报告列表搜索中:
- 用户触发搜索时调用 `POST /api/track/search`
- 记录搜索词和结果数量
- 防抖处理，避免打字过程中重复记录

## 8. API 设计

### 8.1 Admin 数据接口

| 路由 | 方法 | 说明 |
|------|------|------|
| `/api/admin/stats/overview` | GET | 总览 KPI + 环比数据 |
| `/api/admin/stats/content` | GET | 内容分析 (行业/区域分布) |
| `/api/admin/stats/users` | GET | 用户分析 (增长/行为/分层) |
| `/api/admin/stats/trends` | GET | 趋势洞察 (实体热度/新兴词) |
| `/api/admin/stats/referrals` | GET | 邀请转化漏斗 |
| `/api/admin/news` | CRUD | 资讯管理 |
| `/api/admin/industries` | CRUD | 行业标签管理 |
| `/api/admin/countries` | GET | 国家/区域列表 |

### 8.2 埋点接口

| 路由 | 方法 | 说明 |
|------|------|------|
| `/api/track/pageview` | POST | 记录页面浏览 |
| `/api/track/pageview` | PATCH | 更新停留时长 |
| `/api/track/search` | POST | 记录搜索行为 |

### 8.3 前台资讯接口

| 路由 | 方法 | 说明 |
|------|------|------|
| `/api/news` | GET | 获取已发布资讯列表 |
| `/api/news/[id]` | GET | 获取资讯详情 |

## 9. 前台资讯模块 (主页)

在首页新增"每日资讯"板块:
- 展示最新 5-10 条已发布资讯 (标题 + 摘要 + 行业标签 + 时间)
- 支持按行业/区域筛选
- 点击进入 `/news/[id]` 资讯详情页
- 资讯详情页结构: 标题 + 发布时间 + 来源链接 + 正文 + 相关报告推荐

## 10. 技术栈

- **前端**: Next.js (现有) + 原生 CSS (暗色主题变量)
- **图表**: 轻量 SVG 图表 (手写或用 recharts/chart.js)
- **后端**: Next.js API Routes (现有模式)
- **数据库**: PostgreSQL (Supabase, 现有)
- **埋点**: 自建轻量埋点 (navigator.sendBeacon)
