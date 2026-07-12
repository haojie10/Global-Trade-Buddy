import { NextApiRequest, NextApiResponse } from 'next';
import { PoolClient } from 'pg';
import { withDb } from '../../../lib/api-handler';

async function publicNewsHandler(req: NextApiRequest, res: NextApiResponse, dbClient: PoolClient) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const { industryId, region } = req.query;
  const indId = industryId && typeof industryId === 'string' ? industryId : null;
  const reg = region && typeof region === 'string' && region !== 'All' ? region : null;

  const query = `
    SELECT DISTINCT n.id, n.title, n.summary, n.created_at, n.published_at, n.source_url,
           ARRAY_TO_STRING(ARRAY(
             SELECT name FROM industries JOIN news_industries ON industries.id = news_industries.industry_id WHERE news_id = n.id
           ), ', ') as industries,
           ARRAY_TO_STRING(ARRAY(
             SELECT name FROM countries JOIN news_countries ON countries.id = news_countries.country_id WHERE news_id = n.id
           ), ', ') as countries
    FROM news n
    LEFT JOIN news_industries ni ON n.id = ni.news_id
    LEFT JOIN news_countries nc ON n.id = nc.news_id
    LEFT JOIN countries c ON nc.country_id = c.id
    WHERE n.status = 'published'
      AND ($1::uuid IS NULL OR ni.industry_id = $1)
      AND ($2::varchar IS NULL OR c.region = $2)
    ORDER BY n.published_at DESC
    LIMIT 20
  `;

  const result = await dbClient.query(query, [indId, reg]);
  return res.status(200).json(result.rows);
}

export default withDb(publicNewsHandler, {
  methods: ['GET']
});
