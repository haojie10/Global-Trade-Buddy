import { NextApiRequest, NextApiResponse } from 'next';
import { PoolClient } from 'pg';
import { withDb } from '../../../lib/api-handler';
import { requireAdmin } from '../../../lib/auth';
import { STANDARD_CATEGORIES } from '../../../lib/category-mapper';

async function industriesHandler(req: NextApiRequest, res: NextApiResponse, dbClient: PoolClient) {
  const session = requireAdmin(req);
  if (!session) {
    return res.status(403).json({ error: '权限不足，仅管理员可操作' });
  }

  if (req.method === 'GET') {
    const list = await dbClient.query(
      'SELECT * FROM industries WHERE name = ANY($1) ORDER BY name ASC',
      [STANDARD_CATEGORIES]
    );
    return res.status(200).json(list.rows);
  }

  if (req.method === 'POST') {
    const { name } = req.body;
    if (!name || typeof name !== 'string') {
      return res.status(400).json({ error: 'Missing or invalid industry name' });
    }
    const result = await dbClient.query(
      'INSERT INTO industries (name) VALUES ($1) ON CONFLICT (name) DO UPDATE SET name = EXCLUDED.name RETURNING *',
      [name.trim()]
    );
    return res.status(200).json(result.rows[0]);
  }

  if (req.method === 'DELETE') {
    const { id } = req.query;
    if (!id) {
      return res.status(400).json({ error: 'Missing industry id' });
    }
    await dbClient.query('DELETE FROM industries WHERE id = $1', [id]);
    return res.status(200).json({ success: true });
  }

  return res.status(405).json({ error: 'Method Not Allowed' });
}

export default withDb(industriesHandler, {
  methods: ['GET', 'POST', 'DELETE']
});
