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
