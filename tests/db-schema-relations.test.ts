import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { Client } from 'pg';
import { createTestClient } from './helpers/db-test-helper';

describe('Database Schema Relations', () => {
  let dbClient: Client;

  beforeAll(async () => {
    dbClient = createTestClient();
    await dbClient.connect();
  });

  afterAll(async () => {
    await dbClient.end();
  });

  it('should verify entity_relations table exists and has correct columns', async () => {
    const res = await dbClient.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'entity_relations'
    `);
    expect(res.rows.length).toBeGreaterThan(0);
    
    const cols = res.rows.map(r => r.column_name);
    expect(cols).toContain('entity_id_a');
    expect(cols).toContain('entity_id_b');
    expect(cols).toContain('relation_type');
    expect(cols).toContain('market_region');
  });
});
