#!/bin/bash
set -e

PROJECT_DIR="/home/ubuntu/Global-Trade-Buddy"
cd "$PROJECT_DIR"

echo "=== [1/2] 正在执行 93 家全球专业渠道商高优入库 (Priority=120, Tag=antigravity) ==="
sudo -u postgres psql -d postgres -f migration/import_priority_120_channel_tasks.sql

echo "=== [2/2] 入库与优先级提升完成！已排入调度中心最前列进行优先调研 ==="
