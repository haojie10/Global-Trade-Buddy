import { Client } from 'pg';

export function createTestClient(): Client {
  return new Client({
    connectionString: process.env.TEST_DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/postgres',
  });
}
