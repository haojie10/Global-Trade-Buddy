import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { describe, it, expect, vi, afterEach } from 'vitest';
import pool from '../lib/db';
import { getServerSideProps as getSitemapSsrProps } from '../pages/sitemap.xml';
import llmsHandler from '../pages/api/llms';

const ROOT_DIR = path.resolve(__dirname, '..');

describe('任务 9：行业百科 GEO 配置、导航、Sitemap 与百度推送回归测试', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('next.config.js 应配置 beforeFiles/afterFiles 重写规则并在 CSP 中允许 media-src', async () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const nextConfig = require('../next.config.js');
    const rewrites = await nextConfig.rewrites();

    expect(rewrites).toHaveProperty('beforeFiles');
    expect(rewrites).toHaveProperty('afterFiles');
    expect(rewrites.beforeFiles).toEqual(
      expect.arrayContaining([
        { source: '/llms.txt', destination: '/api/llms' },
        { source: '/wiki/:slug.md', destination: '/api/wiki/:slug/markdown' },
      ])
    );
    expect(rewrites.afterFiles).toEqual(
      expect.arrayContaining([
        { source: '/baidu_verify_:slug*.html', destination: '/api/verify-baidu' },
      ])
    );

    const headersList = await nextConfig.headers();
    const globalHeaderRule = headersList.find((item: any) => item.source === '/:path*');
    const cspHeader = globalHeaderRule?.headers?.find(
      (h: any) => h.key === 'Content-Security-Policy'
    );
    expect(cspHeader?.value).toContain("media-src 'self' blob: https:");
  });

  it('public/robots.txt 应欢迎主流 AI 爬虫索引 /wiki 与 /llms.txt 并屏蔽后台路径', () => {
    const robotsPath = path.join(ROOT_DIR, 'public', 'robots.txt');
    const content = fs.readFileSync(robotsPath, 'utf-8');

    for (const bot of ['GPTBot', 'OAI-SearchBot', 'ChatGPT-User', 'PerplexityBot', 'ClaudeBot', 'Google-Extended', 'Bytespider', 'Baiduspider']) {
      expect(content).toContain(`User-agent: ${bot}`);
    }
    expect(content).toContain('Allow: /wiki');
    expect(content).toContain('Allow: /llms.txt');
    expect(content).toContain('Disallow: /admin/');
    expect(content).toContain('Disallow: /api/');
    expect(content).toContain('Disallow: /my-graph');
    expect(content).toContain('Disallow: /story-demo');
    expect(content).toContain('Sitemap: https://marketgraphic.cn/sitemap.xml');
  });

  it('pages/sitemap.xml.tsx 应包含 /wiki 静态枢纽页、已发布百科节点并采纳最新 wiki updated_at', async () => {
    const mockQuery = vi.fn(async (sql: string) => {
      if (sql.includes('FROM reports')) {
        return { rows: [{ id: 'r-1', created_at: new Date('2026-11-20T00:00:00.000Z') }] };
      }
      if (sql.includes('FROM news')) {
        return { rows: [{ id: 'n-1', published_at: new Date('2026-11-21T00:00:00.000Z') }] };
      }
      if (sql.includes('FROM wiki_entries')) {
        return {
          rows: [
            { slug: 'de-lighting', updated_at: new Date('2026-11-24T08:00:00.000Z') },
          ],
        };
      }
      return { rows: [] };
    });
    const mockRelease = vi.fn();

    vi.spyOn(pool, 'connect').mockResolvedValue({
      query: mockQuery,
      release: mockRelease,
    } as any);

    let xmlOutput = '';
    const res = {
      setHeader: vi.fn(),
      write: vi.fn((chunk: string) => {
        xmlOutput += chunk;
      }),
      end: vi.fn(),
    } as any;

    await getSitemapSsrProps({ res } as any);

    expect(xmlOutput).toContain('<loc>https://marketgraphic.cn/wiki</loc>');
    expect(xmlOutput).toContain('<priority>0.9</priority>');
    expect(xmlOutput).toContain('<loc>https://marketgraphic.cn/wiki/de-lighting</loc>');
    expect(xmlOutput).toContain('<priority>0.85</priority>');
    expect(xmlOutput).toContain('<lastmod>2026-11-24T08:00:00.000Z</lastmod>');
    expect(mockRelease).toHaveBeenCalledTimes(1);
  });

  it('pages/sitemap.xml.tsx 在 wiki_entries 尚未迁移报错时仍能容错输出其余 Sitemap', async () => {
    const mockQuery = vi.fn(async (sql: string) => {
      if (sql.includes('FROM reports')) {
        return { rows: [{ id: 'r-1', created_at: new Date('2026-11-20T00:00:00.000Z') }] };
      }
      if (sql.includes('FROM news')) {
        return { rows: [] };
      }
      if (sql.includes('FROM wiki_entries')) {
        throw new Error('relation "wiki_entries" does not exist');
      }
      return { rows: [] };
    });
    const mockRelease = vi.fn();

    vi.spyOn(pool, 'connect').mockResolvedValue({
      query: mockQuery,
      release: mockRelease,
    } as any);

    let xmlOutput = '';
    const res = {
      setHeader: vi.fn(),
      write: vi.fn((chunk: string) => {
        xmlOutput += chunk;
      }),
      end: vi.fn(),
    } as any;

    await getSitemapSsrProps({ res } as any);

    expect(xmlOutput).toContain('<loc>https://marketgraphic.cn/wiki</loc>');
    expect(xmlOutput).toContain('<loc>https://marketgraphic.cn/reports/r-1</loc>');
    expect(mockRelease).toHaveBeenCalledTimes(1);
  });

  it('bin/push-to-baidu.js 应语法合法且包含 wiki_entries 队列捞取、手动识别与回写逻辑', () => {
    const scriptPath = path.join(ROOT_DIR, 'bin', 'push-to-baidu.js');
    execFileSync(process.execPath, ['--check', scriptPath], { stdio: 'pipe' });

    const scriptContent = fs.readFileSync(scriptPath, 'utf-8');
    expect(scriptContent).toContain('\\/wiki\\/([a-z0-9-]+)');
    expect(scriptContent).toContain('`${BASE_URL}/wiki`');
    expect(scriptContent).toContain('ALTER TABLE wiki_entries ADD COLUMN IF NOT EXISTS baidu_pushed_at');
    expect(scriptContent).toContain('FROM wiki_entries');
    expect(scriptContent).toContain('WHERE id = ANY($1::uuid[])');
    expect(scriptContent).toContain('WHERE slug = ANY($1::text[])');
  });

  it('Navbar 与 Footer 应包含 /wiki 行业百科入口', () => {
    const navbarContent = fs.readFileSync(path.join(ROOT_DIR, 'components', 'Navbar.tsx'), 'utf-8');
    const footerContent = fs.readFileSync(path.join(ROOT_DIR, 'components', 'Footer.tsx'), 'utf-8');

    expect(navbarContent).toContain('href="/wiki"');
    expect(navbarContent).toContain('行业百科');
    expect(footerContent).toContain('href="/wiki"');
    expect(footerContent).toContain('行业百科');
  });

  it('GET /api/llms 在 wiki_entries 尚未迁移时应降级返回 200 静态栏目目录而非 500', async () => {
    const mockRelease = vi.fn();
    vi.spyOn(pool, 'connect').mockResolvedValue({
      query: vi.fn().mockRejectedValue(new Error('relation "wiki_entries" does not exist')),
      release: mockRelease,
    } as any);

    let statusCode = 0;
    let body = '';
    const res = {
      setHeader: vi.fn(),
      status: vi.fn((code: number) => {
        statusCode = code;
        return res;
      }),
      send: vi.fn((payload: string) => {
        body = payload;
        return res;
      }),
      json: vi.fn(),
    } as any;

    await llmsHandler({ method: 'GET', url: '/api/llms', query: {}, headers: {} } as any, res);
    expect(statusCode).toBe(200);
    expect(body).toContain('Market Graphic');
    expect(body).toContain('https://marketgraphic.cn/wiki');
    expect(mockRelease).toHaveBeenCalledTimes(1);
  });
});
