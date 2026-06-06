import { NextApiRequest, NextApiResponse } from 'next';
import { Client } from 'pg';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const { userId, reportId } = req.body;
  if (!userId || !reportId) {
    return res.status(400).json({ error: 'Missing userId or reportId' });
  }

  const dbClient = new Client({
    connectionString: process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/postgres',
  });
  await dbClient.connect();

  try {
    await dbClient.query('BEGIN');

    // 1. 查询用户额度
    const userRes = await dbClient.query(
      'SELECT free_quota FROM users WHERE id = $1 FOR UPDATE',
      [userId]
    );

    if (userRes.rows.length === 0) {
      throw new Error('用户不存在');
    }

    const freeQuota = userRes.rows[0].free_quota;

    // 2. 如果额度足够，扣除额度并解锁
    if (freeQuota > 0) {
      // 扣除 1 次额度
      await dbClient.query(
        'UPDATE users SET free_quota = free_quota - 1 WHERE id = $1',
        [userId]
      );

      // 写入解锁记录
      await dbClient.query(
        'INSERT INTO unlocks (user_id, report_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
        [userId, reportId]
      );

      // 获取报告全文
      const reportRes = await dbClient.query(
        'SELECT content_html FROM reports WHERE id = $1',
        [reportId]
      );

      await dbClient.query('COMMIT');

      return res.status(200).json({
        success: true,
        content_html: reportRes.rows[0]?.content_html || ''
      });
    } else {
      await dbClient.query('ROLLBACK');
      return res.status(400).json({ success: false, error: '您的额度不足，请充值或付费解锁' });
    }
  } catch (err: any) {
    await dbClient.query('ROLLBACK');
    return res.status(500).json({ error: err.message });
  } finally {
    await dbClient.end();
  }
}
