#!/bin/bash
# ============================================================
# GlobalTradeBuddy 生产环境部署脚本
# 用法: bash bin/deploy.sh
# ============================================================
set -euo pipefail

DEPLOY_DIR="/home/ubuntu/Global-Trade-Buddy"
LOG_DIR="/home/ubuntu/logs"
LOG_FILE="$LOG_DIR/deploy-$(date +%Y%m%d%H%M%S).log"
HEALTH_URL="http://127.0.0.1:3000/api/health"

mkdir -p "$LOG_DIR"

log() {
  echo "$(date '+%Y-%m-%d %H:%M:%S') $1" | tee -a "$LOG_FILE"
}

log "🚀 开始部署..."

cd "$DEPLOY_DIR"

# 记录回滚点
PREV_COMMIT=$(git rev-parse HEAD)
log "📌 当前版本: $PREV_COMMIT"

# 拉取最新代码
log "📥 拉取最新代码..."
git pull origin main 2>&1 | tee -a "$LOG_FILE"
NEW_COMMIT=$(git rev-parse HEAD)
log "🆕 新版本: $NEW_COMMIT"

if [ "$PREV_COMMIT" = "$NEW_COMMIT" ]; then
  log "ℹ️  无新提交，跳过部署"
  exit 0
fi

# 安装依赖（使用 ci 确保锁定版本）
log "📦 安装依赖 (npm ci)..."
npm ci 2>&1 | tee -a "$LOG_FILE"

# 构建（失败则回滚）
log "🔨 构建项目..."
if ! npm run build 2>&1 | tee -a "$LOG_FILE"; then
  log "❌ 构建失败，回滚到 $PREV_COMMIT"
  git checkout "$PREV_COMMIT"
  npm ci 2>&1 | tee -a "$LOG_FILE"
  npm run build 2>&1 | tee -a "$LOG_FILE"
  log "⚠️  已回滚到上一版本"
  exit 1
fi

# 重启 PM2 进程
log "♻️  重启 PM2 进程..."
pm2 restart ecosystem.config.cjs 2>&1 | tee -a "$LOG_FILE"

# 健康检查（等待 8 秒后检测）
log "🪩 等待服务启动..."
sleep 8

HEALTH_STATUS=$(curl -sf "$HEALTH_URL" 2>/dev/null || echo '{"status":"failed"}')
if echo "$HEALTH_STATUS" | grep -q '"healthy"'; then
  log "✅ 部署成功！服务健康运行中"
  log "📊 健康检查: $HEALTH_STATUS"
else
  log "⚠️  健康检查未通过，请手动检查！"
  log "📊 响应: $HEALTH_STATUS"
  pm2 logs gtb-backend --lines 20 --nostream 2>&1 | tee -a "$LOG_FILE"
fi

log "🏁 部署流程结束"
