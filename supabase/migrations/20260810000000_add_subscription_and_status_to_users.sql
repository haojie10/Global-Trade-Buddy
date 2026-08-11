-- 为 users 表添加订阅到期时间和账号状态字段
ALTER TABLE users ADD COLUMN IF NOT EXISTS subscription_expires_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'active';

-- 为常用筛选字段建立索引以提升管理后台分页与检索性能
CREATE INDEX IF NOT EXISTS idx_users_email_trgm ON users (email);
CREATE INDEX IF NOT EXISTS idx_users_nickname_trgm ON users (nickname);
CREATE INDEX IF NOT EXISTS idx_users_status ON users (status);
CREATE INDEX IF NOT EXISTS idx_users_member_type ON users (member_type);
