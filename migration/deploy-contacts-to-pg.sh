#!/usr/bin/env bash
# ==============================================================================
# GTB 买手联系人数据库线上初始化与导入脚本 (On-Server Executable)
# 使用方法:
#   在腾讯云服务器终端运行: bash deploy-contacts-to-pg.sh
# ==============================================================================

set -e

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SCHEMA_FILE="$DIR/crm_contacts_schema.sql"
CSV_FILE="$DIR/crm_contacts.csv"

echo "=================================================="
echo "🚀 开始导入 GTB 全球买手联系人数据到 PostgreSQL"
echo "=================================================="

# 1. 检查文件是否存在
if [ ! -f "$SCHEMA_FILE" ]; then
    echo "❌ 找不到建表语句: $SCHEMA_FILE"
    exit 1
fi

if [ ! -f "$CSV_FILE" ]; then
    echo "❌ 找不到数据文件: $CSV_FILE"
    exit 1
fi

# 2. 执行建表与索引
echo "📌 [1/2] 正在创建 crm_contacts 数据表与 B-Tree 索引..."
psql -U postgres -d postgres -f "$SCHEMA_FILE"

# 3. 高速流式 COPY 载入数据
echo "📌 [2/2] 正在高速载入 190,689 条联系人数据 (预计 3~5 秒)..."
COLUMNS="email, company_name, clean_company_name, website, website_domain, email_domain, contact_name, job_title, phone, fax, address, zip_code, country, source_session, industry, products, verify_status, last_verified_at, verify_provider, marketing_status, send_count, last_sent_at, last_opened_at, last_replied_at, do_not_contact, tags, gender, birthday, department, social_linkedin, social_whatsapp, notes"

psql -U postgres -d postgres -c "\copy crm_contacts($COLUMNS) FROM '$CSV_FILE' WITH (FORMAT csv, HEADER true);"

echo "=================================================="
echo "🎉 导入成功！验证数据量:"
psql -U postgres -d postgres -c "SELECT count(*) AS total_contacts, count(DISTINCT website_domain) AS total_domains FROM crm_contacts;"
echo "=================================================="
