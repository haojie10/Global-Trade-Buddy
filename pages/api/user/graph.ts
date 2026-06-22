import { NextApiRequest, NextApiResponse } from 'next';
import pool from '../../../lib/db';
import { getSession } from '../../../lib/auth';

export interface GraphNode {
  id: string;
  title: string;
  category: string;
  market_region: string;
  summary: string;
  companies: string[];
  competitors: string[];
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

  // 查询实体（包含实体ID）
  const entitiesRes = await dbClient.query(
    `SELECT re.report_id, e.id AS entity_id, e.canonical_name, e.entity_type
     FROM report_entities re
     JOIN entities e ON re.entity_id = e.id
     WHERE re.report_id = ANY($1)`,
    [reportIds]
  );

  // 1. 初始化报告节点，并标记 node_type
  const reportNodes = nodes.map(node => ({
    ...node,
    node_type: 'report',
    companies: [],
    competitors: [],
    products: [],
    channels: []
  }));

  const reportMap = new Map<string, any>();
  for (const node of reportNodes) {
    reportMap.set(node.id, node);
  }

  // 2. 收集并填充报告节点的归一化数组（保持向后兼容）
  for (const row of entitiesRes.rows) {
    const repNode = reportMap.get(row.report_id);
    if (repNode) {
      if (row.entity_type === 'company') repNode.companies.push(row.canonical_name);
      else if (row.entity_type === 'competitor') repNode.competitors.push(row.canonical_name);
      else if (row.entity_type === 'product') repNode.products.push(row.canonical_name);
      else if (row.entity_type === 'channel') repNode.channels.push(row.canonical_name);
    }
  }

  // 3. 从 relations 表中查询报告与报告之间的直接关联连线（并关联实体以判断类型）
  const relationsRes = await dbClient.query(
    `SELECT r.report_id_a, r.report_id_b, r.relation_key, e.entity_type, r.market_region 
     FROM relations r
     LEFT JOIN entities e ON r.relation_key = e.canonical_name
     WHERE r.report_id_a = ANY($1) AND r.report_id_b = ANY($1)`,
    [reportIds]
  );

  const reportLinks = relationsRes.rows.map((row: any) => {
    let relType = 'mention';
    if (row.entity_type === 'product' || row.entity_type === 'channel') {
      relType = 'operation';
    } else if (row.entity_type === 'competitor') {
      relType = 'competitor';
    }

    return {
      source: row.report_id_a,
      target: row.report_id_b,
      relation_key: row.relation_key,
      relation_type: relType,
      market_region: row.market_region
    };
  });

  // 4. 查询报告对应公司实体之间的商业关系（竞争对手、供应商），直接连线两个报告
  const bizRes = await dbClient.query(
    `SELECT DISTINCT
       re1.report_id AS report_id_a,
       re2.report_id AS report_id_b,
       er.relation_type,
       er.market_region
     FROM report_entities re1
     JOIN entities e1 ON re1.entity_id = e1.id AND e1.entity_type = 'company'
     JOIN entity_relations er ON (er.entity_id_a = e1.id OR er.entity_id_b = e1.id)
     JOIN entities e2 ON (
       (er.entity_id_a = e2.id AND er.entity_id_b = e1.id) OR 
       (er.entity_id_b = e2.id AND er.entity_id_a = e1.id)
     ) AND e2.entity_type = 'company' AND e2.id != e1.id
     JOIN report_entities re2 ON re2.entity_id = e2.id
     WHERE re1.report_id = ANY($1) AND re2.report_id = ANY($1) AND re1.report_id < re2.report_id`,
    [reportIds]
  );

  const bizLinks = bizRes.rows.map((row: any) => {
    let relType = 'mention';
    if (row.relation_type === 'competitor') {
      relType = 'competitor';
    } else if (row.relation_type === 'supplier') {
      relType = 'supplier';
    } else if (row.relation_type === 'product_sale') {
      relType = 'operation';
    }

    return {
      source: row.report_id_a,
      target: row.report_id_b,
      relation_key: row.relation_type === 'competitor' ? '竞争对手' : row.relation_type === 'supplier' ? '供应关系' : '合作关系',
      relation_type: relType,
      market_region: row.market_region
    };
  });

  return {
    nodes: reportNodes,
    links: [...reportLinks, ...bizLinks]
  };
}

export async function getUserGraph(userId: string, dbClient: any) {
  return getGraphData(userId, 'user', dbClient);
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  // 从 httpOnly Cookie 中读取会话，防止任何人通过 query 参数伪造角色
  const session = getSession(req);
  if (!session) {
    return res.status(401).json({ error: '未登录，请先登录后访问' });
  }

  const { userId, role: resolvedRole } = session;

  const dbClient = await pool.connect();

  try {
    const graphData = await getGraphData(userId, resolvedRole, dbClient);
    return res.status(200).json(graphData);
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  } finally {
    dbClient.release();
  }
}
