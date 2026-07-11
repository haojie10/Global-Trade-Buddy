-- ==========================================
-- 性能与加载速度专项优化：高频索引补充
-- ==========================================

-- 1. 创建 relations 复合索引加速拓扑边及关系推荐查询
CREATE INDEX IF NOT EXISTS idx_relations_composite 
ON relations(report_id_a, report_id_b, relation_key);

-- 2. 创建 entities 精确名称索引加速归一化匹配和精准筛选
CREATE INDEX IF NOT EXISTS idx_entities_canonical_name 
ON entities(canonical_name);
