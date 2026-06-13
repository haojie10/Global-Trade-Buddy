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

  it('should contain the new entity normalization tables', async () => {
    const res = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
    `);
    const tables = res.rows.map(row => row.table_name);
    
    expect(tables).toContain('entities');
    expect(tables).toContain('entity_aliases');
    expect(tables).toContain('report_entities');
  });

  it('should have added columns to relations table', async () => {
    const res = await client.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'relations' AND table_schema = 'public'
    `);
    const columns = res.rows.map(row => row.column_name);
    
    expect(columns).toContain('market_region');
    expect(columns).toContain('relation_type');
  });

  it('should have pre-seeded entities in entities table', async () => {
    const res = await client.query(`
      SELECT canonical_name, entity_type FROM entities ORDER BY canonical_name
    `);
    const entities = res.rows;
    expect(entities.length).toBeGreaterThanOrEqual(10);
    
    const canonicalNames = entities.map(e => e.canonical_name);
    expect(canonicalNames).toContain('A 公司');
    expect(canonicalNames).toContain('B 公司');
    expect(canonicalNames).toContain('丰田汽车');
    expect(canonicalNames).toContain('铝合金轮毂');
    expect(canonicalNames).toContain('刹车片');
    expect(canonicalNames).toContain('紧固件');
    expect(canonicalNames).toContain('发光壁挂绿植环');
    expect(canonicalNames).toContain('中东非公路工程车桥');
    expect(canonicalNames).toContain('配件超市');
    expect(canonicalNames).toContain('一级供应链');
  });

  it('should have pre-seeded aliases in entity_aliases table', async () => {
    const res = await client.query(`
      SELECT alias_name FROM entity_aliases ORDER BY alias_name
    `);
    const aliases = res.rows.map(a => a.alias_name);
    expect(aliases.length).toBeGreaterThanOrEqual(4);
    expect(aliases).toContain('美国 A 公司');
    expect(aliases).toContain('美国A公司');
    expect(aliases).toContain('德国 B 公司');
    expect(aliases).toContain('汽配连锁超市');
  });
});
