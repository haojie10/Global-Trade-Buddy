#!/bin/bash
set -e

PROJECT_DIR="/home/ubuntu/Global-Trade-Buddy"
cd "$PROJECT_DIR"

echo "=== [1/2] 正在导入 2,377 家欧洲高频采购商至任务调度中心 (Priority 120, Tag antigravity) ==="
sudo -u postgres psql -d postgres -f migration/import_europe_tasks_2377.sql

echo "=== [2/2] 正在导入 7,273 位欧洲高频采购决策人至买手核心库 (verify_status = 'valid') ==="
sudo -u postgres psql -d postgres -f migration/import_europe_contacts_7273.sql

echo "=== 部署完成！数据已无缝生效，且完全保持数据库原有结构不变 ==="
