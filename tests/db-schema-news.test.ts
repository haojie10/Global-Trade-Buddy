import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { Client } from 'pg';
import { createTestClient } from './helpers/db-test-helper';

describe('Daily News Schema Tests', () => {
  let dbClient: Client;

  beforeAll(async () => {
    dbClient = createTestClient();
    await dbClient.connect();
  });

  afterAll(async () => {
    await dbClient.end();
  });

  it('should verify articles and article_entities tables exist with correct fields', async () => {
    const articlesRes = await dbClient.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'articles' AND table_schema = current_schema()
    `);
    expect(articlesRes.rows.length).toBeGreaterThan(0);
    const columns = articlesRes.rows.map(r => r.column_name);
    expect(columns).toContain('id');
    expect(columns).toContain('title');
    expect(columns).toContain('summary');
    expect(columns).toContain('content_html');
    expect(columns).toContain('region');
    expect(columns).toContain('country');
    expect(columns).toContain('industry');
    expect(columns).toContain('source');
    expect(columns).toContain('published_at');

    const entitiesRes = await dbClient.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'article_entities' AND table_schema = current_schema()
    `);
    expect(entitiesRes.rows.length).toBeGreaterThan(0);
  });
});
