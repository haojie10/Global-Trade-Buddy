import { NextApiRequest, NextApiResponse } from 'next';
import { PoolClient } from 'pg';
import { withDb } from '../../../lib/api-handler';
import { requireAdmin } from '../../../lib/auth';

async function countriesHandler(req: NextApiRequest, res: NextApiResponse, dbClient: PoolClient) {
  const session = requireAdmin(req);
  if (!session) {
    return res.status(403).json({ error: '权限不足，仅管理员可操作' });
  }

  if (req.method === 'GET') {
    const list = await dbClient.query('SELECT * FROM countries ORDER BY region ASC, name ASC');
    return res.status(200).json(list.rows);
  }

  return res.status(405).json({ error: 'Method Not Allowed' });
}

export default withDb(countriesHandler, {
  methods: ['GET']
});
