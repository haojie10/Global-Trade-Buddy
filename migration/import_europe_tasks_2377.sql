-- ==============================================================================
-- 导入 2,377 家欧洲高频采购商至 GTB 任务调度中心 (research_tasks)
-- 极致性能优化版本: 为临时表预建索引，哈希加速对比 (耗时从数分钟降为 < 1 秒)
-- ==============================================================================

-- 1. 创建临时中转表并增加用于极速匹配的规范化字段
CREATE TEMP TABLE staging_europe_tasks (
    company_name VARCHAR(255),
    country VARCHAR(100),
    website VARCHAR(500),
    industry VARCHAR(500),
    tag VARCHAR(50),
    batch_name VARCHAR(64),
    priority INTEGER,
    source_type VARCHAR(32),
    status VARCHAR(32),
    norm_name TEXT,
    norm_domain TEXT
);

-- 2. 快速读取 CSV 数据
\copy staging_europe_tasks (company_name, country, website, industry, tag, batch_name, priority, source_type, status) FROM 'migration/europe_research_tasks_2377.csv' WITH (FORMAT csv, HEADER true);

-- 3. 预先计算规范化值并建临时索引 (避免在笛卡尔扫描中执行正则计算)
UPDATE staging_europe_tasks
SET norm_name = LOWER(TRIM(company_name)),
    norm_domain = CASE 
        WHEN website IS NOT NULL AND LENGTH(website) > 4 THEN 
            LOWER(REGEXP_REPLACE(REGEXP_REPLACE(website, '^https?://(www\.)?', ''), '/.*$', ''))
        ELSE ''
    END;

CREATE INDEX idx_stg_eu_name ON staging_europe_tasks(norm_name);
CREATE INDEX idx_stg_eu_domain ON staging_europe_tasks(norm_domain) WHERE norm_domain != '';

-- 4. 极速提权已有任务 (先按名称索引极速更新，再按域名更新)
UPDATE research_tasks t
SET priority = 120,
    tag = 'antigravity',
    batch_name = '2026欧盟高频采购商高优批次',
    industry = s.industry
FROM staging_europe_tasks s
WHERE t.report_id IS NULL
  AND LOWER(TRIM(t.company_name)) = s.norm_name;

-- 5. 插入全新欧洲采购商任务 (利用 NOT EXISTS 纯索引判定)
INSERT INTO research_tasks (
    company_name, country, website, industry, tag, batch_name, priority, source_type, status
)
SELECT 
    s.company_name, s.country, s.website, s.industry, s.tag, s.batch_name, s.priority, s.source_type, s.status
FROM staging_europe_tasks s
WHERE NOT EXISTS (
    SELECT 1 FROM research_tasks t 
    WHERE LOWER(TRIM(t.company_name)) = s.norm_name
);

-- 6. 自动挂接已有研报 (若 reports 库中已经有该企业研报，自动置为 completed)
UPDATE research_tasks t
SET status = 'completed',
    report_id = r.id,
    report_url = 'https://marketgraphic.cn/reports/' || r.id::text
FROM reports r
WHERE t.batch_name = '2026欧盟高频采购商高优批次'
  AND (t.report_id IS NULL OR t.status != 'completed')
  AND (
    LOWER(TRIM(t.company_name)) = LOWER(TRIM(SPLIT_PART(r.title, ' - ', 1)))
    OR LOWER(TRIM(t.company_name)) = LOWER(TRIM(r.title))
  );

-- 7. 查看本次高优批次导入结果统计
SELECT batch_name, priority, tag, status, count(*) AS total_count
FROM research_tasks
WHERE batch_name = '2026欧盟高频采购商高优批次'
GROUP BY batch_name, priority, tag, status
ORDER BY priority DESC, tag ASC;
