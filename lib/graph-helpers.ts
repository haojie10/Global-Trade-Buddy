import { getStandardCategory } from './category-mapper';

export interface GraphNode {
  id: string;
  title: string;
  category: string;
  market_region: string;
  summary?: string;
  companies?: string[];
  competitors?: string[];
  products?: string[];
  channels?: string[];
  suppliers?: string[];
  customers?: string[];
  node_type?: string;
  entity_type?: string;
}

export interface GraphLink {
  source: any;
  target: any;
  relation_key: string;
  market_region?: string;
  relation_type?: string;
}

import { isNodeInRegion, getRegionByCountryName, normalizeRegionName } from './region-country-mapper';

// 辅助函数：判断节点在后台关联行业/品类中是否包含指定的 selectedProduct
const isNodeMatchingProduct = (node: GraphNode, prod: string): boolean => {
  if (prod === 'All') return true;

  // 1) 检查 node.products 数组中是否有完全相等或归一化匹配的品类
  const hasInProducts = node.products?.some(p => p === prod || getStandardCategory(p) === prod);
  if (hasInProducts) return true;

  // 2) 检查标题/品类属性中是否包含该品类关键字或归一化匹配
  if (node.title) {
    if (node.title.includes(prod) || getStandardCategory(node.title) === prod) {
      return true;
    }
  }

  return false;
};

// 辅助函数：判断节点是否匹配选择的国家列表
const isNodeMatchingCountries = (node: GraphNode, selectedCountries: string[]): boolean => {
  if (selectedCountries.length === 0 || selectedCountries.includes('All')) {
    return true;
  }

  if (!node.market_region) return false;

  const nodeRegions = node.market_region.split(',').map(r => r.trim()).filter(Boolean);

  for (const reg of nodeRegions) {
    // 1. 全球默认包含
    if (reg === '全球') return true;

    // 2. 节点的地区字段包含用户选中的具体国家名称（如 reg="德国"，selectedCountries包含"德国"）
    if (selectedCountries.includes(reg)) return true;

    // 3. 检查 reg 是否为具体的国家名称（如 "英国"）
    const countryRegion = getRegionByCountryName(reg);
    if (countryRegion) {
      // reg 是具体国家（例如 "英国"），但在 step 2 中未包含在用户已勾选国家中，因此直接排查跳过！
      continue;
    }

    // 4. reg 不是具体国家名，而是泛大洲名称（如 "欧洲"、"北美"）
    const normReg = normalizeRegionName(reg);
    const hasMatchingRegion = selectedCountries.some(cty => {
      const ctyRegion = getRegionByCountryName(cty);
      return ctyRegion && normalizeRegionName(ctyRegion) === normReg;
    });
    if (hasMatchingRegion) return true;
  }

  return false;
};

export function filterGraphData(
  nodes: GraphNode[],
  links: GraphLink[],
  selectedRegion: string,
  selectedCountries: string[] | string,
  selectedProducts: string[] | string | null,
  focusNodeId: string | null = null
): { nodes: GraphNode[]; links: GraphLink[] } {
  // 向后兼容旧签名: (nodes, links, selectedMarket, selectedProduct, focusNodeId)
  let regionArg = selectedRegion;
  let countriesArg: string[] = [];
  let productsArg: string[] = [];
  let realFocusNodeId = focusNodeId;

  if (typeof selectedCountries === 'string') {
    // 旧参数：selectedMarket = selectedRegion, selectedProduct = selectedCountries, focusNodeId = selectedProducts
    regionArg = 'All';
    countriesArg = [selectedRegion];
    productsArg = [selectedCountries];
    realFocusNodeId = selectedProducts as string | null;
  } else {
    countriesArg = selectedCountries;
    productsArg = Array.isArray(selectedProducts) ? selectedProducts : selectedProducts ? [selectedProducts] : ['All'];
  }

  // 1. 计算邻接节点（一阶）以原始 links 为基准
  const adjIds = new Set<string>();
  if (realFocusNodeId) {
    adjIds.add(realFocusNodeId);
    for (const link of links) {
      const srcId = typeof link.source === 'object' ? link.source.id : link.source;
      const tgtId = typeof link.target === 'object' ? link.target.id : link.target;
      if (srcId === realFocusNodeId) {
        adjIds.add(tgtId);
      } else if (tgtId === realFocusNodeId) {
        adjIds.add(srcId);
      }
    }
  }

  // 2. 过滤 nodes：提取匹配区域、国家列表和产品品类列表的报告节点
  const filteredNodes = nodes.filter(node => {
    // 区域过滤
    if (regionArg !== 'All' && !isNodeInRegion(node.market_region, regionArg)) {
      return false;
    }

    // 国家过滤 (多选)
    if (!isNodeMatchingCountries(node, countriesArg)) {
      return false;
    }

    // 产品品类过滤 (多选)
    if (productsArg.length > 0 && !productsArg.includes('All')) {
      const isMatched = productsArg.some(p => isNodeMatchingProduct(node, p));
      if (!isMatched) return false;
    }

    // 聚焦过滤
    if (realFocusNodeId && !adjIds.has(node.id)) {
      return false;
    }
    return true;
  });

  const filteredNodeIds = new Set(filteredNodes.map(n => n.id));

  // 3. 过滤 links
  const filteredLinks = links.filter(link => {
    const srcId = typeof link.source === 'object' ? link.source.id : link.source;
    const tgtId = typeof link.target === 'object' ? link.target.id : link.target;

    // 两端节点必须都属于当前筛选切面
    if (!filteredNodeIds.has(srcId) || !filteredNodeIds.has(tgtId)) {
      return false;
    }

    return true;
  });

  return { nodes: filteredNodes, links: filteredLinks };
}


export function computeTwoHopHighlight(
  selectedNodeId: string | null,
  links: GraphLink[]
): { highlightNodes: Set<string>; highlightLinks: Set<string> } {
  const highlightNodes = new Set<string>();
  const highlightLinks = new Set<string>();

  if (!selectedNodeId) {
    return { highlightNodes, highlightLinks };
  }

  highlightNodes.add(selectedNodeId);

  // 1-hop neighbors
  const firstNeighbors = new Set<string>();
  links.forEach((l: any) => {
    const s = typeof l.source === 'object' ? l.source.id : l.source;
    const t = typeof l.target === 'object' ? l.target.id : l.target;
    if (s === selectedNodeId) {
      firstNeighbors.add(t);
      highlightNodes.add(t);
      highlightLinks.add(`${s}-${t}`);
    } else if (t === selectedNodeId) {
      firstNeighbors.add(s);
      highlightNodes.add(s);
      highlightLinks.add(`${s}-${t}`);
    }
  });

  // 2-hop neighbors
  links.forEach((l: any) => {
    const s = typeof l.source === 'object' ? l.source.id : l.source;
    const t = typeof l.target === 'object' ? l.target.id : l.target;
    if (firstNeighbors.has(s) && !highlightNodes.has(t)) {
      highlightNodes.add(t);
      highlightLinks.add(`${s}-${t}`);
    } else if (firstNeighbors.has(t) && !highlightNodes.has(s)) {
      highlightNodes.add(s);
      highlightLinks.add(`${s}-${t}`);
    }
  });

  return { highlightNodes, highlightLinks };
}

