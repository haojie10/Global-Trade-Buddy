import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { Client } from 'pg';
import { createTestClient } from './helpers/db-test-helper';

describe('PostgreSQL Schema Test', () => {
  let client: Client;

  beforeAll(async () => {
    client = createTestClient();
    await client.connect();
  });

  afterAll(async () => {
    await client.end();
  });

  it('should successfully connect to local database', async () => {
    const res = await client.query('SELECT NOW()');
    expect(res.rows[0]).toBeDefined();
  });

  it('should contain all required schema tables', async () => {
    const res = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
    `);
    const tables = res.rows.map(row => row.table_name);
    
    expect(tables).toContain('users');
    expect(tables).toContain('reports');
    expect(tables).toContain('unlocks');
    expect(tables).toContain('relations');
    expect(tables).toContain('notes');
    expect(tables).toContain('favorites');
  });
});
