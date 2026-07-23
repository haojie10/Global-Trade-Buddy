import { filterGraphData, GraphNode, GraphLink } from '../lib/graph-helpers';

function testFilterEnforcement() {
  console.log('--- 开始测试图谱过滤与动态品类映射逻辑 ---');

  // 1. 模拟节点数据：此时节点的 products 已经由 graph.ts 从 report_industries 取出，变为了标准大类
  const mockNodes: GraphNode[] = [
    { 
      id: 'report_A', 
      title: '特斯拉供应链分析报告', 
      category: 'customer', 
      market_region: '全球', 
      products: ['汽车配件'] // 已被 graph.ts 替换为 GTB 标准大类
    },
    { 
      id: 'report_B', 
      title: '欧美刹车片市场研究', 
      category: 'product', 
      market_region: '欧美', 
      products: ['汽车配件'] // 已被 graph.ts 替换为 GTB 标准大类
    },
    { 
      id: 'report_C', 
      title: '大宗农产品玉米情况', 
      category: 'product', 
      market_region: '全球', 
      products: ['食品'] 
    },
    { 
      id: 'report_D', 
      title: '美国玉米买家分析', 
      category: 'customer', 
      market_region: '美国', 
      products: ['食品', '玉米'] 
    }
  ];

  // 2. 模拟连线数据：连线的 relation_key 依然保持具体物理产品名
  const mockLinks: GraphLink[] = [
    { source: 'report_A', target: 'report_B', relation_key: '刹车片' }, // 刹车片 -> 属于汽车配件
    { source: 'report_C', target: 'report_D', relation_key: '玉米' }     // 玉米 -> 属于食品
  ];

  // 测试场景一：筛选标准大类 "汽车配件"
  console.log('测试场景一: selectedProduct = "汽车配件"');
  const result1 = filterGraphData(mockNodes, mockLinks, 'All', '汽车配件', null);
  
  console.log('筛选后节点 (期待 report_A, report_B):', result1.nodes.map(n => n.id));
  console.log('筛选后连线 (期待 刹车片 连线):', result1.links.map(l => l.relation_key));

  if (result1.nodes.length !== 2 || !result1.nodes.some(n => n.id === 'report_A') || !result1.nodes.some(n => n.id === 'report_B')) {
    console.error('❌ 测试失败: 节点过滤不符合预期');
    process.exit(1);
  }
  if (result1.links.length !== 1 || result1.links[0].relation_key !== '刹车片') {
    console.error('❌ 测试失败: 刹车片连线被错误地过滤掉了！');
    process.exit(1);
  }
  console.log('✅ 测试场景一通过！\n');


  // 测试场景二：向下兼容测试 - 筛选非标准品类 "玉米"（类似 tests/graph-filter.test.ts 中的情况）
  console.log('测试场景二: selectedProduct = "玉米" (非内置 54 大类，但需向下兼容精确匹配)');
  const result2 = filterGraphData(mockNodes, mockLinks, 'All', '玉米', null);

  console.log('筛选后节点 (期待 report_C, report_D):', result2.nodes.map(n => n.id));
  console.log('筛选后连线 (期待 玉米 连线):', result2.links.map(l => l.relation_key));

  // Note: 因为 report_C/report_D 标题中均包含 "玉米"，符合 title.includes 规则，节点应该留下
  if (!result2.nodes.some(n => n.id === 'report_C') || !result2.nodes.some(n => n.id === 'report_D')) {
    console.error('❌ 测试失败: report_C 或 report_D 未被匹配！');
    process.exit(1);
  }
  // 玉米连线 relation_key 精确匹配 '玉米'，连线应该留下
  if (result2.links.length !== 1 || result2.links[0].relation_key !== '玉米') {
    console.error('❌ 测试失败: 玉米连线被过滤了！');
    process.exit(1);
  }
  console.log('✅ 测试场景二通过！\n');

  console.log('🎉 所有图谱品类动态映射与过滤测试大获成功！');
}

testFilterEnforcement();
