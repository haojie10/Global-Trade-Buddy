import { NextApiRequest, NextApiResponse } from 'next';
import { PoolClient } from 'pg';
import { withDb } from '../../../../lib/api-handler';
import { requireAdmin } from '../../../../lib/auth';
import { runDehydration, extractAndNormalizeEntities } from '../../../../lib/entity-extractor';
import { uploadImage } from '../../../../lib/storage';

async function createHandler(req: NextApiRequest, res: NextApiResponse, dbClient: PoolClient) {
  const adminSession = requireAdmin(req);
  if (!adminSession) {
    return res.status(403).json({ error: '权限不足，仅管理员可发布资讯' });
  }

  const { title, summary, contentHtml, region, country, industry, tags } = req.body;
  if (!title || !contentHtml) {
    return res.status(400).json({ error: 'Missing title or contentHtml' });
  }

  await dbClient.query('BEGIN');

  const { cleanHtml } = await runDehydration(contentHtml, uploadImage);

  const insertRes = await dbClient.query(
    `INSERT INTO articles (title, summary, content_html, region, country, industry, source)
     VALUES ($1, $2, $3, $4, $5, $6, 'manual') RETURNING id`,
    [title, summary || '', cleanHtml, region || null, country || null, industry || null]
  );
  const newId = insertRes.rows[0].id;

  const resolvedEntities = await extractAndNormalizeEntities(contentHtml, title, dbClient, tags);
  for (const ent of resolvedEntities) {
    await dbClient.query(
      `INSERT INTO article_entities (article_id, entity_id, role)
       VALUES ($1, $2, $3) ON CONFLICT (article_id, entity_id) DO NOTHING`,
      [newId, ent.id, ent.role]
    );
  }

  await dbClient.query('COMMIT');
  return res.status(200).json({ success: true, id: newId });
}

export default withDb(createHandler, { methods: ['POST'] });
