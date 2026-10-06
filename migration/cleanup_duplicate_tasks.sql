-- ==============================================================================
-- 清理旧批次与重复任务，保留唯一的纯净高质任务
-- ==============================================================================

-- 1. 删除旧的未清洗批次（避免两个批次并存导致翻倍）
DELETE FROM research_tasks 
WHERE batch_name IN ('2026海外采购商测试批次', '2026海外采购商核心活跃批次')
  AND report_id IS NULL;

-- 2. 全局按公司名称与国家进行全局唯一去重（保留最新记录）
DELETE FROM research_tasks a
USING research_tasks b
WHERE a.seq_no < b.seq_no
  AND LOWER(TRIM(a.company_name)) = LOWER(TRIM(b.company_name))
  AND LOWER(TRIM(a.country)) = LOWER(TRIM(b.country))
  AND a.report_id IS NULL;

-- 3. 统计清理后的各批次与任务总量
SELECT batch_name, priority, tag, status, count(*) AS count
FROM research_tasks
GROUP BY batch_name, priority, tag, status
ORDER BY batch_name, priority DESC;
