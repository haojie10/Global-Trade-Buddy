-- ==========================================
-- 需求反馈与调研报告定制表
-- ==========================================

CREATE TABLE IF NOT EXISTS custom_report_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  contact_email VARCHAR(255) NOT NULL,
  request_type VARCHAR(50) NOT NULL, -- 'category_insight' | 'company_insight' | 'feedback'
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  status VARCHAR(20) NOT NULL DEFAULT 'pending', -- 'pending' | 'processing' | 'completed' | 'failed'
  report_id VARCHAR(255),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_custom_report_requests_status ON custom_report_requests(status);
CREATE INDEX IF NOT EXISTS idx_custom_report_requests_user ON custom_report_requests(user_id);
