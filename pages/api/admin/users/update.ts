import { NextApiRequest, NextApiResponse } from 'next';
import { PoolClient } from 'pg';
import bcrypt from 'bcryptjs';
import { withDb } from '../../../../lib/api-handler';
import { requireAdmin } from '../../../../lib/auth';

async function userUpdateHandler(req: NextApiRequest, res: NextApiResponse, dbClient: PoolClient) {
  const session = requireAdmin(req);
  if (!session) {
    return res.status(403).json({ error: '权限不足，仅管理员可修改用户信息' });
  }

  const {
    userId,
    freeQuota,
    memberType,
    subscriptionExpiresAt,
    role,
    status,
    nickname,
    newPassword
  } = req.body;

  if (!userId) {
    return res.status(400).json({ error: '缺少用户 ID (userId)' });
  }

  // 1. 验证目标用户是否存在
  const userCheckRes = await dbClient.query('SELECT id, email, role FROM users WHERE id = $1', [userId]);
  if (userCheckRes.rows.length === 0) {
    return res.status(404).json({ error: '未找到指定用户' });
  }

  const updateFields: string[] = [];
  const updateValues: any[] = [];
  let paramIndex = 1;

  if (typeof freeQuota === 'number') {
    updateFields.push(`free_quota = $${paramIndex}`);
    updateValues.push(Math.max(0, freeQuota));
    paramIndex++;
  }

  if (memberType && ['free', 'pro', 'enterprise'].includes(memberType)) {
    updateFields.push(`member_type = $${paramIndex}`);
    updateValues.push(memberType);
    paramIndex++;
  }

  if (subscriptionExpiresAt !== undefined) {
    updateFields.push(`subscription_expires_at = $${paramIndex}`);
    updateValues.push(subscriptionExpiresAt ? new Date(subscriptionExpiresAt) : null);
    paramIndex++;
  }

  if (role && ['user', 'admin'].includes(role)) {
    updateFields.push(`role = $${paramIndex}`);
    updateValues.push(role);
    paramIndex++;
  }

  if (status && ['active', 'banned'].includes(status)) {
    updateFields.push(`status = $${paramIndex}`);
    updateValues.push(status);
    paramIndex++;
  }

  if (nickname !== undefined) {
    updateFields.push(`nickname = $${paramIndex}`);
    updateValues.push(nickname ? nickname.trim() : null);
    paramIndex++;
  }

  if (newPassword) {
    if (newPassword.length < 6) {
      return res.status(400).json({ error: '重置密码长度至少为 6 位' });
    }
    const passwordHash = await bcrypt.hash(newPassword, 10);
    updateFields.push(`password = $${paramIndex}`);
    updateValues.push(passwordHash);
    paramIndex++;
  }

  if (updateFields.length === 0) {
    return res.status(400).json({ error: '未提供任何需要更新的字段' });
  }

  updateValues.push(userId);
  const updateQuery = `
    UPDATE users 
    SET ${updateFields.join(', ')} 
    WHERE id = $${paramIndex} 
    RETURNING id, email, nickname, role, free_quota, member_type, subscription_expires_at, status
  `;

  const updateRes = await dbClient.query(updateQuery, updateValues);
  const updatedUser = updateRes.rows[0];

  return res.status(200).json({
    success: true,
    message: '用户信息更新成功',
    user: updatedUser
  });
}

export default withDb(userUpdateHandler, {
  methods: ['POST'],
  requiredBody: ['userId']
});
