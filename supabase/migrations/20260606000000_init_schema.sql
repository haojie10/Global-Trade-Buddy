-- 启用 UUID 扩展
CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. 用户表
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    phone_number VARCHAR(20) UNIQUE,
    email VARCHAR(100) UNIQUE,
    free_quota INT DEFAULT 3,
    member_type VARCHAR(10) DEFAULT 'free',
    invited_by UUID REFERENCES users(id) ON DELETE SET NULL, -- 邀请人关联
    created_at TIMESTAMP DEFAULT NOW()
);

-- 2. 报告表
CREATE TABLE IF NOT EXISTS reports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title VARCHAR(255) NOT NULL,
    category VARCHAR(20) CHECK (category IN ('customer', 'product')),
    market_region VARCHAR(50),
    summary TEXT,
    content_html TEXT, -- 已经过图片脱水处理的HTML富文本
    created_at TIMESTAMP DEFAULT NOW()
);

-- 3. 用户解锁表
CREATE TABLE IF NOT EXISTS unlocks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    report_id UUID REFERENCES reports(id) ON DELETE CASCADE,
    unlocked_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(user_id, report_id)
);

-- 4. 报告关联网络表
CREATE TABLE IF NOT EXISTS relations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    report_id_a UUID REFERENCES reports(id) ON DELETE CASCADE,
    report_id_b UUID REFERENCES reports(id) ON DELETE CASCADE,
    relation_key VARCHAR(100), -- 关联的共有实体，如“铝合金轮毂”
    created_at TIMESTAMP DEFAULT NOW()
);

-- 5. 个人笔记表
CREATE TABLE IF NOT EXISTS notes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    report_id UUID REFERENCES reports(id) ON DELETE CASCADE,
    content TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- 6. 报告收藏夹表
CREATE TABLE IF NOT EXISTS favorites (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    report_id UUID REFERENCES reports(id) ON DELETE CASCADE,
    created_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(user_id, report_id)
);
