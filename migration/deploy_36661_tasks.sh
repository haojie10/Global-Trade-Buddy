#!/bin/bash
set -e

# ==============================================================================
# GTB 任务调度中心 - 36,661 家核心活跃企业自动化入库脚本
# ==============================================================================

PROJECT_DIR="/home/ubuntu/Global-Trade-Buddy"
cd "$PROJECT_DIR"

echo "=== [1/3] 解压数据文件 (如果需要) ==="
if [ ! -f "migration/research_tasks_36661.csv" ] && [ -f "migration/research_tasks_36661.csv.gz" ]; then
    gunzip -k migration/research_tasks_36661.csv.gz
fi

echo "=== [2/3] 执行 PostgreSQL 批量入库与研报挂接 ==="
sudo -u postgres psql -d postgres -f migration/import_36661_tasks.sql

echo "=== [3/3] 入库成功！GTB 任务调度中心已就绪 ==="
