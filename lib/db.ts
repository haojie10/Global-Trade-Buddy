import { Pool } from 'pg';

const connectionString = process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/postgres';

const isSupabase = connectionString.includes('supabase.co') || connectionString.includes('supabase.net') || connectionString.includes('pooler.supabase.com');
const sslConfig = isSupabase ? { rejectUnauthorized: false } : undefined;

if (isSupabase) {
  // Disable TLS certificate validation in development/local proxy environments (e.g., Clash)
  // to avoid 'SELF_SIGNED_CERT_IN_CHAIN' errors when connecting to the Supabase pooler.
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
}

let pool: Pool;

const globalWithPool = global as typeof globalThis & {
  globalDbPool?: Pool;
};

if (process.env.NODE_ENV === 'production') {
  pool = new Pool({
    connectionString,
    max: 20,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 10000,
    ssl: sslConfig,
  });
} else {
  if (!globalWithPool.globalDbPool) {
    globalWithPool.globalDbPool = new Pool({
      connectionString,
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 10000,
      ssl: sslConfig,
    });
  }
  pool = globalWithPool.globalDbPool;
}

export default pool;
