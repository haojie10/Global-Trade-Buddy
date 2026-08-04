import { NextApiRequest, NextApiResponse } from 'next';
import { PoolClient } from 'pg';
import bcrypt from 'bcryptjs';
import { withDb } from '../../../lib/api-handler';
import { getSession } from '../../../lib/auth';

function validatePassword(password: string): string | null {
  if (password.length < 8) {
    return '密码长度至少 8 位';
  }
  if (!/[a-zA-Z]/.test(password)) {
    return '密码必须包含至少一个字母';
  }
  if (!/[0-9]/.test(password)) {
    return '密码必须包含至少一个数字';
  }
  return null;
}

async function changePasswordHandler(
  req: NextApiRequest,
  res: NextApiResponse,
  dbClient: PoolClient
) {
  // 1. 验证用户登录态
  const session = getSession(req);
  if (!session) {
    return res.status(401).json({ error: '未登录，请先登录后操作' });
  }

  const userId = session.userId;
  const { oldPassword, newPassword } = req.body;

  // 2. 校验新密码强度
  const passwordError = validatePassword(newPassword);
  if (passwordError) {
    return res.status(400).json({ error: passwordError });
  }

  // 3. 获取当前用户的哈希密码进行比对
  const userRes = await dbClient.query('SELECT password FROM users WHERE id = $1', [userId]);
  if (userRes.rows.length === 0) {
    return res.status(404).json({ error: '当前用户不存在' });
  }

  const user = userRes.rows[0];
  const oldPasswordMatch = await bcrypt.compare(oldPassword, user.password);
  if (!oldPasswordMatch) {
    return res.status(400).json({ error: '旧密码错误，请重新输入' });
  }

  // 4. 哈希加密新密码并更新数据库
  const passwordHash = await bcrypt.hash(newPassword, 10);
  await dbClient.query('UPDATE users SET password = $1 WHERE id = $2', [passwordHash, userId]);

  return res.status(200).json({ success: true, message: '密码修改成功，请使用新密码重新登录' });
}

export default withDb(changePasswordHandler, {
  methods: ['POST'],
  requiredBody: ['oldPassword', 'newPassword']
});
