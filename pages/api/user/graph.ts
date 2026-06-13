import { NextApiRequest, NextApiResponse } from 'next';
import { Client } from 'pg';
import pool from '../../../lib/db';

export interface GraphNode {
  id: string;
  title: string;
  category: string;
  market_region: string;
}

export interface GraphLink {
  source: string;
  target: string;
  relation_key: string;
}

// 核心个人图谱关联逻辑（供 API 和单元测试调用）
export async function getUserGraph(userId: string, dbClient: any) {
  // 1. 获取该用户所有已解锁的报告
  const unlockedRes = await dbClient.query(
    `SELECT r.id, r.title, r.category, r.market_region 
     FROM reports r
     JOIN unlocks u ON r.id = u.report_id
     WHERE u.user_id = $1`,
    [userId]
  );

  const nodes: GraphNode[] = unlockedRes.rows;
  const unlockedIds = nodes.map(n => n.id);

  if (unlockedIds.length === 0) {
    return { nodes: [], links: [] };
  }

  // 2. 查询这些解锁报告之间存在的网状关系连线
  // 仅当连线的起点和终点报告都在用户的已解锁列表内时，该连线才属于该用户的个人图谱（安全原则）
  const relationsRes = await dbClient.query(
    `SELECT report_id_a AS source, report_id_b AS target, relation_key 
     FROM relations 
     WHERE report_id_a = ANY($1) AND report_id_b = ANY($1)`,
    [unlockedIds]
  );

  const links: GraphLink[] = relationsRes.rows;

  return {
    nodes,
    links,
  };
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const { userId } = req.query;
  if (!userId) {
    return res.status(400).json({ error: 'Missing userId parameter' });
  }

  const dbClient = await pool.connect();

  try {
    const graphData = await getUserGraph(userId as string, dbClient);
    return res.status(200).json(graphData);
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  } finally {
    dbClient.release();
  }
}
