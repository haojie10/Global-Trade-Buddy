import { NextApiRequest, NextApiResponse } from 'next';
import { PoolClient } from 'pg';
import { requireAdmin } from '../../../../lib/auth';
import { withDb } from '../../../../lib/api-handler';

async function updateEntityHandler(req: NextApiRequest, res: NextApiResponse, client: PoolClient) {
  const adminSession = requireAdmin(req);
  if (!adminSession) {
    return res.status(403).json({ error: '权限不足，仅管理员可进行此操作' });
  }

  const { entityId, description, website, headquarters, employee_count } = req.body;
  if (!entityId) {
    return res.status(400).json({ error: '参数缺失，缺少 entityId' });
  }

  await client.query(
    `UPDATE entities 
     SET description = $1, website = $2, headquarters = $3, employee_count = $4 
     WHERE id = $5`,
    [description, website, headquarters, employee_count, entityId]
  );

  return res.status(200).json({ success: true });
}

export default withDb(updateEntityHandler, {
  methods: ['POST'],
  requiredBody: ['entityId']
});
