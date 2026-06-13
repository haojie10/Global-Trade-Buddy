import { NextApiRequest, NextApiResponse } from 'next';
import { Client } from 'pg';
import pool from '../../../lib/db';

// 保存笔记服务 (供 API 和单元测试调用)
export async function saveUserNote(userId: string, reportId: string, content: string, dbClient: Client) {
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
export async function getUserNote(userId: string, reportId: string, dbClient: Client) {
  const res = await dbClient.query(
    'SELECT id, content, created_at, updated_at FROM notes WHERE user_id = $1 AND report_id = $2',
    [userId, reportId]
  );
  return res.rows[0] || null;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { userId, reportId } = req.query;
  if (!userId || !reportId) {
    return res.status(400).json({ error: 'Missing userId or reportId query parameters' });
  }

  const dbClient = await pool.connect();

  try {
    if (req.method === 'POST') {
      const { content } = req.body;
      const result = await saveUserNote(userId as string, reportId as string, content || '', dbClient);
      return res.status(200).json(result);
    } else if (req.method === 'GET') {
      const note = await getUserNote(userId as string, reportId as string, dbClient);
      return res.status(200).json({ success: true, note });
    } else {
      return res.status(405).json({ error: 'Method Not Allowed' });
    }
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  } finally {
    dbClient.release();
  }
}
