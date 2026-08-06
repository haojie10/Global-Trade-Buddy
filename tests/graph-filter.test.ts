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
    const result = filterGraphData(mockNodes, mockLinks, 'All', ['All'], ['All'], null);
    expect(result.nodes).toHaveLength(4);
    expect(result.links).toHaveLength(3);
  });

  it('should filter by region (e.g. 北美洲) including "全球"', () => {
    const result = filterGraphData(mockNodes, mockLinks, '北美洲', ['All'], ['All'], null);
    // 应该包含美国 (1, 4) 和 全球 (2)
    expect(result.nodes.map(n => n.id)).toEqual(expect.arrayContaining(['1', '2', '4']));
    expect(result.nodes).toHaveLength(3);
    expect(result.links).toHaveLength(2);
  });

  it('should filter by multiple countries', () => {
    const result = filterGraphData(mockNodes, mockLinks, 'All', ['美国', '巴西'], ['All'], null);
    // 节点 1(美国), 2(全球), 3(巴西), 4(美国) 全部符合
    expect(result.nodes).toHaveLength(4);
    expect(result.links).toHaveLength(3);
  });

  it('should filter by multiple product categories', () => {
    const result = filterGraphData(mockNodes, mockLinks, 'All', ['All'], ['大豆', '玉米'], null);
    // 应该包含含有大豆或玉米产品的节点：1, 3, 4
    expect(result.nodes.map(n => n.id)).toEqual(expect.arrayContaining(['1', '3', '4']));
    expect(result.nodes).toHaveLength(3);
  });

  it('should filter by focusNodeId (1st degree adjacency)', () => {
    // 聚焦节点 1
    const result = filterGraphData(mockNodes, mockLinks, 'All', ['All'], ['All'], '1');
    // 节点 1 连着 4 和 2
    expect(result.nodes.map(n => n.id)).toEqual(expect.arrayContaining(['1', '2', '4']));
    expect(result.nodes).toHaveLength(3);
    expect(result.links).toHaveLength(2); // 1-4, 1-2
  });

  it('should support legacy arguments for backward compatibility', () => {
    const result = filterGraphData(mockNodes, mockLinks, '美国', 'All', null as any);
    expect(result.nodes.map(n => n.id)).toEqual(expect.arrayContaining(['1', '2', '4']));
  });
});

