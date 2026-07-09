import { defineConfig } from 'vitest/config';
import dotenv from 'dotenv';

dotenv.config();

process.env.TEST_DATABASE_URL = process.env.TEST_DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/postgres_test';
process.env.DATABASE_URL = process.env.TEST_DATABASE_URL || process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/postgres_test';

export default defineConfig({
  test: {
    environment: 'node',
    globalSetup: './tests/helpers/test-setup.ts',
    exclude: ['**/node_modules/**', '**/dist/**', '**/.worktrees/**', '**/.next/**'],
    testTimeout: 30000,
  },
});
