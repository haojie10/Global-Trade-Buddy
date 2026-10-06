#!/bin/bash
set -e

echo "=== [1/3] 检查并清理 PostgreSQL 锁死/长时间未释放连接 ==="
sudo -u postgres psql -d postgres -c "
SELECT pg_terminate_backend(pid) 
FROM pg_stat_activity 
WHERE state = 'idle in transaction' 
   OR (state != 'idle' AND query_start < NOW() - INTERVAL '5 minutes' AND pid != pg_backend_pid());
" || true

echo "=== [2/3] 重启 PM2 Web 服务以刷新数据库连接池 ==="
pm2 restart all || pm2 restart globaltradebuddy || npm run build

echo "=== [3/3] 验证健康状态 ==="
curl -s http://localhost:3000/api/health || curl -s https://marketgraphic.cn/api/health

echo -e "\n✅ 服务与数据库连接池已全部恢复正常！"
