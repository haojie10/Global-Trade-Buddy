import { NextApiRequest, NextApiResponse } from 'next';
import pool from '../../../lib/db';
import { getSession } from '../../../lib/auth';
import { RETAILER_ENTITIES } from '../../../lib/entity-constants';

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
  suppliers: string[];
  customers: string[];
}

export interface GraphLink {
  source: string;
  target: string;
  relation_key: string;
  market_region: string;
  relation_type: string;
}

function findEntityInReport(
  entsMap: Map<string, { canonical_name: string; entity_type: string; role: string }>,
  targetId: string,
  targetName: string | null
) {
  if (entsMap.has(targetId)) {
    return entsMap.get(targetId);
  }
  if (!targetName) return null;
  const tName = targetName.toLowerCase().trim();
  for (const ent of entsMap.values()) {
    const entName = ent.canonical_name.toLowerCase().trim();
    if (entName === tName) return ent;
    // 特殊处理 obi 缩写
    if ((tName.includes('obi') && entName === 'obi') || (entName.includes('obi') && tName === 'obi')) {
      return ent;
    }
    // 前缀匹配（针对 BAUHAUS 与 BAUHAUS AG 等情况）
    if (entName.length > 2 && tName.startsWith(entName)) return ent;
    if (tName.length > 2 && entName.startsWith(tName)) return ent;
  }
  return null;
}

export async function getGraphData(userId: string, userRole: string, dbClient: any) {
  let nodes: any[] = [];
  // 统一逻辑：不管是普通用户还是管理员，图谱节点均取已收藏（favorites）的报告，让用户可通过收藏/取消收藏净化图谱
  const res = await dbClient.query(
    `SELECT r.id, r.title, r.category, r.market_region, r.summary, r.primary_entity_id 
     FROM reports r
     JOIN favorites f ON r.id = f.report_id
     WHERE f.user_id = $1`,
    [userId]
  );
  nodes = res.rows;

  if (nodes.length === 0) {
    return { nodes: [], links: [] };
  }

  const reportIds = nodes.map(n => n.id);

  // NOTE: 一次性查询所有授权报告关联的实体及其在报告中扮演的角色 role
  const entitiesRes = await dbClient.query(
    `SELECT re.report_id, e.id AS entity_id, e.canonical_name, e.entity_type, re.role
     FROM report_entities re
     JOIN entities e ON re.entity_id = e.id
     WHERE re.report_id = ANY($1)`,
    [reportIds]
  );

  // 1.5 一次性查询所有授权报告关联的标准行业品类 (GTB大类)
  const industriesRes = await dbClient.query(
    `SELECT ri.report_id, i.name AS industry_name
     FROM report_industries ri
     JOIN industries i ON ri.industry_id = i.id
     WHERE ri.report_id = ANY($1)`,
    [reportIds]
  );

  // 1. 初始化报告节点，并填充 ObsidianGraph 所需的 node_type 为 'report'
  const reportNodes = nodes.map(node => ({
    ...node,
    node_type: 'report',
    companies: [],
    competitors: [],
    products: [],
    channels: [],
    suppliers: [],
    customers: []
  }));

  const reportMap = new Map<string, any>();
  for (const node of reportNodes) {
    reportMap.set(node.id, node);
  }

  // 整理每个报告关联的实体 Map，Key: report_id -> Map<entity_id, { canonical_name, entity_type, role }>
  const reportEntitiesMap = new Map<string, Map<string, { canonical_name: string; entity_type: string; role: string }>>();

  // 2. 收集并填充报告节点的归一化数组（优先依据在此报告中扮演的角色 role，对 mentioned 及未分类实体以全局类型兜底，保持向后兼容）
  for (const row of entitiesRes.rows) {
    const repNode = reportMap.get(row.report_id);
    if (repNode) {
      if (row.role === 'primary' || row.role === 'company' || row.role === 'sister_parent') {
        repNode.companies.push(row.canonical_name);
      } else if (row.role === 'supplier') {
        repNode.suppliers.push(row.canonical_name);
      } else if (row.role === 'customer') {
        repNode.customers.push(row.canonical_name);
      } else if (row.role === 'competitor') {
        repNode.competitors.push(row.canonical_name);
      } else if (row.role === 'product') {
        // 强关联GTB：不再推入具体物理产品，改由 2.5 填充标准大类
        // repNode.products.push(row.canonical_name);
      } else if (row.role === 'channel') {
        repNode.channels.push(row.canonical_name);
      } else {
        // 兜底降级方案：对于 mentioned 或其它未单独标明角色的，采用 entity_type
        if (row.entity_type === 'company') repNode.companies.push(row.canonical_name);
        else if (row.entity_type === 'competitor') repNode.competitors.push(row.canonical_name);
        else if (row.entity_type === 'product') {
          // 强关联GTB：不再推入具体物理产品，改由 2.5 填充标准大类
          // repNode.products.push(row.canonical_name);
        }
        else if (row.entity_type === 'channel') repNode.channels.push(row.canonical_name);
      }
    }

    if (!reportEntitiesMap.has(row.report_id)) {
      reportEntitiesMap.set(row.report_id, new Map());
    }
    reportEntitiesMap.get(row.report_id)!.set(row.entity_id, {
      canonical_name: row.canonical_name,
      entity_type: row.entity_type,
      role: row.role
    });
  }

  // 2.5 填充标准大类至 products 数组，作为个人图谱下拉菜单的强关联标准数据源
  for (const row of industriesRes.rows) {
    const repNode = reportMap.get(row.report_id);
    if (repNode) {
      if (!repNode.products.includes(row.industry_name)) {
        repNode.products.push(row.industry_name);
      }
    }
  }

  // NOTE: RETAILER_ENTITIES 从 lib/entity-constants.ts 导入

  const links: any[] = [];

  // 3. 从 relations 物理表中直接读取由全库算法计算好的关系线条
  const reportIds = reportNodes.map(n => n.id);
  if (reportIds.length > 0) {
    const relationsRes = await dbClient.query(
      `SELECT report_id_a, report_id_b, relation_key, market_region, relation_type
       FROM relations
       WHERE report_id_a = ANY($1) AND report_id_b = ANY($1)`,
      [reportIds]
    );

    const seenKeys = new Set<string>();
    for (const row of relationsRes.rows) {
      const uniqueKey = `${row.report_id_a}-${row.report_id_b}-${row.relation_key}`;
      if (!seenKeys.has(uniqueKey)) {
        seenKeys.add(uniqueKey);
        links.push({
          source: row.report_id_a,
          target: row.report_id_b,
          relation_key: row.relation_key,
          relation_type: row.relation_type,
          market_region: row.market_region || '全球'
        });
      }
    }
  }

  return {
    nodes: reportNodes,
    links
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
    const safeMsg = process.env.NODE_ENV === 'production' ? '服务器内部错误' : err.message;
    return res.status(500).json({ error: safeMsg });
  } finally {
    dbClient.release();
  }
}
