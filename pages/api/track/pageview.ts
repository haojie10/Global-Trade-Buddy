import { NextApiRequest, NextApiResponse } from 'next';
import { PoolClient } from 'pg';
import { withDb } from '../../../lib/api-handler';
import { getSession } from '../../../lib/auth';

async function pageViewHandler(req: NextApiRequest, res: NextApiResponse, dbClient: PoolClient) {
  // 获取 session 中的 userId
  const session = getSession(req);
  const userId = session ? session.userId : null;

  if (req.method === 'POST') {
    const { content_type, content_id, view_id, duration_seconds } = req.body;

    // 如果提供了 view_id，说明是更新操作
    if (view_id) {
      const dur = parseInt(duration_seconds, 10) || 0;
      await dbClient.query(
        'UPDATE page_views SET duration_seconds = $1 WHERE id = $2',
        [dur, view_id]
      );
      return res.status(200).json({ success: true });
    }

    // 否则是新建操作
    if (!content_type || !content_id) {
      return res.status(400).json({ error: 'Missing content_type or content_id' });
    }

    const insertRes = await dbClient.query(
      'INSERT INTO page_views (user_id, content_type, content_id) VALUES ($1, $2, $3) RETURNING id',
      [userId, content_type, content_id]
    );
    const newViewId = insertRes.rows[0].id;

    return res.status(200).json({ view_id: newViewId });
  }

  // 同时也支持 PATCH 更新
  if (req.method === 'PATCH') {
    const { view_id, duration_seconds } = req.body;
    if (!view_id) {
      return res.status(400).json({ error: 'Missing view_id' });
    }
    const dur = parseInt(duration_seconds, 10) || 0;
    await dbClient.query(
      'UPDATE page_views SET duration_seconds = $1 WHERE id = $2',
      [dur, view_id]
    );
    return res.status(200).json({ success: true });
  }

  return res.status(405).json({ error: 'Method Not Allowed' });
}

export default withDb(pageViewHandler, {
  methods: ['POST', 'PATCH']
});
