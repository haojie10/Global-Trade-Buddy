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
