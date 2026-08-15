module.exports = {
  apps: [{
    name: 'gtb-backend',
    script: 'node_modules/.bin/next',
    args: 'start -H 0.0.0.0 -p 3000',
    instances: 1,
    exec_mode: 'fork',
    max_memory_restart: '512M',
    env: {
      NODE_ENV: 'production',
      PORT: 3000,
    },
    // 日志配置
    error_file: '/home/ubuntu/logs/gtb-error.log',
    out_file: '/home/ubuntu/logs/gtb-out.log',
    merge_logs: true,
    log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
    // 重启策略
    max_restarts: 10,
    min_uptime: '10s',
    restart_delay: 5000,
    // 优雅停机
    kill_timeout: 10000,
    listen_timeout: 10000,
    shutdown_with_message: true,
  }]
};
