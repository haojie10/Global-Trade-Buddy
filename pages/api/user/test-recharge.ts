import { NextApiRequest, NextApiResponse } from 'next';
import { PoolClient } from 'pg';
import { withDb } from '../../../lib/api-handler';
import { getSession } from '../../../lib/auth';

async function testRechargeHandler(req: NextApiRequest, res: NextApiResponse, dbClient: PoolClient) {
  // 安全拦截: 仅开发/测试环境允许使用测试充值通道
  if (process.env.NODE_ENV === 'production') {
    return res.status(404).json({ error: 'Not Found' });
  }

  const session = getSession(req);
  if (!session) {
    return res.status(401).json({ error: '未登录，请先登录后操作' });
  }
  const userId = session.userId;

  // 1. 直接将用户的额度 free_quota 加 10 
  const updateRes = await dbClient.query(
    'UPDATE users SET free_quota = free_quota + 10 WHERE id = $1 RETURNING free_quota',
    [userId]
  );

  if (updateRes.rows.length === 0) {
    return res.status(404).json({ error: '用户不存在' });
  }

  const newQuota = updateRes.rows[0].free_quota;

  return res.status(200).json({
    success: true,
    message: '充值成功（测试通道已成功发放 10 次额度）！',
    newQuota
  });
}

export default withDb(testRechargeHandler, {
  methods: ['POST']
});
