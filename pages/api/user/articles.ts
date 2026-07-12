import { NextApiRequest, NextApiResponse } from 'next';
import { PoolClient } from 'pg';
import { withDb } from '../../../lib/api-handler';

async function articlesUserHandler(req: NextApiRequest, res: NextApiResponse, dbClient: PoolClient) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const { region, country, industry, pageSize } = req.query;
  const size = parseInt(pageSize as string, 10) || 6;

  const values: any[] = [];
  let paramIdx = 1;
  
  let filterSql = "WHERE n.status = 'published'";
  
  if (industry && industry !== 'All') {
    values.push(industry);
    filterSql += ` AND i.name = $${paramIdx++}`;
  }
  
  if (country && country !== 'All') {
    values.push(country);
    filterSql += ` AND c.name = $${paramIdx++}`;
  } else if (region && region !== 'All') {
    values.push(region);
    filterSql += ` AND c.region = $${paramIdx++}`;
  }

  const query = `
    SELECT DISTINCT n.id, n.title, n.summary, n.published_at,
           (SELECT name FROM industries JOIN news_industries ON industries.id = news_industries.industry_id WHERE news_id = n.id LIMIT 1) as industry,
           (SELECT region FROM countries JOIN news_countries ON countries.id = news_countries.country_id WHERE news_id = n.id LIMIT 1) as region,
           (SELECT name FROM countries JOIN news_countries ON countries.id = news_countries.country_id WHERE news_id = n.id LIMIT 1) as country
    FROM news n
    LEFT JOIN news_industries ni ON n.id = ni.news_id
    LEFT JOIN industries i ON ni.industry_id = i.id
    LEFT JOIN news_countries nc ON n.id = nc.news_id
    LEFT JOIN countries c ON nc.country_id = c.id
    ${filterSql}
    ORDER BY n.published_at DESC
    LIMIT $${paramIdx}
  `;
  values.push(size);

  const result = await dbClient.query(query, values);
  
  // 转换时间为字符串以供 Next 消费
  const articles = result.rows.map(row => ({
    ...row,
    published_at: row.published_at ? row.published_at.toISOString() : null
  }));

  return res.status(200).json({ articles });
}

export default withDb(articlesUserHandler, {
  methods: ['GET']
});
