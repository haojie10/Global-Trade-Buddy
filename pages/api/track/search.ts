import { NextApiRequest, NextApiResponse } from 'next';
import { PoolClient } from 'pg';
import { withDb } from '../../../lib/api-handler';
import { getSession } from '../../../lib/auth';

async function searchTrackHandler(req: NextApiRequest, res: NextApiResponse, dbClient: PoolClient) {
  const session = getSession(req);
  const userId = session ? session.userId : null;
  const { query, results_count } = req.body;

  if (!query || typeof query !== 'string') {
    return res.status(400).json({ error: 'Missing or invalid query parameter' });
  }

  const trimmedQuery = query.trim();
  const count = parseInt(results_count, 10) || 0;

  // 去重判断：5秒内相同用户（或匿名用户）对相同关键词不重复记录
  const checkRes = await dbClient.query(
    `SELECT id FROM search_logs 
     WHERE (user_id = $1 OR (user_id IS NULL AND $1 IS NULL)) 
       AND query = $2 
       AND created_at > NOW() - INTERVAL '5 seconds' 
     LIMIT 1`,
    [userId, trimmedQuery]
  );

  if (checkRes.rows.length === 0) {
    await dbClient.query(
      'INSERT INTO search_logs (user_id, query, results_count) VALUES ($1, $2, $3)',
      [userId, trimmedQuery, count]
    );
  }

  return res.status(200).json({ ok: true });
}

export default withDb(searchTrackHandler, {
  methods: ['POST'],
  requiredBody: ['query']
});
