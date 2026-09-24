import { NextApiRequest, NextApiResponse } from 'next';
import { PoolClient } from 'pg';
import { withDb } from '../../../lib/api-handler';
import { getSession } from '../../../lib/auth';

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
  const session = getSession(req);
  if (!session) {
    return res.status(401).json({ error: '未登录，请先登录后操作' });
  }
  const userId = session.userId;
  const { reportId } = req.body;

  // 校验当前报告是否已被解锁（免费版/专业版未解锁不可收藏，admin 除外）
  const isFav = await checkIsFavorite(userId, reportId, dbClient);
  if (!isFav) {
    const userRes = await dbClient.query('SELECT role FROM users WHERE id = $1', [userId]);
    const role = userRes.rows[0]?.role;
    if (role !== 'admin') {
      const unlockRes = await dbClient.query(
        'SELECT id FROM unlocks WHERE user_id = $1 AND report_id = $2',
        [userId, reportId]
      );
      if (unlockRes.rows.length === 0) {
        return res.status(403).json({ error: '该报告尚未解锁，解锁后方可收藏加入图谱' });
      }
    }
  }

  const result = await toggleFavorite(userId, reportId, dbClient);
  return res.status(200).json(result);
}

export default withDb(favoriteHandler, {
  methods: ['POST'],
  requiredBody: ['reportId']
});
