import { NextApiRequest, NextApiResponse } from 'next';
import { PoolClient } from 'pg';
import { withDb } from '../../../lib/api-handler';

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

async function favoriteHandler(req: NextApiRequest, res: NextApiResponse, dbClient: PoolClient) {
  const { userId, reportId } = req.body;
  const result = await toggleFavorite(userId, reportId, dbClient);
  return res.status(200).json(result);
}

export default withDb(favoriteHandler, {
  methods: ['POST'],
  requiredBody: ['userId', 'reportId']
});
