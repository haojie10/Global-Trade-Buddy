import { NextApiRequest, NextApiResponse } from 'next';
import { PoolClient } from 'pg';
import { withDb } from '../../../lib/api-handler';

async function listHandler(req: NextApiRequest, res: NextApiResponse, dbClient: PoolClient) {
  const { region, country, industry, page = '1', pageSize = '20' } = req.query;

  const p = parseInt(page as string) || 1;
  const size = parseInt(pageSize as string) || 20;
  const offset = (p - 1) * size;

  let queryText = `SELECT id, title, summary, region, country, industry, published_at FROM articles WHERE 1=1`;
  let countText = `SELECT COUNT(*) FROM articles WHERE 1=1`;
  const params: any[] = [];
  let pCount = 1;

  if (region && region !== 'All') {
    queryText += ` AND region = $${pCount}`;
    countText += ` AND region = $${pCount}`;
    params.push(region);
    pCount++;
  }
  if (country && country !== 'All') {
    queryText += ` AND country = $${pCount}`;
    countText += ` AND country = $${pCount}`;
    params.push(country);
    pCount++;
  }
  if (industry && industry !== 'All') {
    queryText += ` AND industry = $${pCount}`;
    countText += ` AND industry = $${pCount}`;
    params.push(industry);
    pCount++;
  }

  // 获取总数
  const countRes = await dbClient.query(countText, params);
  const total = parseInt(countRes.rows[0].count) || 0;

  // 获取分页列表
  queryText += ` ORDER BY published_at DESC LIMIT $${pCount} OFFSET $${pCount + 1}`;
  params.push(size, offset);

  const listRes = await dbClient.query(queryText, params);

  return res.status(200).json({
    articles: listRes.rows,
    total,
    page: p,
    pageSize: size
  });
}

export default withDb(listHandler, { methods: ['GET'] });
