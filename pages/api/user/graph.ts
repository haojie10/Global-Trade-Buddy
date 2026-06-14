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
    products: [],
    channels: []
  }));

  const reportMap = new Map<string, any>();
  for (const node of reportNodes) {
    reportMap.set(node.id, node);
  }

  // 2. 收集并去重被提及的实体节点，同时为报告节点拼装向下兼容的分类数组
  const entityNodeMap = new Map<string, any>();
  const mentionLinks: any[] = [];

  for (const row of entitiesRes.rows) {
    // 填充报告的归一化数组（保持向后兼容）
    const repNode = reportMap.get(row.report_id);
    if (repNode) {
      if (row.entity_type === 'company') repNode.companies.push(row.canonical_name);
      else if (row.entity_type === 'product') repNode.products.push(row.canonical_name);
      else if (row.entity_type === 'channel') repNode.channels.push(row.canonical_name);
    }

    // 建立实体节点
    if (!entityNodeMap.has(row.entity_id)) {
      entityNodeMap.set(row.entity_id, {
        id: row.entity_id,
        title: row.canonical_name,
        entity_type: row.entity_type,
        node_type: 'entity'
      });
    }

    // 建立 报告 ↔ 实体的提及线 (mention)
    mentionLinks.push({
      source: row.report_id,
      target: row.entity_id,
      link_type: 'mention',
      relation_key: '提及'
    });
  }

  const entityNodes = Array.from(entityNodeMap.values());
  const entityIds = Array.from(entityNodeMap.keys());

  // 3. 查询当前图中已出场实体之间的商业关系 (competitor, supplier 等)
  let businessLinks: any[] = [];
  if (entityIds.length > 0) {
    const bizRes = await dbClient.query(
      `SELECT entity_id_a AS source, entity_id_b AS target, relation_type, market_region 
       FROM entity_relations 
       WHERE entity_id_a = ANY($1) AND entity_id_b = ANY($1)`,
      [entityIds]
    );
    businessLinks = bizRes.rows.map((r: any) => ({
      source: r.source,
      target: r.target,
      link_type: 'business',
      relation_type: r.relation_type,
      market_region: r.market_region,
      relation_key: r.relation_type === 'competitor' ? '竞争对手' : r.relation_type === 'supplier' ? '供应商' : '合作'
    }));
  }

  return {
    nodes: [...reportNodes, ...entityNodes],
    links: [...mentionLinks, ...businessLinks]
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
