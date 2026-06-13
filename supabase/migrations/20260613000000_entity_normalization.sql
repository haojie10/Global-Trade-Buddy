-- 创建实体表
CREATE TABLE IF NOT EXISTS entities (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    canonical_name VARCHAR(100) UNIQUE NOT NULL,
    entity_type VARCHAR(50) NOT NULL CHECK (entity_type IN ('company', 'product', 'channel')), -- 'company', 'product', 'channel'
    created_at TIMESTAMP DEFAULT NOW()
);

-- 创建别名表
CREATE TABLE IF NOT EXISTS entity_aliases (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    entity_id UUID REFERENCES entities(id) ON DELETE CASCADE,
    alias_name VARCHAR(100) UNIQUE NOT NULL,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_entity_aliases_entity_id ON entity_aliases(entity_id);

-- 创建报告与实体关联表
CREATE TABLE IF NOT EXISTS report_entities (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    report_id UUID REFERENCES reports(id) ON DELETE CASCADE,
    entity_id UUID REFERENCES entities(id) ON DELETE CASCADE,
    created_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(report_id, entity_id)
);

CREATE INDEX IF NOT EXISTS idx_report_entities_entity_id ON report_entities(entity_id);


-- 在 relations 关系表中增加属性
ALTER TABLE relations ADD COLUMN IF NOT EXISTS market_region VARCHAR(50);
ALTER TABLE relations ADD COLUMN IF NOT EXISTS relation_type VARCHAR(50);

-- 插入基础实体以供冷启动
INSERT INTO entities (canonical_name, entity_type) VALUES
('A 公司', 'company'),
('B 公司', 'company'),
('丰田汽车', 'company'),
('铝合金轮毂', 'product'),
('刹车片', 'product'),
('紧固件', 'product'),
('发光壁挂绿植环', 'product'),
('中东非公路工程车桥', 'product'),
('配件超市', 'channel'),
('一级供应链', 'channel')
ON CONFLICT (canonical_name) DO NOTHING;

-- 插入别名
INSERT INTO entity_aliases (entity_id, alias_name)
SELECT id, '美国 A 公司' FROM entities WHERE canonical_name = 'A 公司'
ON CONFLICT (alias_name) DO NOTHING;

INSERT INTO entity_aliases (entity_id, alias_name)
SELECT id, '美国A公司' FROM entities WHERE canonical_name = 'A 公司'
ON CONFLICT (alias_name) DO NOTHING;

INSERT INTO entity_aliases (entity_id, alias_name)
SELECT id, '德国 B 公司' FROM entities WHERE canonical_name = 'B 公司'
ON CONFLICT (alias_name) DO NOTHING;

INSERT INTO entity_aliases (entity_id, alias_name)
SELECT id, '汽配连锁超市' FROM entities WHERE canonical_name = '配件超市'
ON CONFLICT (alias_name) DO NOTHING;
