import { NextApiRequest, NextApiResponse } from 'next';
import { Client } from 'pg';
import pool from '../../../lib/db';

// 核心安全详情读取逻辑（供 API 和单元测试调用）
export async function getReportDetail(userId: string, reportId: string, dbClient: any) {
  // 1. 获取报告元数据与全文
  const reportRes = await dbClient.query(
    'SELECT id, title, category, market_region, summary, content_html FROM reports WHERE id = $1',
    [reportId]
  );

  if (reportRes.rows.length === 0) {
    throw new Error('报告未找到');
  }

  const report = reportRes.rows[0];

  // 2. 检查该用户是否已解锁该报告
  const unlockRes = await dbClient.query(
    'SELECT id FROM unlocks WHERE user_id = $1 AND report_id = $2',
    [userId, reportId]
  );

  const isUnlocked = unlockRes.rows.length > 0;

  return {
    id: report.id,
    title: report.title,
    category: report.category,
    market_region: report.market_region,
    summary: report.summary,
    isUnlocked,
    // 核心安全隔离：如果没有解锁，强制为 null，防止任何敏感字段返回给前台
    content_html: isUnlocked ? report.content_html : null,
  };
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  // 从 query 或 authorization 获取参数
  const { reportId, userId } = req.query;
  if (!reportId || !userId) {
    return res.status(400).json({ error: 'Missing reportId or userId parameter' });
  }

  const dbClient = await pool.connect();

  try {
    const detail = await getReportDetail(userId as string, reportId as string, dbClient);
    return res.status(200).json(detail);
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  } finally {
    dbClient.release();
  }
}
