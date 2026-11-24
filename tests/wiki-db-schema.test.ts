import { describe, it, expect, vi, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import pool from '../lib/db';
import pageViewHandler from '../pages/api/track/pageview';
import { cleanDatabase, mockReqRes } from './helpers/db-test-helper';

const WIKI_MIGRATION_PATH = path.join(
  process.cwd(),
  'supabase',
  'migrations',
  '20261124000000_wiki_entries_schema.sql'
);

describe('行业百科数据库迁移与浏览计数适配（离线单元测试）', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('迁移 SQL 包含 wiki_entries 主表、唯一 slug、5 个索引、状态约束及 page_views 扩展约束', () => {
    expect(fs.existsSync(WIKI_MIGRATION_PATH)).toBe(true);
    const sql = fs.readFileSync(WIKI_MIGRATION_PATH, 'utf8');

    expect(sql).toContain('CREATE TABLE IF NOT EXISTS wiki_entries');
    expect(sql).toContain('slug VARCHAR(120) UNIQUE NOT NULL');
    expect(sql).toContain("CHECK (status IN ('draft', 'published'))");

    const requiredIndexes = [
      'idx_wiki_entries_status_pub',
      'idx_wiki_entries_industry',
      'idx_wiki_entries_country',
      'idx_wiki_entries_archetype',
      'idx_wiki_entries_baidu_pushed_at',
    ];
    for (const indexName of requiredIndexes) {
      expect(sql).toContain(indexName);
    }

    expect(sql).toContain('ALTER TABLE page_views DROP CONSTRAINT IF EXISTS page_views_content_type_check');
    expect(sql).toContain("CHECK (content_type IN ('report', 'news', 'wiki'))");
  });

  it('POST /api/track/pageview 在 content_type 为 wiki 时写入 page_views 并参数化递增 wiki_entries.view_count', async () => {
    const executedQueries: Array<{ text: string; params?: any[] }> = [];
    const mockRelease = vi.fn();
    const mockClient = {
      query: vi.fn(async (text: string, params?: any[]) => {
        executedQueries.push({ text, params });
        if (text.includes('INSERT INTO page_views')) {
          return { rows: [{ id: '00000000-0000-0000-0000-000000009999' }], rowCount: 1 };
        }
        return { rows: [], rowCount: 1 };
      }),
      release: mockRelease,
    };

    vi.spyOn(pool, 'connect').mockResolvedValue(mockClient as any);

    const wikiId = '00000000-0000-0000-0000-000000000111';
    const { req, res, getStatus, getJson } = mockReqRes({
      method: 'POST',
      body: {
        content_type: 'wiki',
        content_id: wikiId,
      },
    });
    req.url = '/api/track/pageview';

    await pageViewHandler(req, res);

    expect(getStatus()).toBe(200);
    expect(getJson()).toEqual({ view_id: '00000000-0000-0000-0000-000000009999' });

    const insertCall = executedQueries.find((q) => q.text.includes('INSERT INTO page_views'));
    expect(insertCall).toBeDefined();
    expect(insertCall?.params).toEqual([null, 'wiki', wikiId]);

    const updateWikiCall = executedQueries.find((q) =>
      q.text.includes('UPDATE wiki_entries SET view_count = view_count + 1 WHERE id = $1::uuid')
    );
    expect(updateWikiCall).toBeDefined();
    expect(updateWikiCall?.params).toEqual([wikiId]);
    expect(mockRelease).toHaveBeenCalledTimes(1);
  });

  it('POST /api/track/pageview 在 content_type 为 report 时不更新 wiki_entries', async () => {
    const executedQueries: Array<{ text: string; params?: any[] }> = [];
    const mockRelease = vi.fn();
    const mockClient = {
      query: vi.fn(async (text: string, params?: any[]) => {
        executedQueries.push({ text, params });
        if (text.includes('INSERT INTO page_views')) {
          return { rows: [{ id: '00000000-0000-0000-0000-000000008888' }], rowCount: 1 };
        }
        return { rows: [], rowCount: 1 };
      }),
      release: mockRelease,
    };

    vi.spyOn(pool, 'connect').mockResolvedValue(mockClient as any);

    const reportId = '00000000-0000-0000-0000-000000000222';
    const { req, res, getStatus, getJson } = mockReqRes({
      method: 'POST',
      body: {
        content_type: 'report',
        content_id: reportId,
      },
    });
    req.url = '/api/track/pageview';

    await pageViewHandler(req, res);

    expect(getStatus()).toBe(200);
    expect(getJson()).toEqual({ view_id: '00000000-0000-0000-0000-000000008888' });

    const insertCall = executedQueries.find((q) => q.text.includes('INSERT INTO page_views'));
    expect(insertCall).toBeDefined();
    expect(insertCall?.params).toEqual([null, 'report', reportId]);

    const updateWikiCall = executedQueries.find((q) => q.text.includes('UPDATE wiki_entries'));
    expect(updateWikiCall).toBeUndefined();
    expect(mockRelease).toHaveBeenCalledTimes(1);
  });

  it('测试辅助工具 cleanDatabase 与 test-setup 支持 wiki_entries 表补齐与清理', async () => {
    const executedSql: string[] = [];
    const mockClient = {
      query: vi.fn(async (sql: string) => {
        executedSql.push(sql);
        if (sql.includes('SHOW search_path')) {
          return { rows: [{ search_path: 'public' }] };
        }
        if (sql.includes("table_name = 'reports'")) {
          return { rows: [{ exists: true }] };
        }
        if (sql.includes("table_name = 'wiki_entries'")) {
          return { rows: [{ exists: false }] };
        }
        return { rows: [] };
      }),
    };

    await cleanDatabase(mockClient);

    expect(executedSql.some((s) => s.includes("table_name = 'wiki_entries'"))).toBe(true);
    expect(executedSql.some((s) => s.includes('CREATE TABLE IF NOT EXISTS wiki_entries'))).toBe(true);
    expect(executedSql.some((s) => s.trim() === 'DELETE FROM wiki_entries')).toBe(true);

    const testSetupSource = fs.readFileSync(
      path.join(process.cwd(), 'tests', 'helpers', 'test-setup.ts'),
      'utf8'
    );
    expect(testSetupSource).toContain("'wiki_entries'");
  });
});
