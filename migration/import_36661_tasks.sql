-- ==============================================================================
-- 导入 36,661 家核心活跃企业至 GTB 任务调度中心 (research_tasks)
-- 批次: '2026海外采购商核心活跃批次'
-- 优先级: 欧洲/俄/英/澳 (100) | 南美 (90) | 北美/南非 (80) | 日韩 (70) | 其他 (60)
-- 调度标签: 渠道商 -> antigravity | 品牌商 -> workbuddy
-- ==============================================================================

-- 1. 确保表字段与长度兼容
ALTER TABLE research_tasks ADD COLUMN IF NOT EXISTS tag VARCHAR(50);
ALTER TABLE research_tasks ALTER COLUMN industry TYPE VARCHAR(500);

-- 2. 创建临时中转表
CREATE TEMP TABLE staging_tasks (
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

-- 3. 快速导入临时表 (从 CSV 导入)
\copy staging_tasks FROM 'migration/research_tasks_36661.csv' WITH (FORMAT csv, HEADER true);

-- 4. 写入正式表 (避免重复插入相同批次相同企业)
INSERT INTO research_tasks (
    company_name, country, website, industry, tag, batch_name, priority, source_type, status
)
SELECT 
    s.company_name, s.country, s.website, s.industry, s.tag, s.batch_name, s.priority, s.source_type, s.status
FROM staging_tasks s
WHERE NOT EXISTS (
    SELECT 1 FROM research_tasks t 
    WHERE t.batch_name = s.batch_name 
      AND LOWER(TRIM(t.company_name)) = LOWER(TRIM(s.company_name))
);

-- 5. 自动挂接已有深度研报 (reports)
UPDATE research_tasks t
SET status = 'completed',
    report_id = r.id,
    report_url = 'https://marketgraphic.cn/reports/' || r.id::text
FROM reports r
WHERE r.category = 'customer' 
  AND t.batch_name = '2026海外采购商核心活跃批次'
  AND t.status != 'completed'
  AND LOWER(TRIM(r.title)) = LOWER(TRIM(t.company_name));

-- 6. 统计查看入库结果
SELECT priority, tag, status, count(*) AS total_count
FROM research_tasks
WHERE batch_name = '2026海外采购商核心活跃批次'
GROUP BY priority, tag, status
ORDER BY priority DESC, tag ASC;
