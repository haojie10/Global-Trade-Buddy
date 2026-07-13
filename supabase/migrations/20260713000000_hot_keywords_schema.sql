-- ==========================================
-- GTB 自动选题联动: 热门词库表
-- 用于存放从行业新闻中提取出的公司简称和产品类别
-- ==========================================

CREATE TABLE IF NOT EXISTS hot_keywords (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    keyword VARCHAR(100) NOT NULL,            -- 热点词 (公司简称或产品类别)
    industry VARCHAR(100) NOT NULL,           -- 所属行业名称 (匹配 Excel 里的行业名称)
    category VARCHAR(50) NOT NULL CHECK (category IN ('company', 'product')), -- 'company' (公司简称) 或 'product' (产品类别)
    weight INT DEFAULT 1,                      -- 热度权重 (出现频次)
    last_seen TIMESTAMP DEFAULT NOW(),        -- 最近一次出现时间
    created_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(keyword, industry)
);

-- 创建索引以加速选题查询
CREATE INDEX IF NOT EXISTS idx_hot_keywords_category_weight ON hot_keywords(category, weight DESC);
CREATE INDEX IF NOT EXISTS idx_hot_keywords_industry ON hot_keywords(industry);
