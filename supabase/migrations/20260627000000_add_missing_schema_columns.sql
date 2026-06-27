-- Add primary_entity_id to reports
ALTER TABLE reports ADD COLUMN IF NOT EXISTS primary_entity_id UUID REFERENCES entities(id) ON DELETE SET NULL;

-- Add role to report_entities
ALTER TABLE report_entities ADD COLUMN IF NOT EXISTS role VARCHAR(50);

-- Update entities_entity_type_check constraint to include 'region'
ALTER TABLE entities DROP CONSTRAINT IF EXISTS entities_entity_type_check;
ALTER TABLE entities ADD CONSTRAINT entities_entity_type_check CHECK (entity_type IN ('company', 'product', 'channel', 'competitor', 'region'));
