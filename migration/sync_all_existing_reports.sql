-- ==============================================================================
-- 全面同步已有研报 (reports) 到 任务调度中心 (research_tasks)
-- 彻底修复因报告标题后缀 (如 " - 360° 企业战略情报报告") 导致的未关联问题
-- ==============================================================================

-- 1. 基于报告标题主体前缀 (SPLIT_PART) 进行高精度关联更新
UPDATE research_tasks t
SET status = 'completed',
    report_id = r.id,
    report_url = 'https://marketgraphic.cn/reports/' || r.id::text
FROM reports r
WHERE (t.report_id IS NULL OR t.status != 'completed')
  AND (
    -- 精确匹配报告标题前缀 (例如 "Action S A - 360° 企业战略情报报告" -> "Action S A")
    LOWER(TRIM(t.company_name)) = LOWER(TRIM(SPLIT_PART(r.title, ' - ', 1)))
    OR LOWER(TRIM(t.company_name)) = LOWER(TRIM(r.title))
    -- 去除公司后缀后匹配 (例如 Action S A vs Action S.A. vs Action)
    OR LOWER(REGEXP_REPLACE(TRIM(t.company_name), '\s*(ltd|limited|inc|incorporated|llc|gmbh|s\.?a\.?|corp|srl|bv)\.?\s*$', '', 'i'))
       = LOWER(REGEXP_REPLACE(TRIM(SPLIT_PART(r.title, ' - ', 1)), '\s*(ltd|limited|inc|incorporated|llc|gmbh|s\.?a\.?|corp|srl|bv)\.?\s*$', '', 'i'))
  );

-- 2. 基于 HTML 内部嵌入的官网域名进行二次关联
UPDATE research_tasks t
SET status = 'completed',
    report_id = r.id,
    report_url = 'https://marketgraphic.cn/reports/' || r.id::text
FROM reports r
WHERE (t.report_id IS NULL OR t.status != 'completed')
  AND t.website IS NOT NULL 
  AND LENGTH(t.website) > 4
  AND r.content_html IS NOT NULL
  AND r.content_html LIKE '%' || LOWER(REGEXP_REPLACE(REGEXP_REPLACE(t.website, '^https?://(www\.)?', ''), '/.*$', '')) || '%';

-- 3. 统计全库已成功关联已有研报的任务总数
SELECT 
    COUNT(*) FILTER (WHERE status = 'completed' AND report_id IS NOT NULL) AS 已成功挂接研报的任务数,
    COUNT(*) FILTER (WHERE status = 'pending') AS 剩余待调研任务数,
    COUNT(*) AS 全库任务总数
FROM research_tasks;

-- 4. 重点查验 Action S A (任务 #40946) 的当前关联状态
SELECT seq_no, company_name, country, website, status, priority, tag, report_id, report_url
FROM research_tasks
WHERE LOWER(company_name) LIKE '%action%s%a%' OR seq_no = 40946;
