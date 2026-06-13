import { describe, it, expect } from 'vitest';
import { filterGraphData, GraphNode, GraphLink } from '../lib/graph-helpers';

describe('Graph Filter Logic', () => {
  const mockNodes: GraphNode[] = [
    { id: '1', title: '美国大豆进口报告', category: 'product_category', market_region: '美国', products: ['大豆'], companies: ['A 公司'] },
    { id: '2', title: '全球海运费波动分析', category: 'product_category', market_region: '全球', products: [], companies: [] },
    { id: '3', title: '巴西玉米出口情况', category: 'product_category', market_region: '巴西', products: ['玉米'], companies: ['B 公司'] },
    { id: '4', title: '美国大宗买家客户', category: 'customer', market_region: '美国', products: ['大豆'], companies: ['C 公司'] }
  ];

  const mockLinks: GraphLink[] = [
    { source: '1', target: '4', relation_key: '大豆' },
    { source: '1', target: '2', relation_key: '全球化' },
    { source: '3', target: '2', relation_key: '玉米运输' }
  ];

  it('should return all nodes and links when filters are empty', () => {
    const result = filterGraphData(mockNodes, mockLinks, 'All', 'All', null);
    expect(result.nodes).toHaveLength(4);
    expect(result.links).toHaveLength(3);
  });

  it('should filter by market_region including "全球"', () => {
    const result = filterGraphData(mockNodes, mockLinks, '美国', 'All', null);
    // 应该包含 1, 2, 4 (2的 region 是 全球)
    expect(result.nodes.map(n => n.id)).toEqual(expect.arrayContaining(['1', '2', '4']));
    expect(result.nodes).toHaveLength(3);
    // links 过滤：连线的两端都必须在过滤后的节点里
    // 1-4 (OK), 1-2 (OK), 3-2 (3不在，所以过滤掉)
    expect(result.links).toHaveLength(2);
  });

  it('should filter by product category', () => {
    const result = filterGraphData(mockNodes, mockLinks, 'All', '大豆', null);
    // 应该包含含有大豆产品的节点：1, 4
    expect(result.nodes.map(n => n.id)).toEqual(expect.arrayContaining(['1', '4']));
    expect(result.nodes).toHaveLength(2);
    // 连线过滤：不仅 source/target 要在 nodes 中，连线 relation_key 必须等于 '大豆'
    expect(result.links).toHaveLength(1);
    expect(result.links[0].relation_key).toBe('大豆');
  });

  it('should filter by focusNodeId (1st degree adjacency)', () => {
    // 聚焦节点 1
    const result = filterGraphData(mockNodes, mockLinks, 'All', 'All', '1');
    // 节点 1 连着 4 和 2
    expect(result.nodes.map(n => n.id)).toEqual(expect.arrayContaining(['1', '2', '4']));
    expect(result.nodes).toHaveLength(3);
    expect(result.links).toHaveLength(2); // 1-4, 1-2
  });
});
