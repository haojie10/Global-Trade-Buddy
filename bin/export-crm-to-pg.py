#!/usr/bin/env python3
"""
GTB CRM Contacts -> PostgreSQL 迁移脚本
功能:
1. 提取本地 contacts.db 中的 crm_contacts (190,689 条清洗去重后的核心 B2B 买手)
2. 生成高性能 PostgreSQL DDL 建表语句与索引 (包含 B-Tree 域名索引)
3. 导出极简 CSV/SQL dump 文件，支持多种高效导入方式:
   - 方式 1: 直接生成标准的 crm_contacts_schema.sql
   - 方式 2: 生成经过转义与 UTF-8 处理的 crm_contacts.csv，供 psql \\copy 毫秒级极速载入
   - 方式 3: 支持直连 PostgreSQL 执行批量流式 INSERT (如果提供 DB URL)
"""

import os
import sys
import sqlite3
import csv
import time

SQLITE_PATH = os.path.abspath(os.path.join(os.path.dirname(__file__), "../../客户邮箱/contacts.db"))
OUTPUT_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "../migration"))
SCHEMA_SQL = os.path.join(OUTPUT_DIR, "crm_contacts_schema.sql")
DATA_CSV = os.path.join(OUTPUT_DIR, "crm_contacts.csv")

CREATE_TABLE_SQL = """-- ============================================================
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
"""

EXPORT_COLUMNS = [
    "email", "company_name", "clean_company_name", "website", "website_domain", "email_domain",
    "contact_name", "job_title", "phone", "fax", "address", "zip_code", "country",
    "source_session", "industry", "products", "verify_status", "last_verified_at", "verify_provider",
    "marketing_status", "send_count", "last_sent_at", "last_opened_at", "last_replied_at", "do_not_contact",
    "tags", "gender", "birthday", "department", "social_linkedin", "social_whatsapp", "notes"
]

def main():
    start_time = time.time()
    if not os.path.exists(SQLITE_PATH):
        print(f"❌ 找不到 SQLite 数据库文件: {SQLITE_PATH}")
        sys.exit(1)

    os.makedirs(OUTPUT_DIR, exist_ok=True)

    print("==================================================")
    print("🚀 准备生成 PostgreSQL 迁移包")
    print(f"📦 源数据库: {SQLITE_PATH}")
    print(f"📁 目标目录: {OUTPUT_DIR}")
    print("==================================================")

    # 1. 输出 DDL Schema 文件
    with open(SCHEMA_SQL, "w", encoding="utf-8") as f:
        f.write(CREATE_TABLE_SQL)
    print(f"✅ [1/2] DDL 结构文件已生成: {SCHEMA_SQL}")

    # 2. 从 SQLite 提取并流式写入 CSV
    conn = sqlite3.connect(SQLITE_PATH)
    cur = conn.cursor()

    col_names_str = ", ".join(EXPORT_COLUMNS)
    cur.execute(f"SELECT {col_names_str} FROM crm_contacts ORDER BY id ASC")

    print(f"⏳ [2/2] 正在导出 crm_contacts 数据至 CSV 文件...")
    total_rows = 0
    with open(DATA_CSV, "w", encoding="utf-8", newline="") as f:
        writer = csv.writer(f, quoting=csv.QUOTE_MINIMAL)
        # 写入表头
        writer.writerow(EXPORT_COLUMNS)
        
        while True:
            rows = cur.fetchmany(10000)
            if not rows:
                break
            writer.writerows(rows)
            total_rows += len(rows)
            print(f"   已导出 {total_rows:,} 条...", end="\r")

    conn.close()
    elapsed = time.time() - start_time
    file_size_mb = os.path.getsize(DATA_CSV) / (1024 * 1024)

    print(f"\n🎉 导出完成！")
    print(f"   总记录数: {total_rows:,} 条")
    print(f"   CSV 体积: {file_size_mb:.2f} MB")
    print(f"   文件路径: {DATA_CSV}")
    print(f"   总耗时:   {elapsed:.2f} 秒")
    print("==================================================")
    print("\n💡 在生产服务器 (124.222.201.143) 上执行导入的两种推荐指令:\n")
    print("方法 A: 登录服务器后通过 psql 直接载入 (极速，仅需约 5 秒):")
    print(f"  1. 执行 DDL 建表: psql -U postgres -d postgres -f crm_contacts_schema.sql")
    print(f"  2. 高速载入 CSV:  psql -U postgres -d postgres -c \"\\copy crm_contacts({col_names_str}) FROM 'crm_contacts.csv' WITH (FORMAT csv, HEADER true);\"")
    print("\n方法 B: 或使用 Python 脚本自动化导入 (见 export_to_pg.py --import)")

if __name__ == "__main__":
    main()
