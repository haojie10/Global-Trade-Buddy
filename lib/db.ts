import { Pool } from 'pg';

const connectionString = process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/postgres';

let pool: Pool;

const globalWithPool = global as typeof globalThis & {
  globalDbPool?: Pool;
};

if (process.env.NODE_ENV === 'production') {
  pool = new Pool({
    connectionString,
    max: 20,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 2000,
  });
} else {
  if (!globalWithPool.globalDbPool) {
    globalWithPool.globalDbPool = new Pool({
      connectionString,
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 2000,
    });
  }
  pool = globalWithPool.globalDbPool;
}

export default pool;
