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
    const requestId = Math.random().toString(36).slice(2, 10);
    const startTime = Date.now();
    console.log(`[${requestId}] ${req.method} ${req.url}`);
    const dbClient = await pool.connect();
    if (process.env.NODE_ENV === 'test') {
      const connStr = process.env.TEST_DATABASE_URL || '';
      const match = connStr.match(/search_path%3D([a-zA-Z0-9_]+)/i) || connStr.match(/search_path=([a-zA-Z0-9_]+)/i);
      if (match && match[1]) {
        await dbClient.query(`SET search_path TO ${match[1]}, public`);
      }
    }
    try {
      await handler(req, res, dbClient);
    } catch (err: any) {
      console.error(`Error in API handler:`, err);
      try {
        await dbClient.query('ROLLBACK');
      } catch (rollbackErr) {
        // 忽略 rollback 失败的情况（如未开启事务）
      }
      // NOTE: 生产环境隐藏内部错误细节，防止泄露 SQL 语句、表名等敏感信息
      const safeMessage = process.env.NODE_ENV === 'production'
        ? '服务器内部错误'
        : (err.message || 'Internal Server Error');
      return res.status(500).json({ error: safeMessage });
    } finally {
      dbClient.release();
      console.log(`[${requestId}] ${req.method} ${req.url} -> ${Date.now() - startTime}ms`);
    }
  };
}
