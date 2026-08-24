-- 按报告维度存储主体公司别名（方案 A：所见即所得）
-- 设计原则：HTML meta 标签为唯一事实标准，每份报告的别名独立存储。
-- 全局 entity_aliases 表此后仅作为「名称 -> 实体」的匹配字典使用，展示层一律以本表为准。
CREATE TABLE IF NOT EXISTS report_entity_aliases (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    report_id UUID NOT NULL REFERENCES reports(id) ON DELETE CASCADE,
    entity_id UUID NOT NULL REFERENCES entities(id) ON DELETE CASCADE,
    alias_name VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(report_id, entity_id, alias_name)
);

CREATE INDEX IF NOT EXISTS idx_report_entity_aliases_report ON report_entity_aliases(report_id, entity_id);

-- 历史数据回填：把现有全局别名拷贝到各报告名下（仅针对 primary 主体实体）
INSERT INTO report_entity_aliases (report_id, entity_id, alias_name)
SELECT re.report_id, re.entity_id, ea.alias_name
FROM report_entities re
JOIN entity_aliases ea ON ea.entity_id = re.entity_id
WHERE re.role = 'primary'
ON CONFLICT (report_id, entity_id, alias_name) DO NOTHING;
