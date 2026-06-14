import { NextApiRequest, NextApiResponse } from 'next';
import { PoolClient } from 'pg';
import pool from './db';

export type DbHandler = (
  req: NextApiRequest,
  res: NextApiResponse,
  dbClient: PoolClient
) => Promise<any>;

export interface WithDbOptions {
  methods?: string[];
  requiredBody?: string[];
  requiredQuery?: string[];
}

export function withDb(handler: DbHandler, options?: WithDbOptions) {
  return async (req: NextApiRequest, res: NextApiResponse) => {
    // 1. 校验请求方法
    if (options?.methods && !options.methods.includes(req.method || '')) {
      return res.status(405).json({ error: 'Method Not Allowed' });
    }

    // 2. 校验 Query 参数
    if (options?.requiredQuery) {
      for (const param of options.requiredQuery) {
        if (!req.query[param]) {
          return res.status(400).json({ error: `Missing required query parameter: ${param}` });
        }
      }
    }

    // 3. 校验 Body 参数
    if (options?.requiredBody) {
      for (const param of options.requiredBody) {
        if (!req.body || req.body[param] === undefined || req.body[param] === null) {
          return res.status(400).json({ error: `Missing required body parameter: ${param}` });
        }
      }
    }

    // 4. 获取数据库连接并执行 handler
    const dbClient = await pool.connect();
    try {
      await handler(req, res, dbClient);
    } catch (err: any) {
      console.error(`Error in API handler:`, err);
      try {
        await dbClient.query('ROLLBACK');
      } catch (rollbackErr) {
        // 忽略 rollback 失败的情况（如未开启事务）
      }
      return res.status(500).json({ error: err.message || 'Internal Server Error' });
    } finally {
      dbClient.release();
    }
  };
}
