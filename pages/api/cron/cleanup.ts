import { NextApiRequest, NextApiResponse } from 'next';
import { PoolClient } from 'pg';
import { withDb } from '../../../lib/api-handler';

async function cronCleanupHandler(req: NextApiRequest, res: NextApiResponse, dbClient: PoolClient) {
  // 仅允许 POST 或 GET 请求
  if (req.method !== 'POST' && req.method !== 'GET') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  // 安全鉴权：校验 CRON_SECRET
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    const authHeader = req.headers.authorization;
    const authQuery = req.query.secret;

    const providedSecret = authHeader?.startsWith('Bearer ') 
      ? authHeader.substring(7) 
      : authQuery;

    if (providedSecret !== cronSecret) {
      return res.status(401).json({ error: '未经授权：CRON_SECRET 不匹配' });
    }
  } else if (process.env.NODE_ENV === 'production') {
    // 生产环境下如果没有配置 CRON_SECRET，出于安全考虑拒绝未经授权的调用
    return res.status(403).json({ error: '生产环境必须配置 CRON_SECRET 环境变量才可启用 Cron API' });
  }

  try {
    // 从 query 或 body 获取自定义保留天数，默认 90 天
    const retentionDays = parseInt((req.query.retention_days || req.body?.retention_days || 90) as string, 10);

    // 调用 SQL 存储过程完成归档聚合与清理
    const dbRes = await dbClient.query(
      'SELECT aggregate_and_clean_logs($1) as result',
      [isNaN(retentionDays) ? 90 : retentionDays]
    );

    const result = dbRes.rows[0]?.result;

    return res.status(200).json({
      success: true,
      message: '数据库日志归档与清理任务执行完毕',
      data: result
    });
  } catch (err: any) {
    console.error('[CRON CLEANUP ERROR]', err);
    return res.status(500).json({
      error: '清理任务执行失败',
      details: err.message
    });
  }
}

export default withDb(cronCleanupHandler, {
  methods: ['POST', 'GET']
});
