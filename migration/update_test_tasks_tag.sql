-- 更新前 10 家测试企业的标签为严格分类后的标签
UPDATE research_tasks
SET tag = 'workbuddy'
WHERE batch_name = '2026海外采购商测试批次' 
  AND company_name IN ('Uab Saulita', 'Lifung Express', 'Whirlpool', 'Wing Ying Trading', 'Zhejiang Cathaya Merchandise I E', 'Yung Grand');
