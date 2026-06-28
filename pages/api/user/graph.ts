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
  // NOTE: 根据用户角色过滤有权限的报告，若非admin则关联 unlocks 表判定
  if (userRole === 'admin') {
    const res = await dbClient.query(
      `SELECT id, title, category, market_region, summary, primary_entity_id FROM reports`
    );
    nodes = res.rows;
  } else {
    const res = await dbClient.query(
      `SELECT r.id, r.title, r.category, r.market_region, r.summary, r.primary_entity_id 
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

  // NOTE: 一次性查询所有授权报告关联的实体及其在报告中扮演的角色 role
  const entitiesRes = await dbClient.query(
    `SELECT re.report_id, e.id AS entity_id, e.canonical_name, e.entity_type, re.role
     FROM report_entities re
     JOIN entities e ON re.entity_id = e.id
     WHERE re.report_id = ANY($1)`,
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
        repNode.products.push(row.canonical_name);
      } else if (row.role === 'channel') {
        repNode.channels.push(row.canonical_name);
      } else {
        // 兜底降级方案：对于 mentioned 或其它未单独标明角色的，采用 entity_type
        if (row.entity_type === 'company') repNode.companies.push(row.canonical_name);
        else if (row.entity_type === 'competitor') repNode.competitors.push(row.canonical_name);
        else if (row.entity_type === 'product') repNode.products.push(row.canonical_name);
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

  // NOTE: RETAILER_ENTITIES 从 lib/entity-constants.ts 导入

  const links: any[] = [];
  const seenKeys = new Set<string>();

  // 3. 采用双重循环两两比对当前所有已解锁报告，动态计算边关系
  for (let i = 0; i < reportNodes.length; i++) {
    for (let j = i + 1; j < reportNodes.length; j++) {
      const rA = reportNodes[i];
      const rB = reportNodes[j];

      const entsA = reportEntitiesMap.get(rA.id) || new Map();
      const entsB = reportEntitiesMap.get(rB.id) || new Map();

      // 寻找两篇报告中相同的共享实体
      const sharedEnts: any[] = [];
      for (const [entId, entData] of entsA.entries()) {
        if (entsB.has(entId)) {
          sharedEnts.push({ id: entId, ...entData });
        }
      }

      // 获取两份报告的主体实体 ID 与名称（转为小写便于忽略大小写比对）
      const epA = rA.primary_entity_id;
      const epB = rB.primary_entity_id;
      const nameA = epA ? entsA.get(epA)?.canonical_name?.toLowerCase() : null;
      const nameB = epB ? entsB.get(epB)?.canonical_name?.toLowerCase() : null;

      let linkType: string | null = null;
      let linkKey = '';
      let linkSource = rA.id;
      let linkTarget = rB.id;

      // 关系判定核心矩阵
      if (rA.category === 'product' && rB.category === 'product') {
        // 规则一：品类报告 VS 品类报告
        // 两份品类报告中若提到了同一个公司/竞争对手/渠道实体，则成立“涉及关系”
        const hasSharedCompany = sharedEnts.some(
          e => e.entity_type === 'company' || e.entity_type === 'competitor' || e.entity_type === 'channel'
        );
        if (hasSharedCompany) {
          linkType = 'mention';
          linkKey = '涉及关系';
        }
      } 
      else if ((rA.category === 'product' && rB.category === 'customer') || 
               (rA.category === 'customer' && rB.category === 'product')) {
        // 规则二：品类报告 VS 公司报告
        // NOTE: 当满足以下任一条件时，成立“经营关系” (operation)：
        // 1) 品类报告的销售渠道(channel)或供应商(supplier)是公司报告的主体；
        // 2) 公司报告的产品(product)是品类报告的研究主体。
        const rProd = rA.category === 'product' ? rA : rB;
        const rCust = rA.category === 'customer' ? rA : rB;
        const entsProd = rA.category === 'product' ? entsA : entsB;
        const entsCust = rA.category === 'customer' ? entsA : entsB;

        let isOperation = false;
        if (rCust.primary_entity_id) {
          const custEntity = entsCust.get(rCust.primary_entity_id);
          const entInProd = findEntityInReport(
            entsProd,
            rCust.primary_entity_id,
            custEntity ? custEntity.canonical_name : null
          );
          if (entInProd && (entInProd.role === 'channel' || entInProd.role === 'supplier')) {
            isOperation = true;
          }
        }
        if (rProd.primary_entity_id) {
          const prodEntity = entsProd.get(rProd.primary_entity_id);
          const entInCust = findEntityInReport(
            entsCust,
            rProd.primary_entity_id,
            prodEntity ? prodEntity.canonical_name : null
          );
          if (entInCust && entInCust.role === 'product') {
            isOperation = true;
          }
        }

        if (isOperation) {
          linkType = 'operation';
          linkKey = '经营关系';
        } else {
          // 兜底：如果公司报告经营的品类/产品(role === 'product')被品类报告所包含
          const hasSharedProduct = Array.from(entsCust.values()).some(custEnt => {
            if (custEnt.role !== 'product') return false;
            const matchedInProd = findEntityInReport(
              entsProd,
              '',
              custEnt.canonical_name
            );
            return !!matchedInProd;
          });

          if (hasSharedProduct) {
            linkType = 'mention';
            linkKey = '涉及关系';
          }
        }
      } 
      else if (rA.category === 'customer' && rB.category === 'customer') {
        // 规则三：公司报告 VS 公司报告
 
        // 3.1 优先判断是否存在“供销关系” (supplier)
        // NOTE: 供销关系包含两种形式：
        // 1) 显式角色：一方在报告中指明另一方为主体的供应商(supplier)或客户(customer)；
        // 2) 隐含渠道：品牌商报告中关联了超市主体，且以 channel 角色引用，则在商业上认定为供销。
        // 特殊拦截：若双方研究主体本身均是零售巨头，则一票否决任何供销关联，防止超市互供的误判。
        let isASupplierOfB = false;
        let isBSupplierOfA = false;
        
        const isBothRetailers = (nameA && RETAILER_ENTITIES.has(nameA)) && (nameB && RETAILER_ENTITIES.has(nameB));

        if (!isBothRetailers) {
          if (epB) {
            const entInA = findEntityInReport(entsA, epB, nameB);
            if (entInA) {
              if (entInA.role === 'supplier') {
                isBSupplierOfA = true;
              } else if (entInA.role === 'customer') {
                isASupplierOfB = true;
              } else if (entInA.role === 'channel' && nameB && RETAILER_ENTITIES.has(nameB)) {
                isASupplierOfB = true; // A (品牌商) 提及 B (超市) 是其分销渠道，表明 A 为供方，B 为销方
              }
            }
          }
          if (epA) {
            const entInB = findEntityInReport(entsB, epA, nameA);
            if (entInB) {
              if (entInB.role === 'supplier') {
                isASupplierOfB = true;
              } else if (entInB.role === 'customer') {
                isBSupplierOfA = true;
              } else if (entInB.role === 'channel' && nameA && RETAILER_ENTITIES.has(nameA)) {
                isBSupplierOfA = true; // B (品牌商) 提及 A (超市) 是其分销渠道，表明 B 为供方，A 为销方
              }
            }
          }
        }

        if (isASupplierOfB) {
          linkType = 'supplier';
          linkKey = '供应关系';
          linkSource = rA.id; // Erich Krause 供货给 Magnit，故 A 为 source (供方)
          linkTarget = rB.id; // B 为 target (销方)
        } else if (isBSupplierOfA) {
          linkType = 'supplier';
          linkKey = '供应关系';
          linkSource = rB.id; // B 为 source (供方)
          linkTarget = rA.id; // A 为 target (销方)
        } else {
          // 3.2 判定“竞争关系” (competitor)
          // 条件一：一方在报告中显式标记另一方为主体的竞争对手(competitor)
          let isCompetitorOfEachOther = false;
          if (epB && findEntityInReport(entsA, epB, nameB)?.role === 'competitor') isCompetitorOfEachOther = true;
          if (epA && findEntityInReport(entsB, epA, nameA)?.role === 'competitor') isCompetitorOfEachOther = true;

          // 提取两家公司报告所包含的经营品类/产品并转为小写
          const productsA = Array.from(entsA.values())
            .filter(ent => ent.role === 'product')
            .map(ent => ent.canonical_name.toLowerCase().trim());
          const productsB = Array.from(entsB.values())
            .filter(ent => ent.role === 'product')
            .map(ent => ent.canonical_name.toLowerCase().trim());
          const hasIntersectingProduct = productsA.some(p => productsB.includes(p));

          // 条件二：两家品牌商进入了相同的第三方零售分销渠道，并且经营相同的品类
          // 注意：排除渠道就是 A 或 B 本身的情况，防止直销被误判为渠道竞争
          const hasSharedChannel = hasIntersectingProduct && sharedEnts.some(e => {
            const roleInA = entsA.get(e.id)?.role;
            const roleInB = entsB.get(e.id)?.role;
            return roleInA === 'channel' && roleInB === 'channel' && e.id !== epA && e.id !== epB;
          });

          if (isCompetitorOfEachOther || hasSharedChannel) {
            linkType = 'competitor';
            linkKey = '竞争对手';
          } 
          // 3.3 判定“涉及关系” (mention)
          else {
            // 条件一：一方报告中提到过另一方的主体，但角色并非供销或竞争
            const mentionsEachOther = 
              (epB && findEntityInReport(entsA, epB, nameB) !== null) || 
              (epA && findEntityInReport(entsB, epA, nameA) !== null);
            // 条件二：双方报告中共享了任何其他物理实体
            const hasAnyShared = sharedEnts.length > 0;

            if (mentionsEachOther || hasAnyShared) {
              linkType = 'mention';
              linkKey = '涉及关系';
            }
          }
        }
      }

      if (linkType) {
        // 对非有向的供销关系（如 competitor, operation, mention）进行 ASCII 排序去重
        if (linkType !== 'supplier') {
          if (linkSource > linkTarget) {
            const tmp = linkSource;
            linkSource = linkTarget;
            linkTarget = tmp;
          }
        }

        const uniqueKey = `${linkSource}-${linkTarget}-${linkType}`;
        if (!seenKeys.has(uniqueKey)) {
          seenKeys.add(uniqueKey);

          // 继承或确定市场地区
          const region = (rA.market_region && rA.market_region !== '全球') 
            ? rA.market_region 
            : (rB.market_region || '全球');

          links.push({
            source: linkSource,
            target: linkTarget,
            relation_key: linkKey,
            relation_type: linkType,
            market_region: region
          });
        }
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
    return res.status(500).json({ error: err.message });
  } finally {
    dbClient.release();
  }
}
