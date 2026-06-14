CREATE TABLE IF NOT EXISTS entity_relations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    entity_id_a UUID NOT NULL REFERENCES entities(id) ON DELETE CASCADE,
    entity_id_b UUID NOT NULL REFERENCES entities(id) ON DELETE CASCADE,
    relation_type VARCHAR(50) NOT NULL CHECK (relation_type IN ('competitor', 'supplier', 'product_sale')),
    market_region VARCHAR(100),
    created_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(entity_id_a, entity_id_b, relation_type, market_region)
);

CREATE INDEX IF NOT EXISTS idx_entity_relations_entity_a ON entity_relations(entity_id_a);
CREATE INDEX IF NOT EXISTS idx_entity_relations_entity_b ON entity_relations(entity_id_b);
