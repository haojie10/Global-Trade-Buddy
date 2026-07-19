import { NextApiRequest, NextApiResponse } from 'next';
import { PoolClient } from 'pg';
import { withDb } from '../../../lib/api-handler';
import { requireAdmin } from '../../../lib/auth';

async function newsAdminHandler(req: NextApiRequest, res: NextApiResponse, dbClient: PoolClient) {
  const session = requireAdmin(req);
  if (!session) {
    return res.status(403).json({ error: '权限不足，仅管理员可访问' });
  }

  // GET: 获取资讯列表
  if (req.method === 'GET') {
    const pageParam = req.query.page;
    if (pageParam) {
      const page = parseInt(pageParam as string, 10) || 1;
      const pageSize = parseInt(req.query.pageSize as string, 10) || 20;
      const offset = (page - 1) * pageSize;

      const countRes = await dbClient.query('SELECT COUNT(*) FROM news');
      const total = parseInt(countRes.rows[0].count, 10);

      const listRes = await dbClient.query(
        `SELECT n.id, n.title, n.summary, n.content, n.source_url, n.status, n.published_at, n.created_at,
                ARRAY_TO_STRING(ARRAY(SELECT name FROM industries JOIN news_industries ON industries.id = news_industries.industry_id WHERE news_id = n.id), ', ') as industries,
                ARRAY_TO_STRING(ARRAY(SELECT name FROM countries JOIN news_countries ON countries.id = news_countries.country_id WHERE news_id = n.id), ', ') as countries
         FROM news n
         ORDER BY n.created_at DESC
         LIMIT $1 OFFSET $2`,
        [pageSize, offset]
      );
      return res.status(200).json({
        data: listRes.rows,
        total,
        page,
        pageSize
      });
    } else {
      const listRes = await dbClient.query(
        `SELECT n.id, n.title, n.summary, n.content, n.source_url, n.status, n.published_at, n.created_at,
                ARRAY_TO_STRING(ARRAY(SELECT name FROM industries JOIN news_industries ON industries.id = news_industries.industry_id WHERE news_id = n.id), ', ') as industries,
                ARRAY_TO_STRING(ARRAY(SELECT name FROM countries JOIN news_countries ON countries.id = news_countries.country_id WHERE news_id = n.id), ', ') as countries
         FROM news n
         ORDER BY n.created_at DESC`
      );
      return res.status(200).json(listRes.rows);
    }
  }

  // POST: 创建资讯
  if (req.method === 'POST') {
    const { title, summary, content, source_url, status, industry_ids, country_ids } = req.body;
    if (!title) {
      return res.status(400).json({ error: 'Missing title' });
    }

    const finalStatus = status || 'draft';
    const publishedAt = finalStatus === 'published' ? new Date() : null;

    await dbClient.query('BEGIN');
    try {
      const insertRes = await dbClient.query(
        `INSERT INTO news (title, summary, content, source_url, status, published_at)
         VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
        [title, summary, content, source_url, finalStatus, publishedAt]
      );
      const newsId = insertRes.rows[0].id;

      // 关联行业
      if (Array.isArray(industry_ids)) {
        for (const indId of industry_ids) {
          if (indId) {
            await dbClient.query('INSERT INTO news_industries (news_id, industry_id) VALUES ($1, $2)', [newsId, indId]);
          }
        }
      }

      // 关联国家
      if (Array.isArray(country_ids)) {
        for (const ctyId of country_ids) {
          if (ctyId) {
            await dbClient.query('INSERT INTO news_countries (news_id, country_id) VALUES ($1, $2)', [newsId, ctyId]);
          }
        }
      }

      await dbClient.query('COMMIT');
      return res.status(200).json({ success: true, newsId });
    } catch (err) {
      await dbClient.query('ROLLBACK');
      throw err;
    }
  }

  // PUT: 修改资讯
  if (req.method === 'PUT') {
    const { id, title, summary, content, source_url, status, industry_ids, country_ids } = req.body;
    if (!id || !title) {
      return res.status(400).json({ error: 'Missing id or title' });
    }

    await dbClient.query('BEGIN');
    try {
      // 1. 获取原状态
      const origRes = await dbClient.query('SELECT status FROM news WHERE id = $1', [id]);
      if (origRes.rows.length === 0) {
        return res.status(404).json({ error: 'News item not found' });
      }
      const origStatus = origRes.rows[0].status;
      let publishedAtUpdate = null;
      if (status === 'published') {
        publishedAtUpdate = origStatus === 'published' ? undefined : new Date(); // 新发布设当前时间，原已发布保持不变
      }

      if (publishedAtUpdate !== undefined) {
        await dbClient.query(
          `UPDATE news 
           SET title = $1, summary = $2, content = $3, source_url = $4, status = $5, published_at = COALESCE($6, published_at), updated_at = NOW()
           WHERE id = $7`,
          [title, summary, content, source_url, status, publishedAtUpdate, id]
        );
      } else {
        await dbClient.query(
          `UPDATE news 
           SET title = $1, summary = $2, content = $3, source_url = $4, status = $5, updated_at = NOW()
           WHERE id = $6`,
          [title, summary, content, source_url, status, id]
        );
      }

      // 2. 更新关联行业
      await dbClient.query('DELETE FROM news_industries WHERE news_id = $1', [id]);
      if (Array.isArray(industry_ids)) {
        for (const indId of industry_ids) {
          if (indId) {
            await dbClient.query('INSERT INTO news_industries (news_id, industry_id) VALUES ($1, $2)', [id, indId]);
          }
        }
      }

      // 3. 更新关联国家
      await dbClient.query('DELETE FROM news_countries WHERE news_id = $1', [id]);
      if (Array.isArray(country_ids)) {
        for (const ctyId of country_ids) {
          if (ctyId) {
            await dbClient.query('INSERT INTO news_countries (news_id, country_id) VALUES ($1, $2)', [id, ctyId]);
          }
        }
      }

      await dbClient.query('COMMIT');
      return res.status(200).json({ success: true });
    } catch (err) {
      await dbClient.query('ROLLBACK');
      throw err;
    }
  }

  // DELETE: 删除资讯
  if (req.method === 'DELETE') {
    const { id } = req.query;
    if (!id) {
      return res.status(400).json({ error: 'Missing id' });
    }
    await dbClient.query('DELETE FROM news WHERE id = $1', [id]);
    return res.status(200).json({ success: true });
  }

  return res.status(405).json({ error: 'Method Not Allowed' });
}

export default withDb(newsAdminHandler, {
  methods: ['GET', 'POST', 'PUT', 'DELETE']
});
