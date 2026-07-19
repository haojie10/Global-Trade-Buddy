-- ==========================================
-- 安全加固 + 性能优化迁移
-- ==========================================

-- 1. email_verifications 安全加固 (C-4 + H-7)
ALTER TABLE email_verifications 
  ADD COLUMN IF NOT EXISTS attempts INT DEFAULT 0;
CREATE INDEX IF NOT EXISTS idx_email_verifications_email 
  ON email_verifications(email);
CREATE INDEX IF NOT EXISTS idx_email_verifications_expired 
  ON email_verifications(expired_at);

-- 2. users 表数据完整性约束 (M-1)
-- 确保 free_quota 不小于 0
ALTER TABLE users 
  ADD CONSTRAINT check_free_quota 
  CHECK (free_quota >= 0);

-- 确保 role 仅限 user 或 admin
ALTER TABLE users 
  ADD CONSTRAINT check_role 
  CHECK (role IN ('user', 'admin'));

-- 确保 member_type 不为 NULL
ALTER TABLE users 
  ALTER COLUMN member_type SET NOT NULL;

-- 3. 缺失的排序索引 (M-2)
CREATE INDEX IF NOT EXISTS idx_reports_created_at 
  ON reports(created_at DESC);

-- 4. users.invited_by 外键索引
CREATE INDEX IF NOT EXISTS idx_users_invited_by 
  ON users(invited_by);
