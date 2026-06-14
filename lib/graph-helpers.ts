export interface GraphNode {
  id: string;
  title: string;
  category: string;
  market_region: string;
  summary?: string;
  companies?: string[];
  products?: string[];
  channels?: string[];
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

export function filterGraphData(
  nodes: GraphNode[],
  links: GraphLink[],
  selectedMarket: string,
  selectedProduct: string,
  focusNodeId: string | null
): { nodes: GraphNode[]; links: GraphLink[] } {
  // 1. 计算邻接节点（一阶）以原始 links 为基准
  const adjIds = new Set<string>();
  if (focusNodeId) {
    adjIds.add(focusNodeId);
    for (const link of links) {
      const srcId = typeof link.source === 'object' ? link.source.id : link.source;
      const tgtId = typeof link.target === 'object' ? link.target.id : link.target;
      if (srcId === focusNodeId) {
        adjIds.add(tgtId);
      } else if (tgtId === focusNodeId) {
        adjIds.add(srcId);
      }
    }
  }

  // 2. 过滤 nodes
  const filteredNodes = nodes.filter(node => {
    // 国家/市场过滤
    if (selectedMarket !== 'All') {
      const regions = node.market_region ? node.market_region.split(',').map(r => r.trim()) : [];
      if (!regions.includes(selectedMarket) && !regions.includes('全球')) {
        return false;
      }
    }
    // 产品品类过滤
    if (selectedProduct !== 'All') {
      const hasProduct = node.products?.includes(selectedProduct);
      const titleMatches = node.category !== 'customer' && node.title.includes(selectedProduct);
      if (!hasProduct && !titleMatches) {
        return false;
      }
    }
    // 聚焦过滤
    if (focusNodeId && !adjIds.has(node.id)) {
      return false;
    }
    return true;
  });

  const filteredNodeIds = new Set(filteredNodes.map(n => n.id));

  // 3. 过滤 links
  const filteredLinks = links.filter(link => {
    const srcId = typeof link.source === 'object' ? link.source.id : link.source;
    const tgtId = typeof link.target === 'object' ? link.target.id : link.target;

    // 两端都必须在过滤后的节点列表中
    if (!filteredNodeIds.has(srcId) || !filteredNodeIds.has(tgtId)) {
      return false;
    }

    // 产品过滤
    if (selectedProduct !== 'All' && link.relation_key !== selectedProduct) {
      return false;
    }

    return true;
  });

  return { nodes: filteredNodes, links: filteredLinks };
}
