#!/bin/bash
set -e

PROJECT_DIR="/home/ubuntu/Global-Trade-Buddy"
cd "$PROJECT_DIR"

echo "=== [1/2] 正在执行全库已有研报与任务池智能精准关联 (修复标题后缀匹配) ==="
sudo -u postgres psql -d postgres -f migration/sync_all_existing_reports.sql

echo "=== [2/2] 同步完成！所有已存在研报的公司已自动标记为 completed 并挂接报告链接 ==="
