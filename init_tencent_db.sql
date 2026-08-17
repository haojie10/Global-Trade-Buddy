-- GlobalTradeBuddy 全量数据库初始化脚本 (适用于腾讯云轻量服务器自建 PostgreSQL)

-- 启用 UUID 与加密扩展
CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. 用户表 (users)
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    phone_number VARCHAR(20) UNIQUE,
    email VARCHAR(100) UNIQUE,
    password TEXT,
    role VARCHAR(20) DEFAULT 'user',
    nickname VARCHAR(50),
    free_quota INT DEFAULT 3,
    member_type VARCHAR(10) DEFAULT 'free',
    invited_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMP DEFAULT NOW()
);

-- 2. 实体库 (entities)
CREATE TABLE IF NOT EXISTS entities (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    canonical_name VARCHAR(255) NOT NULL UNIQUE,
    entity_type VARCHAR(50) NOT NULL, -- 'company' | 'product' | 'location'
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- 3. 实体别名映射 (entity_aliases)
CREATE TABLE IF NOT EXISTS entity_aliases (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    alias_name VARCHAR(255) NOT NULL UNIQUE,
    entity_id UUID NOT NULL REFERENCES entities(id) ON DELETE CASCADE,
    created_at TIMESTAMP DEFAULT NOW()
);

-- 4. 报告主表 (reports)
CREATE TABLE IF NOT EXISTS reports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title VARCHAR(255) NOT NULL,
    category VARCHAR(20) CHECK (category IN ('customer', 'product')),
    market_region VARCHAR(50),
    summary TEXT,
    content_html TEXT,
    primary_entity_id UUID REFERENCES entities(id) ON DELETE SET NULL,
    created_at TIMESTAMP DEFAULT NOW()
);

-- 5. 报告-实体多对多关联 (report_entities)
CREATE TABLE IF NOT EXISTS report_entities (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    report_id UUID NOT NULL REFERENCES reports(id) ON DELETE CASCADE,
    entity_id UUID NOT NULL REFERENCES entities(id) ON DELETE CASCADE,
    role VARCHAR(50) NOT NULL,
    created_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(report_id, entity_id, role)
);

-- 6. 用户解锁关系表 (unlocks)
CREATE TABLE IF NOT EXISTS unlocks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    report_id UUID REFERENCES reports(id) ON DELETE CASCADE,
    unlocked_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(user_id, report_id)
);

-- 7. 报告图谱拓扑边表 (relations)
CREATE TABLE IF NOT EXISTS relations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    report_id_a UUID REFERENCES reports(id) ON DELETE CASCADE,
    report_id_b UUID REFERENCES reports(id) ON DELETE CASCADE,
    relation_key VARCHAR(100),
    market_region VARCHAR(50),
    relation_type VARCHAR(50) DEFAULT 'mention',
    created_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(report_id_a, report_id_b, relation_key)
);

-- 8. 实体间直连关系表 (entity_relations)
CREATE TABLE IF NOT EXISTS entity_relations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    entity_id_a UUID NOT NULL REFERENCES entities(id) ON DELETE CASCADE,
    entity_id_b UUID NOT NULL REFERENCES entities(id) ON DELETE CASCADE,
    relation_type VARCHAR(50) NOT NULL,
    market_region VARCHAR(50),
    created_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(entity_id_a, entity_id_b, relation_type, market_region)
);

-- 9. 个人笔记表 (notes)
CREATE TABLE IF NOT EXISTS notes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    report_id UUID REFERENCES reports(id) ON DELETE CASCADE,
    content TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- 10. 报告收藏表 (favorites)
CREATE TABLE IF NOT EXISTS favorites (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    report_id UUID REFERENCES reports(id) ON DELETE CASCADE,
    created_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(user_id, report_id)
);

-- 11. 邮箱验证码表 (email_verifications)
CREATE TABLE IF NOT EXISTS email_verifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(100) NOT NULL,
    code VARCHAR(10) NOT NULL,
    expires_at TIMESTAMP NOT NULL,
    created_at TIMESTAMP DEFAULT NOW()
);

-- 12. 行业与国家标准表 (industries / countries)
CREATE TABLE IF NOT EXISTS industries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) UNIQUE NOT NULL,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS countries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) UNIQUE NOT NULL,
    code VARCHAR(10) UNIQUE,
    created_at TIMESTAMP DEFAULT NOW()
);

