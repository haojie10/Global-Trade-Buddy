-- Add 'competitor' to entity_type check constraint
ALTER TABLE entities DROP CONSTRAINT IF EXISTS entities_entity_type_check;
ALTER TABLE entities ADD CONSTRAINT entities_entity_type_check CHECK (entity_type IN ('company', 'product', 'channel', 'competitor'));
