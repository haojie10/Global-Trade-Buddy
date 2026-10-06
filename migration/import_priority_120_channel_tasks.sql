-- ==============================================================================
-- 导入并提升 93 家全球专业渠道巨头 (电气分销/汽配连锁/实体卖场) 为高优调研任务
-- 批次: '2026全球实体渠道地图高优批次'
-- 优先级: 120 (顶格优先调度)
-- 调度标签: antigravity (实体门店渠道引擎)
-- ==============================================================================

-- 1. 确保表字段与长度兼容
ALTER TABLE research_tasks ADD COLUMN IF NOT EXISTS tag VARCHAR(50);
ALTER TABLE research_tasks ALTER COLUMN industry TYPE VARCHAR(500);

-- 2. 创建临时中转表
CREATE TEMP TABLE staging_priority_channel_tasks (
    company_name VARCHAR(255),
    country VARCHAR(100),
    website VARCHAR(500),
    industry VARCHAR(500),
    tag VARCHAR(50),
    batch_name VARCHAR(64),
    priority INTEGER,
    source_type VARCHAR(32),
    status VARCHAR(32)
);

-- 3. 快速导入 93 家高价值渠道商数据
\copy staging_priority_channel_tasks FROM 'migration/priority_120_channel_tasks.csv' WITH (FORMAT csv, HEADER true);

-- 4. 若库中已有同名未调研任务，直接提升优先级为 120 并切为 antigravity
UPDATE research_tasks t
SET priority = 120,
    tag = 'antigravity',
    batch_name = '2026全球实体渠道地图高优批次',
    status = 'pending',
    industry = s.industry
FROM staging_priority_channel_tasks s
WHERE t.report_id IS NULL
  AND (
    LOWER(TRIM(t.company_name)) = LOWER(TRIM(s.company_name))
    OR (t.website IS NOT NULL AND LOWER(TRIM(t.website)) = LOWER(TRIM(s.website)))
  );

-- 5. 写入库中尚不存在的全新渠道商
INSERT INTO research_tasks (
    company_name, country, website, industry, tag, batch_name, priority, source_type, status
)
SELECT 
    s.company_name, s.country, s.website, s.industry, s.tag, s.batch_name, s.priority, s.source_type, s.status
FROM staging_priority_channel_tasks s
WHERE NOT EXISTS (
    SELECT 1 FROM research_tasks t 
    WHERE LOWER(TRIM(t.company_name)) = LOWER(TRIM(s.company_name))
       OR (t.website IS NOT NULL AND LOWER(TRIM(t.website)) = LOWER(TRIM(s.website)))
);

-- 6. 严谨二次检查：若 reports 库中已有该企业研报，自动挂接并标记完成 (避免重复调研)
UPDATE research_tasks t
SET status = 'completed',
    report_id = r.id,
    report_url = 'https://marketgraphic.cn/reports/' || r.id::text
FROM reports r
WHERE r.category = 'customer' 
  AND t.batch_name = '2026全球实体渠道地图高优批次'
  AND (
    LOWER(TRIM(r.title)) = LOWER(TRIM(t.company_name))
    OR LOWER(TRIM(r.title)) LIKE '%' || LOWER(TRIM(t.company_name)) || '%'
  );

-- 7. 统计查看当前任务调度中心的优先级分布
SELECT batch_name, priority, tag, status, count(*) AS total_count
FROM research_tasks
WHERE priority >= 100 OR batch_name = '2026全球实体渠道地图高优批次'
GROUP BY batch_name, priority, tag, status
ORDER BY priority DESC, tag ASC;
