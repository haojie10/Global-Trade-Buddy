#!/bin/bash
set -e

PROJECT_DIR="/home/ubuntu/Global-Trade-Buddy"
cd "$PROJECT_DIR"

echo "=== [1/2] 执行 PostgreSQL 重复任务与旧批次一键清理 ==="
sudo -u postgres psql -d postgres -f migration/cleanup_duplicate_tasks.sql

echo "=== [2/2] 清理完成！GTB 任务调度中心已恢复唯一纯净数据 ==="