-- 13. 报告分类关联表 (report_industries / report_countries)
CREATE TABLE IF NOT EXISTS report_industries (
    report_id UUID REFERENCES reports(id) ON DELETE CASCADE,
    industry_id UUID REFERENCES industries(id) ON DELETE CASCADE,
    PRIMARY KEY (report_id, industry_id)
);

CREATE TABLE IF NOT EXISTS report_countries (
    report_id UUID REFERENCES reports(id) ON DELETE CASCADE,
    country_id UUID REFERENCES countries(id) ON DELETE CASCADE,
    PRIMARY KEY (report_id, country_id)
);

-- 14. 页面浏览与搜索日志 (page_views / search_logs)
CREATE TABLE IF NOT EXISTS page_views (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    page_url VARCHAR(255) NOT NULL,
    ip_address VARCHAR(50),
    user_agent TEXT,
    viewed_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS search_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    keyword VARCHAR(255) NOT NULL,
    result_count INT DEFAULT 0,
    created_at TIMESTAMP DEFAULT NOW()
);

-- 15. 快讯与资讯表 (news / news_industries / news_countries)
CREATE TABLE IF NOT EXISTS news (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title VARCHAR(255) NOT NULL,
    summary TEXT,
    content_html TEXT,
    source_url VARCHAR(500),
    publish_time TIMESTAMP DEFAULT NOW(),
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS news_industries (
    news_id UUID REFERENCES news(id) ON DELETE CASCADE,
    industry_id UUID REFERENCES industries(id) ON DELETE CASCADE,
    PRIMARY KEY (news_id, industry_id)
);

CREATE TABLE IF NOT EXISTS news_countries (
    news_id UUID REFERENCES news(id) ON DELETE CASCADE,
    country_id UUID REFERENCES countries(id) ON DELETE CASCADE,
    PRIMARY KEY (news_id, country_id)
);

-- 16. 知识与推文表 (articles / article_entities)
CREATE TABLE IF NOT EXISTS articles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title VARCHAR(255) NOT NULL,
    summary TEXT,
    content_html TEXT,
    cover_image VARCHAR(500),
    published_at TIMESTAMP DEFAULT NOW(),
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS article_entities (
    article_id UUID REFERENCES articles(id) ON DELETE CASCADE,
    entity_id UUID REFERENCES entities(id) ON DELETE CASCADE,
    PRIMARY KEY (article_id, entity_id)
);

-- 17. 热门搜索与聚合表 (hot_keywords / daily_stats_summary)
CREATE TABLE IF NOT EXISTS hot_keywords (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    keyword VARCHAR(255) UNIQUE NOT NULL,
    search_count INT DEFAULT 1,
    last_searched_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS daily_stats_summary (
    stat_date DATE PRIMARY KEY,
    pv_count INT DEFAULT 0,
    uv_count INT DEFAULT 0,
    new_users_count INT DEFAULT 0,
    active_users_count INT DEFAULT 0,
    created_at TIMESTAMP DEFAULT NOW()
);

-- 18. 预置初始化一个默认管理员账户（账号: 13800138000 或 admin@globaltradebuddy.com，密码: 123456）
INSERT INTO users (phone_number, email, password, role, nickname, free_quota)
VALUES (
  '13800138000', 
  'admin@globaltradebuddy.com', 
  '$2a$10$EixZaYVK1fsbw1ZfbX3OXePaWxn96p36WQoeg6Lruj3vjPGga31lW', 
  'admin', 
  '超级管理员', 
  999999
)
ON CONFLICT (email) DO NOTHING;

-- 19. 核心性能索引 (Performance Indexes)
CREATE INDEX IF NOT EXISTS idx_relations_report_b ON relations(report_id_b);
CREATE INDEX IF NOT EXISTS idx_entity_relations_b ON entity_relations(entity_id_b);
CREATE INDEX IF NOT EXISTS idx_report_entities_entity ON report_entities(entity_id);
CREATE INDEX IF NOT EXISTS idx_reports_created_at ON reports(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_news_published ON news(status, published_at DESC);
CREATE INDEX IF NOT EXISTS idx_page_views_created_at ON page_views(created_at);
CREATE INDEX IF NOT EXISTS idx_search_logs_created_at ON search_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_email_verif_expires ON email_verifications(expired_at);

