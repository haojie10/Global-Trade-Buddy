import { NextApiRequest, NextApiResponse } from 'next';
import { PoolClient } from 'pg';
import { withDb } from '../../../lib/api-handler';

// 保存笔记服务 (供 API 和单元测试调用)
export async function saveUserNote(userId: string, reportId: string, content: string, dbClient: any) {
  // 检查是否已有笔记
  const checkRes = await dbClient.query(
    'SELECT id FROM notes WHERE user_id = $1 AND report_id = $2',
    [userId, reportId]
  );

  if (checkRes.rows.length > 0) {
    // 已存在，执行更新
    await dbClient.query(
      'UPDATE notes SET content = $1, updated_at = NOW() WHERE user_id = $2 AND report_id = $3',
      [content, userId, reportId]
    );
  } else {
    // 不存在，执行插入
    await dbClient.query(
      'INSERT INTO notes (user_id, report_id, content) VALUES ($1, $2, $3)',
      [userId, reportId, content]
    );
  }

  return { success: true };
}

// 读取笔记服务 (供 API 和单元测试调用)
export async function getUserNote(userId: string, reportId: string, dbClient: any) {
  const res = await dbClient.query(
    'SELECT id, content, created_at, updated_at FROM notes WHERE user_id = $1 AND report_id = $2',
    [userId, reportId]
  );
  return res.rows[0] || null;
}

async function noteHandler(req: NextApiRequest, res: NextApiResponse, dbClient: PoolClient) {
  const { userId, reportId } = req.query;

  if (req.method === 'POST') {
    const { content } = req.body;
    const result = await saveUserNote(userId as string, reportId as string, content || '', dbClient);
    return res.status(200).json(result);
  } else {
    // 因为 withDb 限制了方法仅为 GET, POST，故此处必为 GET
    const note = await getUserNote(userId as string, reportId as string, dbClient);
    return res.status(200).json({ success: true, note });
  }
}

export default withDb(noteHandler, {
  methods: ['GET', 'POST'],
  requiredQuery: ['userId', 'reportId']
});
