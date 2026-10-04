-- ============================================================
-- GlobalTradeBuddy CRM Contacts 表结构
-- 承载 190,689+ 条全球有效买手联系人数据
-- ============================================================

CREATE TABLE IF NOT EXISTS crm_contacts (
    id SERIAL PRIMARY KEY,
    email VARCHAR(255) NOT NULL UNIQUE,
    company_name TEXT NOT NULL,
    clean_company_name TEXT,
    website TEXT,
    website_domain VARCHAR(255),
    email_domain VARCHAR(255),
    contact_name VARCHAR(255),
    job_title VARCHAR(255),
    phone VARCHAR(100),
    fax VARCHAR(100),
    address TEXT,
    zip_code VARCHAR(50),
    country VARCHAR(100),
    source_session TEXT,
    industry TEXT,
    products TEXT,
    verify_status VARCHAR(50) DEFAULT 'unverified',
    last_verified_at TIMESTAMP WITH TIME ZONE,
    verify_provider VARCHAR(50),
    marketing_status VARCHAR(50) DEFAULT 'idle',
    send_count INTEGER DEFAULT 0,
    last_sent_at TIMESTAMP WITH TIME ZONE,
    last_opened_at TIMESTAMP WITH TIME ZONE,
    last_replied_at TIMESTAMP WITH TIME ZONE,
    do_not_contact INTEGER DEFAULT 0,
    tags TEXT,
    gender VARCHAR(20) DEFAULT 'unknown',
    birthday VARCHAR(50),
    department VARCHAR(100),
    social_linkedin TEXT,
    social_whatsapp VARCHAR(100),
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 高性能检索索引 (毫秒级响应)
CREATE INDEX IF NOT EXISTS idx_crm_contacts_website_domain ON crm_contacts(website_domain);
CREATE INDEX IF NOT EXISTS idx_crm_contacts_email_domain ON crm_contacts(email_domain);
CREATE INDEX IF NOT EXISTS idx_crm_contacts_clean_company ON crm_contacts(clean_company_name);
CREATE INDEX IF NOT EXISTS idx_crm_contacts_verify_status ON crm_contacts(verify_status);
CREATE INDEX IF NOT EXISTS idx_crm_contacts_country ON crm_contacts(country);

COMMENT ON TABLE crm_contacts IS 'GTB 全球 B2B 采购买手联系人核心库';
COMMENT ON COLUMN crm_contacts.source_session IS '广交会历史会话记录（内部字段，严禁在前端 UI 暴露）';
