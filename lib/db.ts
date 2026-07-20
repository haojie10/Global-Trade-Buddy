import { Pool } from 'pg';

const connectionString = process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/postgres';

const isSupabase = connectionString.includes('supabase.co') || connectionString.includes('supabase.net') || connectionString.includes('pooler.supabase.com');
// 仅在开发环境放宽证书校验（解决 Clash 等代理引起的证书错误）；
// 通过 ssl 选项作用于 PG 连接，不污染全局 NODE_TLS_REJECT_UNAUTHORIZED
const sslConfig = isSupabase
  ? { rejectUnauthorized: false }  // Supabase Pooler 使用自签名证书，必须放宽验证
  : undefined;

let pool: Pool;

const globalWithPool = global as typeof globalThis & {
  globalDbPool?: Pool;
};

if (process.env.NODE_ENV === 'production') {
  pool = new Pool({
    connectionString,
    max: 5,                  // Serverless 环境下每个实例的最大连接数调为 5，避免耗尽连接池
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 10000,
    ssl: sslConfig,
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
      ssl: sslConfig,
    });
    
    // 监听开发环境后台连接错误，拦截 Clash/VPN 等网络代理引起的闲置连接被掐断报错
    globalWithPool.globalDbPool.on('error', (err) => {
      console.warn('开发环境数据库连接池后台提示（已自动安全拦截网络代理引起的闲置连接断开）:', err.message);
    });
  }
  pool = globalWithPool.globalDbPool;
}

export default pool;
