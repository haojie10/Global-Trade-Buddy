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
