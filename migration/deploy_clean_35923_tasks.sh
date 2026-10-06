#!/bin/bash
set -e

PROJECT_DIR="/home/ubuntu/Global-Trade-Buddy"
cd "$PROJECT_DIR"

echo "=== [1/3] 解压清洗合格数据文件 ==="
if [ ! -f "migration/research_tasks_clean_35923.csv" ] && [ -f "migration/research_tasks_clean_35923.csv.gz" ]; then
    gunzip -k migration/research_tasks_clean_35923.csv.gz
fi

echo "=== [2/3] 执行 PostgreSQL 批量入库与研报挂接 (35,923 条纯净数据) ==="
sudo -u postgres psql -d postgres -f migration/import_clean_35923_tasks.sql

echo "=== [3/3] 入库成功！GTB 任务调度中心已就绪 ==="
