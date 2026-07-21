-- Fix: market_region VARCHAR(50) 无法容纳多市场拼接值，扩宽到 255
ALTER TABLE reports ALTER COLUMN market_region TYPE VARCHAR(255);
ALTER TABLE relations ALTER COLUMN market_region TYPE VARCHAR(255);
