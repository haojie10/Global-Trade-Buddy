import { NextApiRequest, NextApiResponse } from 'next';
import { PoolClient } from 'pg';
import { withDb } from '../../../../lib/api-handler';
import { buildWikiMarkdownExport } from '../../../../lib/wiki-schema';

async function wikiMarkdownHandler(req: NextApiRequest, res: NextApiResponse, dbClient: PoolClient) {
  const rawSlug = Array.isArray(req.query.slug) ? req.query.slug[0] : req.query.slug;
  const slug = typeof rawSlug === 'string'
    ? rawSlug.trim().replace(/\.md$/i, '').toLowerCase()
    : '';

  if (!slug) {
    return res.status(400).json({ error: '缺少有效的词条 slug' });
  }

  const result = await dbClient.query(
    `SELECT slug, title, summary, country_code, country_name, market_region,
            industry_name, hs_code_6, archetype_id, flow_data, content_md,
            faq_items, sources, updated_at
     FROM wiki_entries
     WHERE slug = $1 AND status = 'published'
     LIMIT 1`,
    [slug]
  );

  if (result.rows.length === 0) {
    return res.status(404).json({ error: '词条不存在或未发布' });
  }

  const row = result.rows[0];
  const updatedAt =
    row.updated_at instanceof Date
      ? row.updated_at.toISOString()
      : (row.updated_at ? String(row.updated_at) : undefined);

  const markdown = buildWikiMarkdownExport({
    slug: row.slug,
    title: row.title,
    summary: row.summary,
    country_code: row.country_code,
    country_name: row.country_name,
    market_region: row.market_region,
    industry_name: row.industry_name,
    hs_code_6: row.hs_code_6,
    archetype_id: row.archetype_id,
    flow_data: typeof row.flow_data === 'string' ? JSON.parse(row.flow_data) : row.flow_data,
    content_md: row.content_md,
    faq_items: typeof row.faq_items === 'string' ? JSON.parse(row.faq_items) : row.faq_items,
    sources: typeof row.sources === 'string' ? JSON.parse(row.sources) : row.sources,
    updated_at: updatedAt,
  });

  res.setHeader('Content-Type', 'text/markdown; charset=utf-8');
  res.setHeader('Cache-Control', 'public, max-age=300, stale-while-revalidate=600');
  return res.status(200).send(markdown);
}

export default withDb(wikiMarkdownHandler, { methods: ['GET'] });
