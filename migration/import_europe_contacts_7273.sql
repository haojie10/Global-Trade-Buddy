-- ==============================================================================
-- 导入 7,273 条欧洲高频采购决策人至 GTB 买手核心库 (crm_contacts)
-- 字段特色: verify_status = 'valid' (已验证有效), tags = '2026欧盟高频采购决策人'
-- 约束原则: 绝对不改变现有表结构，基于 email 唯一索引实现安全幂等插入
-- ==============================================================================

-- 1. 创建临时中转表
CREATE TEMP TABLE staging_europe_contacts (
    email VARCHAR(255),
    company_name TEXT,
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
    verify_status VARCHAR(50),
    last_verified_at TIMESTAMP WITH TIME ZONE,
    verify_provider VARCHAR(50),
    marketing_status VARCHAR(50),
    send_count INTEGER,
    last_sent_at TIMESTAMP WITH TIME ZONE,
    last_opened_at TIMESTAMP WITH TIME ZONE,
    last_replied_at TIMESTAMP WITH TIME ZONE,
    do_not_contact INTEGER,
    tags TEXT,
    gender VARCHAR(20),
    birthday VARCHAR(50),
    department VARCHAR(100),
    social_linkedin TEXT,
    social_whatsapp VARCHAR(100),
    notes TEXT
);

-- 2. 快速读取 CSV 数据
\copy staging_europe_contacts FROM 'migration/europe_crm_contacts_7273.csv' WITH (FORMAT csv, HEADER true);

-- 3. 幂等插入正式 crm_contacts 表 (如邮箱已存在，自动补充缺失的领英/职位/已验证状态)
INSERT INTO crm_contacts (
    email, company_name, clean_company_name, website, website_domain, email_domain,
    contact_name, job_title, phone, fax, address, zip_code, country,
    source_session, industry, products, verify_status, last_verified_at, verify_provider,
    marketing_status, send_count, do_not_contact, tags, gender, birthday,
    department, social_linkedin, social_whatsapp, notes
)
SELECT 
    s.email, s.company_name, s.clean_company_name, s.website, s.website_domain, s.email_domain,
    s.contact_name, s.job_title, s.phone, s.fax, s.address, s.zip_code, s.country,
    s.source_session, s.industry, s.products, s.verify_status, s.last_verified_at, s.verify_provider,
    s.marketing_status, s.send_count, s.do_not_contact, s.tags, s.gender, s.birthday,
    s.department, s.social_linkedin, s.social_whatsapp, s.notes
FROM staging_europe_contacts s
ON CONFLICT (email) DO UPDATE SET
    verify_status = 'valid',
    last_verified_at = EXCLUDED.last_verified_at,
    verify_provider = EXCLUDED.verify_provider,
    social_linkedin = COALESCE(crm_contacts.social_linkedin, EXCLUDED.social_linkedin),
    job_title = COALESCE(crm_contacts.job_title, EXCLUDED.job_title),
    tags = CASE 
        WHEN crm_contacts.tags IS NULL OR crm_contacts.tags = '' THEN EXCLUDED.tags
        WHEN crm_contacts.tags NOT LIKE '%2026欧盟高频采购决策人%' THEN crm_contacts.tags || ', 2026欧盟高频采购决策人'
        ELSE crm_contacts.tags
    END,
    updated_at = CURRENT_TIMESTAMP;

-- 4. 统计查看当前买手库总数与有效验证状态分布
SELECT 
    verify_status,
    COUNT(*) AS total_count,
    COUNT(*) FILTER (WHERE tags LIKE '%2026欧盟高频采购决策人%') AS 本次新增或更新条数
FROM crm_contacts
GROUP BY verify_status
ORDER BY total_count DESC;
