import { NextApiRequest, NextApiResponse } from 'next';
import { Client } from 'pg';
import pool from '../../../lib/db';

export interface GraphNode {
  id: string;
  title: string;
  category: string;
  market_region: string;
  summary: string;
  companies: string[];
  products: string[];
  channels: string[];
}

export interface GraphLink {
  source: string;
  target: string;
  relation_key: string;
  market_region: string;
  relation_type: string;
}

export async function getGraphData(userId: string, userRole: string, dbClient: any) {
  let nodes: any[] = [];
  if (userRole === 'admin') {
    const res = await dbClient.query(
      `SELECT id, title, category, market_region, summary FROM reports`
    );
    nodes = res.rows;
  } else {
    const res = await dbClient.query(
      `SELECT r.id, r.title, r.category, r.market_region, r.summary 
       FROM reports r
       JOIN unlocks u ON r.id = u.report_id
       WHERE u.user_id = $1`,
      [userId]
    );
    nodes = res.rows;
  }

  if (nodes.length === 0) {
    return { nodes: [], links: [] };
  }

  const reportIds = nodes.map(n => n.id);

  // 查询实体
  const entitiesRes = await dbClient.query(
    `SELECT re.report_id, e.canonical_name, e.entity_type
     FROM report_entities re
     JOIN entities e ON re.entity_id = e.id
     WHERE re.report_id = ANY($1)`,
    [reportIds]
  );

  // 查询连线关系
  const relationsRes = await dbClient.query(
    `SELECT report_id_a AS source, report_id_b AS target, relation_key, market_region, relation_type 
     FROM relations 
     WHERE report_id_a = ANY($1) AND report_id_b = ANY($1)`,
    [reportIds]
  );

  // 初始化节点的归一化实体数组
  const nodeMap = new Map<string, any>();
  for (const node of nodes) {
    node.companies = [];
    node.products = [];
    node.channels = [];
    nodeMap.set(node.id, node);
  }

  // 分类拼装实体
  for (const entityRow of entitiesRes.rows) {
    const node = nodeMap.get(entityRow.report_id);
    if (node) {
      if (entityRow.entity_type === 'company') {
        node.companies.push(entityRow.canonical_name);
      } else if (entityRow.entity_type === 'product') {
        node.products.push(entityRow.canonical_name);
      } else if (entityRow.entity_type === 'channel') {
        node.channels.push(entityRow.canonical_name);
      }
    }
  }

  return {
    nodes,
    links: relationsRes.rows,
  };
}

export async function getUserGraph(userId: string, dbClient: any) {
  return getGraphData(userId, 'user', dbClient);
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const { userId, userRole } = req.query;
  
  // 如果两个参数都没有，则由于向下兼容，可以抛出错误（除非是 admin 场景）
  // 为了保持一致的报错，如果缺 userId 且缺 userRole，报 400
  if (!userId && !userRole) {
    return res.status(400).json({ error: 'Missing userId parameter' });
  }

  const dbClient = await pool.connect();

  try {
    let resolvedRole = userRole as string;
    if (!resolvedRole) {
      if (userId) {
        const userRes = await dbClient.query(
          `SELECT role FROM users WHERE id = $1`,
          [userId]
        );
        if (userRes.rows.length > 0) {
          resolvedRole = userRes.rows[0].role || 'user';
        } else {
          resolvedRole = 'user';
        }
      } else {
        resolvedRole = 'user';
      }
    }

    const graphData = await getGraphData(userId as string || '', resolvedRole, dbClient);
    return res.status(200).json(graphData);
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  } finally {
    dbClient.release();
  }
}
