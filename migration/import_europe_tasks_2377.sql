-- ==============================================================================
-- 导入 2,377 家欧洲高频采购商至 GTB 任务调度中心 (research_tasks)
-- 批次: '2026欧盟高频采购商高优批次'
-- 优先级: 120 (顶格优先调度)
-- 调度标签: antigravity
-- 约束原则: 绝对不改变现有表结构，纯粹数据级清洗写入与幂等更新
-- ==============================================================================

-- 1. 创建临时中转表
CREATE TEMP TABLE staging_europe_tasks (
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

-- 2. 快速读取 CSV 数据
\copy staging_europe_tasks FROM 'migration/europe_research_tasks_2377.csv' WITH (FORMAT csv, HEADER true);

-- 3. 若任务池中已存在该公司（通过名称或官网匹配），同步提权为 120 并标记为 antigravity
UPDATE research_tasks t
SET priority = 120,
    tag = 'antigravity',
    batch_name = '2026欧盟高频采购商高优批次',
    industry = s.industry
FROM staging_europe_tasks s
WHERE t.report_id IS NULL
  AND (
    LOWER(TRIM(t.company_name)) = LOWER(TRIM(s.company_name))
    OR (
        t.website IS NOT NULL AND s.website IS NOT NULL AND LENGTH(s.website) > 4
        AND LOWER(REGEXP_REPLACE(REGEXP_REPLACE(t.website, '^https?://(www\.)?', ''), '/.*$', '')) = 
            LOWER(REGEXP_REPLACE(REGEXP_REPLACE(s.website, '^https?://(www\.)?', ''), '/.*$', ''))
    )
  );

-- 4. 插入库中尚不存在的全新欧洲采购商任务
INSERT INTO research_tasks (
    company_name, country, website, industry, tag, batch_name, priority, source_type, status
)
SELECT 
    s.company_name, s.country, s.website, s.industry, s.tag, s.batch_name, s.priority, s.source_type, s.status
FROM staging_europe_tasks s
WHERE NOT EXISTS (
    SELECT 1 FROM research_tasks t 
    WHERE LOWER(TRIM(t.company_name)) = LOWER(TRIM(s.company_name))
       OR (
           t.website IS NOT NULL AND s.website IS NOT NULL AND LENGTH(s.website) > 4
           AND LOWER(REGEXP_REPLACE(REGEXP_REPLACE(t.website, '^https?://(www\.)?', ''), '/.*$', '')) = 
               LOWER(REGEXP_REPLACE(REGEXP_REPLACE(s.website, '^https?://(www\.)?', ''), '/.*$', ''))
       )
);

-- 5. 自动挂接已有研报 (若 reports 库中已经有该企业研报，自动置为 completed)
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

-- 6. 查看本次高优批次导入结果统计
SELECT batch_name, priority, tag, status, count(*) AS total_count
FROM research_tasks
WHERE batch_name = '2026欧盟高频采购商高优批次'
GROUP BY batch_name, priority, tag, status
ORDER BY priority DESC, tag ASC;
