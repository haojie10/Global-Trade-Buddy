-- ==============================================================================
-- 导入前 10 家测试企业到 GTB 调度中心任务池 (research_tasks)
-- 优先级: 100
-- 调度标签: 渠道商 -> antigravity | 品牌商 -> workbuddy
-- ==============================================================================

-- 1. 确保 tag 列存在
ALTER TABLE research_tasks ADD COLUMN IF NOT EXISTS tag VARCHAR(50);

-- 2. 插入或更新前 10 家企业
INSERT INTO research_tasks (
    company_name, country, website, industry, tag, batch_name, priority, source_type, status
)
VALUES
    ('Uab Saulita', 'Vietnam', 'http://n.a.', 'Hardware And Tools, Glass Products', 'antigravity', '2026海外采购商测试批次', 100, 'batch_import', 'pending'),
    ('Yancheng City Huaou Industry Company', 'Vietnam', 'https://www.ec21.com', 'Tool, Sports And Travel, Electronics', 'workbuddy', '2026海外采购商测试批次', 100, 'batch_import', 'pending'),
    ('Winnipeg Industries', 'United States', 'https://www.geocities.com', 'Clothing, Medicines, Chemical Industry', 'workbuddy', '2026海外采购商测试批次', 100, 'batch_import', 'pending'),
    ('Trehab', 'Sri Lanka', 'http://www.kompass.com/packaging', 'Construction Materials, Medical Devices', 'workbuddy', '2026海外采购商测试批次', 100, 'batch_import', 'pending'),
    ('Lifung Express', 'Taiwan(China)', 'https://www.lifung.com', 'Automobile Parts, Home Decorations, Electronics', 'antigravity', '2026海外采购商测试批次', 100, 'batch_import', 'pending'),
    ('Whirlpool', 'United States', 'https://www.whirlpoolcorp.com', 'Household Appliances, Led Lighting, Hardware', 'antigravity', '2026海外采购商测试批次', 100, 'batch_import', 'pending'),
    ('Upace', 'United Kingdom', 'https://www.taiwantrade.com.tw', 'Large Machinery, Home Decorations, Clothing', 'workbuddy', '2026海外采购商测试批次', 100, 'batch_import', 'pending'),
    ('Wing Ying Trading', 'Hong Kong(China)', 'https://www.yp.com.hk', 'Furniture, Chemical Industry, Clothing', 'antigravity', '2026海外采购商测试批次', 100, 'batch_import', 'pending'),
    ('Zhejiang Cathaya Merchandise I E', 'Taiwan(China)', 'https://www.globalsources.com', 'Household Products, Vehicles, Electronics', 'antigravity', '2026海外采购商测试批次', 100, 'batch_import', 'pending'),
    ('Yung Grand', 'Taiwan(China)', 'https://www.tradesources.com', 'Household Products, Medicines, Gifts', 'antigravity', '2026海外采购商测试批次', 100, 'batch_import', 'pending')
ON CONFLICT DO NOTHING;

-- 3. 自动关联已有报告 (如 Whirlpool / Lifung 已完成的，自动挂接报告并标记为 completed)
UPDATE research_tasks t
SET status = 'completed',
    report_id = r.id,
    report_url = 'https://marketgraphic.cn/reports/' || r.id::text
FROM reports r
WHERE r.category = 'customer' 
  AND t.batch_name = '2026海外采购商测试批次'
  AND (
    LOWER(r.title) LIKE '%' || LOWER(t.company_name) || '%'
    OR (t.website IS NOT NULL AND t.website != '' AND r.content_html ILIKE '%' || SUBSTRING(t.website FROM 'https?://(?:www\.)?([^/]+)') || '%')
  );

-- 4. 查看导入结果
SELECT seq_no, priority, company_name, country, tag, batch_name, status 
FROM research_tasks 
WHERE batch_name = '2026海外采购商测试批次'
ORDER BY priority DESC, seq_no ASC;
