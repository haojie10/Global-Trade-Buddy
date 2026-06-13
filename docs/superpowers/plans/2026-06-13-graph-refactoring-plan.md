# 知识图谱重构与筛选功能实现计划

> **面向 AI 代理的工作者：** 必需子技能：使用 superpowers:subagent-driven-development（推荐）或 superpowers:executing-plans 逐任务实现此计划。步骤使用复选框（`- [ ]`）语法来跟踪进度。

**目标：** 实现个人外贸知识拓扑网络的前端图谱视图重构，新增顶部筛选栏与右侧商业画像看板，并提供强大的数据过滤。

**架构：**
1. 将图谱过滤核心算法抽离为 `lib/graph-helpers.ts`，编写 Vitest 测试进行 TDD 验证。
2. 重构 `components/ObsidianGraph.tsx` 支持 `onNodeSelect` 和 `onNodeDoubleClick` 回调并实现 300ms 双击判定。
3. 在 `pages/my-graph.tsx` 中加入顶部筛选器 UI，对接过滤算法，实现右侧 Tab画像卡片和工具箱切换。

**技术栈：** React, Next.js, TypeScript, Vitest

---

### 任务 1：核心过滤算法开发与测试 (TDD)

**文件：**
- 创建：`lib/graph-helpers.ts`
- 测试：`tests/graph-filter.test.ts`

- [ ] **步骤 1：编写失败的测试**
在 `tests/graph-filter.test.ts` 中写入以下内容：
```typescript
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
```

- [ ] **步骤 2：运行测试验证失败**
运行：`vitest run tests/graph-filter.test.ts`
预期：FAIL，提示找不到 `lib/graph-helpers`。

- [ ] **步骤 3：编写最少实现代码**
创建 `lib/graph-helpers.ts`：
```typescript
export interface GraphNode {
  id: string;
  title: string;
  category: string;
  market_region: string;
  summary?: string;
  companies?: string[];
  products?: string[];
  channels?: string[];
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
  // 1. 计算邻接节点（一阶）以原始 links 为准
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
      if (node.market_region !== selectedMarket && node.market_region !== '全球') {
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
```

- [ ] **步骤 4：运行测试验证通过**
运行：`vitest run tests/graph-filter.test.ts`
预期：PASS

- [ ] **步骤 5：Commit**
运行命令：
```bash
git add lib/graph-helpers.ts tests/graph-filter.test.ts
git commit -m "test & feat: add graph filtering helper and corresponding tests"
```

---

### 任务 2：重构 components/ObsidianGraph.tsx

**文件：**
- 修改：`components/ObsidianGraph.tsx`

- [ ] **步骤 1：修改 ObsidianGraph.tsx 里的类型与交互逻辑**
主要修改：
1. 升级 `Node`、`Link` 及 `ObsidianGraphProps` 的 TS 类型定义。
2. 在 `onNodeClick` 处理器中使用双击检测：
```typescript
      let clickTimeout: any = null;
      let lastClickedNodeId: string | null = null;
      let lastClickTime = 0;
```
并在里面：
```typescript
        .onNodeClick((node: any) => {
          const now = Date.now();
          if (lastClickedNodeId === node.id && now - lastClickTime < 300) {
            if (clickTimeout) {
              clearTimeout(clickTimeout);
              clickTimeout = null;
            }
            lastClickedNodeId = null;
            lastClickTime = 0;
            onNodeDoubleClick?.(node);
          } else {
            if (clickTimeout) {
              clearTimeout(clickTimeout);
            }
            lastClickedNodeId = node.id;
            lastClickTime = now;
            clickTimeout = setTimeout(() => {
              onNodeSelect?.(node);
              clickTimeout = null;
              lastClickedNodeId = null;
              lastClickTime = 0;
            }, 300);
          }
        });
```

- [ ] **步骤 2：Commit**
```bash
git add components/ObsidianGraph.tsx
git commit -m "refactor: update ObsidianGraph TS interfaces and implement double-click handler"
```

---

### 任务 3：重构 pages/my-graph.tsx 以支持筛选与画像看板

**文件：**
- 修改：`pages/my-graph.tsx`

- [ ] **步骤 1：增加状态管理并渲染顶部筛选栏**
在 `MyGraphPage` 中增加：
- `selectedMarket` ('All')
- `selectedProduct` ('All')
- `focusNodeId` (null)
- `selectedNode` (null)
- `activeTab` ('tools' | 'profile'，默认为 'tools')

- [ ] **步骤 2：过滤逻辑接入**
动态提取不重复的市场和品类名称：
```typescript
  const markets = ['All', ...Array.from(new Set(graphData.nodes.map(n => n.market_region).filter(Boolean)))];
  const products = ['All', ...Array.from(new Set(graphData.nodes.flatMap(n => n.products || []).filter(Boolean)))];
```
应用 `filterGraphData` 获得 `filteredGraphData`。

- [ ] **步骤 3：界面布局重组**
1. 顶部筛选栏：在 `MyGraphPage` 的 `<ObsidianGraph>` 上方，加入具有毛玻璃视觉的顶部筛选栏。
   - 包括国家/市场下拉框、产品品类下拉框。
   - 重置按钮。
   - 若 `focusNodeId` 存在，显示醒目的聚焦提醒横幅。
2. 右侧面板 Tab 化：
   - 切换 Tab: `📁 商业画像看板` (如果有 selectedNode 时显示或默认高亮) / `🛠️ 外贸快捷工具箱`。
   - 当 `activeTab === 'profile'` 且 `selectedNode` 不为空时，渲染精美磨砂玻璃质感画像卡片。
   - 点击报告详情按钮跳转 `/reports/${node.id}`。
   - `onNodeSelect` 回调时，将 `selectedNode` 设为该节点并自动切换 `activeTab` 为 `'profile'`。
   - `onNodeDoubleClick` 回调时，将 `focusNodeId` 设为该节点。

- [ ] **步骤 4：Commit**
```bash
git add pages/my-graph.tsx
git commit -m "feat: integrate filtering UI and profile tab panel into my-graph page"
```

---

### 任务 4：全局测试与完成验证

- [ ] **步骤 1：全局测试验证**
运行：`npm test`
确保没有任何测试失败，且原有的图谱 API 和页面无编译错误。

- [ ] **步骤 2：完成汇报**
把所有改动和测试运行结果以消息形式回复给主代理。
