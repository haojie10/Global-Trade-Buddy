-- Add details columns to entities table
ALTER TABLE entities ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE entities ADD COLUMN IF NOT EXISTS website VARCHAR(255);
ALTER TABLE entities ADD COLUMN IF NOT EXISTS headquarters VARCHAR(255);
ALTER TABLE entities ADD COLUMN IF NOT EXISTS employee_count VARCHAR(100);
