-- Add baidu_pushed_at column to reports and news tables for SEO crawl tracking

ALTER TABLE reports ADD COLUMN IF NOT EXISTS baidu_pushed_at TIMESTAMP WITH TIME ZONE;
CREATE INDEX IF NOT EXISTS idx_reports_baidu_pushed_at ON reports (baidu_pushed_at);

ALTER TABLE news ADD COLUMN IF NOT EXISTS baidu_pushed_at TIMESTAMP WITH TIME ZONE;
CREATE INDEX IF NOT EXISTS idx_news_baidu_pushed_at ON news (baidu_pushed_at);
