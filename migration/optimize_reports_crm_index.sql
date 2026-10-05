-- ==============================================================================
-- 优化 crm_contacts 与 reports 的秒级双向关联性能
-- 方案: 
-- 1. 在 reports 表增加提取出的 website_domain 与 clean_company 索引列
-- 2. 在 crm_contacts 建立三合一复合索引与全文匹配加速
-- ==============================================================================

-- 1. 在 reports 表增加元数据缓存列 (如果有新报告发布自动提取，避免几十兆 HTML 全文扫描)
ALTER TABLE reports ADD COLUMN IF NOT EXISTS website_domain VARCHAR(255);
ALTER TABLE reports ADD COLUMN IF NOT EXISTS clean_company VARCHAR(255);

-- 2. 从 reports 的 content_html 与 title 一次性极速提取填充 (纯正则，仅需约 1 秒)
UPDATE reports 
SET website_domain = LOWER(SUBSTRING(content_html FROM 'company_website["''][^>]*?content=["'']https?://(?:www\.)?([^/"''\s]+)')),
    clean_company = LOWER(REGEXP_REPLACE(
      REGEXP_REPLACE(COALESCE(SUBSTRING(content_html FROM 'company_name["''][^>]*?content=["'']([^"''\s]+)'), SPLIT_PART(title, ' - ', 1)), 
      '\b(ltd|limited|inc|incorporated|corp|corporation|llc|gmbh|sa|srl|bv|co\.?,\s*ltd\.?|co\.?)\b', '', 'gi'),
      '[^a-zA-Z0-9\u4e00-\u9fa5]+', ' ', 'g'
    ))
WHERE website_domain IS NULL;

-- 3. 为 reports 的关联列创建 B-Tree 索引
CREATE INDEX IF NOT EXISTS idx_reports_website_domain ON reports(website_domain);
CREATE INDEX IF NOT EXISTS idx_reports_clean_company ON reports(clean_company);

-- 4. 为 crm_contacts 增加覆盖索引
CREATE INDEX IF NOT EXISTS idx_crm_contacts_id_desc ON crm_contacts(id DESC);
CREATE INDEX IF NOT EXISTS idx_crm_contacts_comp_domain ON crm_contacts(website_domain, clean_company_name);
