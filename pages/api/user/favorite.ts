import { NextApiRequest, NextApiResponse } from 'next';
import pool from '../../../lib/db';

// 检查是否收藏 (供 API 和单元测试调用)
export async function checkIsFavorite(userId: string, reportId: string, dbClient: any): Promise<boolean> {
  const res = await dbClient.query(
    'SELECT id FROM favorites WHERE user_id = $1 AND report_id = $2',
    [userId, reportId]
  );
  return res.rows.length > 0;
}

// 切换收藏状态 (供 API 和单元测试调用)
export async function toggleFavorite(userId: string, reportId: string, dbClient: any) {
  const isFav = await checkIsFavorite(userId, reportId, dbClient);

  if (isFav) {
    // 已收藏，则取消收藏
    await dbClient.query(
      'DELETE FROM favorites WHERE user_id = $1 AND report_id = $2',
      [userId, reportId]
    );
    return { status: 'removed' };
  } else {
    // 未收藏，则添加收藏
    await dbClient.query(
      'INSERT INTO favorites (user_id, report_id) VALUES ($1, $2)',
      [userId, reportId]
    );
    return { status: 'added' };
  }
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const { userId, reportId } = req.body;
  if (!userId || !reportId) {
    return res.status(400).json({ error: 'Missing userId or reportId parameter' });
  }

  const dbClient = await pool.connect();

  try {
    const result = await toggleFavorite(userId, reportId, dbClient);
    return res.status(200).json(result);
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  } finally {
    dbClient.release();
  }
}
