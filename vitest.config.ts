import { defineConfig } from 'vitest/config';

process.env.TEST_DATABASE_URL = 'postgresql://postgres:postgres@localhost:5432/postgres_test';
process.env.DATABASE_URL = 'postgresql://postgres:postgres@localhost:5432/postgres_test';

export default defineConfig({
  test: {
    environment: 'node',
    globalSetup: './tests/helpers/test-setup.ts',
    exclude: ['**/node_modules/**', '**/dist/**', '**/.worktrees/**', '**/.next/**'],
  },
});
