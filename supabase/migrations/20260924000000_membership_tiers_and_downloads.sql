-- 1. 添加下载额度字段（推广期默认免费版赠送 5 份）
ALTER TABLE users ADD COLUMN IF NOT EXISTS download_quota INT DEFAULT 5;

-- 2. 添加 Pro 会员订阅时间与周期重置日
ALTER TABLE users ADD COLUMN IF NOT EXISTS pro_subscribed_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS pro_cycle_expires_at TIMESTAMP WITH TIME ZONE;

-- 3. 确保 download_quota 不小于 0
ALTER TABLE users DROP CONSTRAINT IF EXISTS check_download_quota;
ALTER TABLE users ADD CONSTRAINT check_download_quota CHECK (download_quota >= 0);

-- 4. 将历史已有用户的 download_quota 补充为 5（推广期普惠）
UPDATE users SET download_quota = 5 WHERE download_quota IS NULL;
