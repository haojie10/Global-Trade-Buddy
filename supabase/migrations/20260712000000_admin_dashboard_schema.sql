-- ==========================================
-- GTB 管理后台: 数据库扩展
-- 新增行业/国家参照表、行为追踪表、资讯表
-- ==========================================

-- 1. 行业参照表
CREATE TABLE IF NOT EXISTS industries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(50) UNIQUE NOT NULL,
    created_at TIMESTAMP DEFAULT NOW()
);

-- 2. 国家参照表 (含区域映射)
CREATE TABLE IF NOT EXISTS countries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(50) UNIQUE NOT NULL,
    region VARCHAR(50) NOT NULL,
    code VARCHAR(5),
    created_at TIMESTAMP DEFAULT NOW()
);

-- 3. 报告-行业关联 (多对多)
CREATE TABLE IF NOT EXISTS report_industries (
    report_id UUID REFERENCES reports(id) ON DELETE CASCADE,
    industry_id UUID REFERENCES industries(id) ON DELETE CASCADE,
    PRIMARY KEY (report_id, industry_id)
);

-- 4. 报告-国家关联 (多对多)
CREATE TABLE IF NOT EXISTS report_countries (
    report_id UUID REFERENCES reports(id) ON DELETE CASCADE,
    country_id UUID REFERENCES countries(id) ON DELETE CASCADE,
    PRIMARY KEY (report_id, country_id)
);

-- 5. 页面浏览追踪
CREATE TABLE IF NOT EXISTS page_views (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    content_type VARCHAR(10) NOT NULL CHECK (content_type IN ('report', 'news')),
    content_id UUID NOT NULL,
    duration_seconds INT DEFAULT 0,
    created_at TIMESTAMP DEFAULT NOW()
);

-- 6. 搜索日志
CREATE TABLE IF NOT EXISTS search_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    query VARCHAR(200) NOT NULL,
    results_count INT DEFAULT 0,
    created_at TIMESTAMP DEFAULT NOW()
);

-- 7. 资讯表
CREATE TABLE IF NOT EXISTS news (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title VARCHAR(255) NOT NULL,
    summary TEXT,
    content TEXT,
    source_url VARCHAR(500),
    status VARCHAR(10) DEFAULT 'draft' CHECK (status IN ('draft', 'published')),
    published_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- 8. 资讯-行业关联
CREATE TABLE IF NOT EXISTS news_industries (
    news_id UUID REFERENCES news(id) ON DELETE CASCADE,
    industry_id UUID REFERENCES industries(id) ON DELETE CASCADE,
    PRIMARY KEY (news_id, industry_id)
);

-- 9. 资讯-国家关联
CREATE TABLE IF NOT EXISTS news_countries (
    news_id UUID REFERENCES news(id) ON DELETE CASCADE,
    country_id UUID REFERENCES countries(id) ON DELETE CASCADE,
    PRIMARY KEY (news_id, country_id)
);

-- ==========================================
-- 索引
-- ==========================================

CREATE INDEX IF NOT EXISTS idx_page_views_content ON page_views(content_type, content_id);
CREATE INDEX IF NOT EXISTS idx_page_views_user ON page_views(user_id);
CREATE INDEX IF NOT EXISTS idx_page_views_created ON page_views(created_at);
CREATE INDEX IF NOT EXISTS idx_search_logs_query ON search_logs(query);
CREATE INDEX IF NOT EXISTS idx_search_logs_created ON search_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_search_logs_results ON search_logs(results_count);
CREATE INDEX IF NOT EXISTS idx_news_status ON news(status, published_at);
CREATE INDEX IF NOT EXISTS idx_news_created ON news(created_at);
CREATE INDEX IF NOT EXISTS idx_countries_region ON countries(region);

-- ==========================================
-- 种子数据: 行业
-- ==========================================

INSERT INTO industries (name) VALUES
    ('汽车零部件'),
    ('家居建材'),
    ('园艺工具'),
    ('照明电器'),
    ('消费电子'),
    ('环保包装'),
    ('紧固件'),
    ('工程机械'),
    ('户外家具'),
    ('五金工具')
ON CONFLICT (name) DO NOTHING;

-- ==========================================
-- 种子数据: 国家+区域
-- ==========================================

INSERT INTO countries (name, region, code) VALUES
    ('美国', '北美', 'US'),
    ('加拿大', '北美', 'CA'),
    ('墨西哥', '北美', 'MX'),
    ('德国', '欧洲', 'DE'),
    ('英国', '欧洲', 'GB'),
    ('法国', '欧洲', 'FR'),
    ('意大利', '欧洲', 'IT'),
    ('西班牙', '欧洲', 'ES'),
    ('波兰', '欧洲', 'PL'),
    ('荷兰', '欧洲', 'NL'),
    ('日本', '亚太', 'JP'),
    ('韩国', '亚太', 'KR'),
    ('澳大利亚', '亚太', 'AU'),
    ('印度', '亚太', 'IN'),
    ('越南', '东南亚', 'VN'),
    ('泰国', '东南亚', 'TH'),
    ('印度尼西亚', '东南亚', 'ID'),
    ('巴西', '南美', 'BR'),
    ('阿根廷', '南美', 'AR'),
    ('阿联酋', '中东', 'AE'),
    ('沙特', '中东', 'SA'),
    ('土耳其', '中东', 'TR'),
    ('俄罗斯', '独联体', 'RU'),
    ('南非', '非洲', 'ZA'),
    ('尼日利亚', '非洲', 'NG'),
    ('埃及', '非洲', 'EG')
ON CONFLICT (name) DO NOTHING;
