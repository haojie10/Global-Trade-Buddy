import { NextApiRequest, NextApiResponse } from 'next';
import { Client } from 'pg';

// 执行邀请兑换逻辑 (双向赠送解锁额度，包裹在 SQL 事务中)
export async function processInvitation(referrerId: string, inviteeId: string, dbClient: Client) {
  try {
    await dbClient.query('BEGIN');

    // 1. 校验邀请人与被邀请人是否存在
    const refRes = await dbClient.query('SELECT id FROM users WHERE id = $1', [referrerId]);
    const invRes = await dbClient.query('SELECT id, invited_by FROM users WHERE id = $1', [inviteeId]);

    if (refRes.rows.length === 0) {
      throw new Error('邀请人不存在');
    }
    if (invRes.rows.length === 0) {
      throw new Error('被邀请人不存在');
    }

    // 防重绑定校验：如果已经绑定过邀请人，则不重复奖励
    if (invRes.rows[0].invited_by) {
      throw new Error('您已经接受过邀请，无法重复兑换');
    }

    // 2. 绑定被邀请人的推荐人 ID
    await dbClient.query(
      'UPDATE users SET invited_by = $1 WHERE id = $2',
      [referrerId, inviteeId]
    );

    // 3. 邀请人加 1 额度
    await dbClient.query(
      'UPDATE users SET free_quota = free_quota + 1 WHERE id = $1',
      [referrerId]
    );

    // 4. 被邀请人加 1 额度 (双向奖励)
    await dbClient.query(
      'UPDATE users SET free_quota = free_quota + 1 WHERE id = $1',
      [inviteeId]
    );

    await dbClient.query('COMMIT');
    return { success: true };
  } catch (err: any) {
    await dbClient.query('ROLLBACK');
    throw err;
  }
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const { referrerId, inviteeId } = req.body;
  if (!referrerId || !inviteeId) {
    return res.status(400).json({ error: 'Missing referrerId or inviteeId parameters' });
  }

  const dbClient = new Client({
    connectionString: process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/postgres',
  });
  await dbClient.connect();

  try {
    const result = await processInvitation(referrerId, inviteeId, dbClient);
    return res.status(200).json(result);
  } catch (err: any) {
    return res.status(400).json({ success: false, error: err.message });
  } finally {
    await dbClient.end();
  }
}
