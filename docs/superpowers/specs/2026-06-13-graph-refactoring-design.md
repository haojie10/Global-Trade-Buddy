# 知识图谱重构设计说明书 (TDD)

## 1. 目标与需求
重构前端图谱视图页面，支持顶部筛选与侧边画像看板：
1. **组件修改 `components/ObsidianGraph.tsx`**：
   - 升级 TS 类型定义（`Node`，`Link`，`ObsidianGraphProps`）。
   - 实现双击检测逻辑（两次点击时间差 < 300ms）。
   - 去除原有的页面重定向，替换为 `onNodeSelect` 和 `onNodeDoubleClick` 回调。
2. **页面修改 `pages/my-graph.tsx`**：
   - 引入顶部筛选栏（国家/市场筛选、产品品类筛选、重置按钮、聚焦状态横幅）。
   - 实现图谱数据过滤算法，包括邻接节点（一阶）计算与连线过滤。
   - 引入右侧栏 Tab 切换（商业画像看板、外贸快捷工具箱）。
   - 选中节点时，将 `selectedNode` 设为该节点并高亮显示画像信息。

## 2. 详细设计与数据流

### 2.1 数据过滤算法（封装在 `lib/graph-helpers.ts`）
我们将核心过滤算法编写为纯函数，以便在 `tests/graph-filter.test.ts` 中对其进行全面的单元测试（遵循 TDD）。

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
): { nodes: GraphNode[]; links: GraphLink[] }
```

**过滤逻辑流程：**
1. 计算邻接节点（以原始 links 为基准）：
   - 如果 `focusNodeId` 存在：
     - `adjIds = new Set([focusNodeId])`
     - 遍历所有 `links`。设 `src = link.source.id ?? link.source`，`tgt = link.target.id ?? link.target`。
     - 如果 `src === focusNodeId`，把 `tgt` 加入 `adjIds`；如果 `tgt === focusNodeId`，把 `src` 加入 `adjIds`。
2. 过滤 `nodes`：
   - 国家/市场过滤：若 `selectedMarket !== 'All'`，则 `node.market_region === selectedMarket || node.market_region === '全球'`。
   - 产品品类过滤：若 `selectedProduct !== 'All'`，则 `node.products.includes(selectedProduct)`，或者 `(node.category !== 'customer' && node.title.includes(selectedProduct))`。
   - 聚焦节点过滤：若 `focusNodeId` 存在，则 `adjIds.has(node.id)`。
3. 过滤 `links`：
   - 节点 ID 检查：`source` 和 `target` 都必须在 `filteredNodes` 的 ID 集合中。
   - 关联关键字过滤：若 `selectedProduct !== 'All'`，则 `link.relation_key === selectedProduct`。

### 2.2 双击检测逻辑（在 `components/ObsidianGraph.tsx`）
- 单击和双击在 300ms 时间差内进行区分。
- 单击触发 `onNodeSelect`。
- 双击触发 `onNodeDoubleClick`
- 清除原有的直接跳转逻辑。

### 2.3 UI/UX 设计
- 使用毛玻璃效果的顶部筛选栏。
- 在有聚焦节点时，显示醒目横幅：“📍 正在聚焦报告：[focusedNode.title] (只展示其一阶关联节点) [清除聚焦]”。
- 右侧画像卡片在 `selectedNode` 为空时显示友好提示，不为空时以卡片标签形式呈现：
  - 报告名称（`title`）
  - 所涉国家/市场（`market_region`，蓝色标签）
  - 经营玩家/品牌（`companies`，绿色标签）
  - 涉及品类（`products`，橙色标签）
  - 覆盖渠道（`channels`，紫色标签）
  - 简要概述（`summary`）
  - 阅读详情按钮：路由跳转至 `/reports/${node.id}`。

## 3. TDD 测试计划
1. 在 `tests/graph-filter.test.ts` 中编写测试数据及过滤规则测试：
   - 测试 1：空数据和默认筛选（'All'）。
   - 测试 2：按国家/市场筛选（支持特定国家及全球）。
   - 测试 3：按产品品类筛选（匹配 products 数组或品类报告 title）。
   - 测试 4：聚焦节点筛选（计算一阶关联邻接节点）。
   - 测试 5：综合连线过滤（节点存在性、关键字一致性）。
2. 先运行测试，观察其因 `lib/graph-helpers.ts` 未实现而失败（红灯）。
3. 编写 `lib/graph-helpers.ts` 让测试全部通过（绿灯）。
4. 逐步重构页面 `pages/my-graph.tsx` 和组件 `components/ObsidianGraph.tsx` 整合过滤逻辑与 UI 展现。
5. 最终执行 `npm test` 验证。
