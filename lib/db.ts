import { Pool } from 'pg';

const connectionString = (process.env.NODE_ENV === 'test' && process.env.TEST_DATABASE_URL)
  ? process.env.TEST_DATABASE_URL
  : (process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/postgres');

let pool: Pool;

const globalWithPool = global as typeof globalThis & {
  globalDbPool?: Pool;
};

if (process.env.NODE_ENV === 'production') {
  pool = new Pool({
    connectionString,
    max: 5,                  // 生产环境下设置适当的最大连接数，避免占用过多服务器资源
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 10000,
    ssl: undefined,
  });
  
  // 生产环境后台连接错误捕获，避免未捕获异常导致 Next.js 进程退出
  pool.on('error', (err) => {
    console.error('生产环境数据库连接池后台抛出意外错误:', err.message);
  });
} else {
  if (!globalWithPool.globalDbPool) {
    globalWithPool.globalDbPool = new Pool({
      connectionString,
      max: 10,                 // 开发环境调小最大连接数
      idleTimeoutMillis: 10000, // 缩短闲置释放时长为10秒，减少网络代理的空闲中断干扰
      connectionTimeoutMillis: 5000,
      ssl: undefined,
    });
    
    // 监听开发环境后台连接错误，拦截 Clash/VPN 等网络代理引起的闲置连接被掐断报错
    globalWithPool.globalDbPool.on('error', (err) => {
      console.warn('开发环境数据库连接池后台提示（已自动安全拦截网络代理引起的闲置连接断开）:', err.message);
    });
  }
  pool = globalWithPool.globalDbPool;
}

export default pool;
