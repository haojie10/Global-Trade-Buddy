import { NextApiRequest, NextApiResponse } from 'next';
import { PoolClient } from 'pg';
import { withDb } from '../../../lib/api-handler';

async function newsDetailHandler(req: NextApiRequest, res: NextApiResponse, dbClient: PoolClient) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const { id } = req.query;
  if (!id || typeof id !== 'string') {
    return res.status(400).json({ error: 'Missing or invalid news id' });
  }

  // 1. 获取资讯主内容及标签
  const newsRes = await dbClient.query(
    `SELECT n.id, n.title, n.summary, n.content, n.source_url, n.published_at,
            ARRAY_TO_STRING(ARRAY(SELECT name FROM industries JOIN news_industries ON industries.id = news_industries.industry_id WHERE news_id = n.id), ', ') as industries,
            ARRAY_TO_STRING(ARRAY(SELECT name FROM countries JOIN news_countries ON countries.id = news_countries.country_id WHERE news_id = n.id), ', ') as countries
     FROM news n
     WHERE n.id = $1 AND n.status = 'published'`,
    [id]
  );

  if (newsRes.rows.length === 0) {
    return res.status(404).json({ error: '资讯未找到或未公开发布' });
  }

  const newsItem = newsRes.rows[0];

  // 2. 查找具有相同行业关联的推荐报告
  const relatedReportsRes = await dbClient.query(
    `SELECT DISTINCT r.id, r.title, r.category, r.market_region, r.summary
     FROM reports r
     JOIN report_industries ri ON r.id = ri.report_id
     WHERE ri.industry_id IN (
       SELECT industry_id FROM news_industries WHERE news_id = $1
     )
     LIMIT 3`,
    [id]
  );
  const relatedReports = relatedReportsRes.rows;

  return res.status(200).json({
    news: newsItem,
    relatedReports
  });
}

export default withDb(newsDetailHandler, {
  methods: ['GET']
});
