# 市场图谱 UI 优化实现计划

> **对于 Agent 工作者：** 必需的子技能：推荐使用 `sp-subagent-driven-development` 或 `sp-executing-plans` 来逐个任务实现此计划。步骤使用复选框 (`- [ ]`) 语法以便追踪。

**目标:** 优化市场图谱的前端 UI 展示，彻底移除 Emoji，统合侧边栏和标签的 VI 风格（不显 ID，多色改纯色，支持 unselected 看板与选中后4层关系动态过滤），以及更新底部标题。
**架构:** 
- 修改 `components/ObsidianGraph.tsx` 以细体呈现“市场图谱”标题并更换图例点颜色。
- 修改 `pages/my-graph.tsx` 移除零碎 emoji、给侧边栏组件传入 `activeGraphData.nodes` 以供看板计算，修改底部已解锁报告标题为“你的报告”。
- 修改 `components/NodeProfilePanel.tsx` 移除所有 emoji 字符，实现未选中状态下的 2x2 网格看板，并实现选中报告状态下排除 ID 与国家字段、根据类型只显示涉及的关联实体的逻辑。
**技术栈:** Next.js + React + TypeScript + Canvas

---

## 任务 1：优化 components/ObsidianGraph.tsx 里的标题与图例样式

- [ ] **步骤 1：精简并微调图谱头部标题**
  修改 `components/ObsidianGraph.tsx` 中第 484 行的 span，去掉 `📂 ` Emoji，文字由“您的个人外贸知识拓扑网络 (已解锁报告)”改为“市场图谱”，fontWeight 设为 `500`（细体），颜色使用 `var(--color-muted)`。
  ```tsx
  // 修改前
  <span style={{ fontSize: '0.85rem', color: '#475569', fontWeight: 600 }}>📂 您的个人外贸知识拓扑网络 (已解锁报告)</span>

  // 修改后
  <span style={{ fontSize: '0.85rem', color: 'var(--color-muted)', fontWeight: 500 }}>市场图谱</span>
  ```

- [ ] **步骤 2：对齐“客户洞察”与“品类分析”图例点的颜色与样式**
  修改 `components/ObsidianGraph.tsx` 第 485-488 行的图例样式，文字改为细体，大小 `0.85rem`，颜色为 `var(--color-muted)`，圆点各自使用图谱对应的物理橙色（`#ff641e`）与灰色（`#7a756f`）包裹。
  ```tsx
  // 修改前
  <div style={{ display: 'flex', gap: '16px', fontSize: '0.75rem', fontWeight: 600 }}>
    <span style={{ color: '#2563eb' }}>● 客户洞察</span>
    <span style={{ color: '#10b981' }}>● 品类分析</span>
  </div>

  // 修改后
  <div style={{ display: 'flex', gap: '16px', fontSize: '0.85rem', fontWeight: 500, color: 'var(--color-muted)' }}>
    <span><span style={{ color: '#ff641e', marginRight: '4px' }}>●</span>客户洞察</span>
    <span><span style={{ color: '#7a756f', marginRight: '4px' }}>●</span>品类分析</span>
  </div>
  ```

---

## 任务 2：修改 pages/my-graph.tsx 传递数据并精简文本

- [ ] **步骤 1：向侧边栏 NodeProfilePanel 传入 nodes 数据以供看板使用**
  修改 `pages/my-graph.tsx` 中调用的 `<NodeProfilePanel>` 组件，传入 `allNodes={activeGraphData.nodes}`。
  ```tsx
  // 修改前
  <NodeProfilePanel
    selectedNode={selectedNode}
    userRole={userRole}
    entityDetail={entityDetail}
    onRefreshGraph={refreshGraphData}
    onNodeSelectUpdate={(node) => setSelectedNode(node)}
    onFetchEntityDetail={fetchEntityDetail}
    onDeleteNodeSuccess={() => setSelectedNode(null)}
  />

  // 修改后
  <NodeProfilePanel
    selectedNode={selectedNode}
    userRole={userRole}
    entityDetail={entityDetail}
    onRefreshGraph={refreshGraphData}
    onNodeSelectUpdate={(node) => setSelectedNode(node)}
    onFetchEntityDetail={fetchEntityDetail}
    onDeleteNodeSuccess={() => setSelectedNode(null)}
    allNodes={activeGraphData.nodes}
  />
  ```

- [ ] **步骤 2：去除演示模式及种子初始化模块的 emoji 字符**
  修改 `pages/my-graph.tsx` 中的按钮提示文字，剔除 `⚡`、`🔌` 与 `⚠️`。
  ```tsx
  // 修改前
  {loading ? '⚡ 正在生成专属知识节点...' : '🔌 快速生成演示图谱并解锁首批报告'}
  // 修改后
  {loading ? '正在生成专属知识节点...' : '快速生成演示图谱并解锁首批报告'}

  // 修改前
  ⚠️ {error}
  // 修改后
  {error}
  ```

- [ ] **步骤 3：修改底部解锁报告的标题文案**
  修改 `pages/my-graph.tsx` 中第 835 行的标题文本，去 Emoji，缩短为“你的报告”。
  ```tsx
  // 修改前
  🔓 最近解锁的报告 (最多显示10篇)

  // 修改后
  你的报告
  ```

---

## 任务 3：重构 components/NodeProfilePanel.tsx 实现全新右侧看板与详情

- [ ] **步骤 1：在 Props 接口中添加 allNodes 支持**
  在 `components/NodeProfilePanel.tsx` 的接口声明中追加 `allNodes?: GraphNode[]`。
  ```tsx
  // 修改后
  interface NodeProfilePanelProps {
    selectedNode: GraphNode | null;
    userRole: string;
    entityDetail: any;
    onRefreshGraph: () => Promise<void>;
    onNodeSelectUpdate: (node: any) => void;
    onFetchEntityDetail: (entityId: string) => Promise<void>;
    onDeleteNodeSuccess: () => void;
    allNodes?: GraphNode[]; // 新置可选参数
  }
  ```

- [ ] **步骤 2：重写未选中节点的看板返回逻辑 (selectedNode === null)**
  替换 `components/NodeProfilePanel.tsx` 第 65-83 行的返回模块，基于 `allNodes` 前端动态提取出总报告数、客户洞察报告数、品类分析报告数、覆盖市场地区数，并使用暖沙色 VI 的 2x2 网格卡片渲染，彻底去除 Emoji。
  ```tsx
  // 修改后
  if (!selectedNode) {
    const reportNodes = allNodes ? allNodes.filter(n => n.node_type === 'report') : [];
    const totalReports = reportNodes.length;
    const customerReports = reportNodes.filter(n => n.category !== 'product').length;
    const productReports = reportNodes.filter(n => n.category === 'product').length;
    const coveredMarkets = new Set(reportNodes.map(n => n.market_region).filter(Boolean)).size;

    return (
      <div style={{
        flex: 1,
        padding: '24px',
        display: 'flex',
        flexDirection: 'column',
        gap: '24px'
      }}>
        <div style={{
          fontSize: '0.9rem',
          fontWeight: 500,
          color: 'var(--color-muted)',
          borderBottom: '1px solid rgba(160, 109, 68, 0.08)',
          paddingBottom: '12px'
        }}>
          报告整体情况看板
        </div>
        
        <div style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: '16px'
        }}>
          {[
            { label: '已解锁报告数', value: totalReports },
            { label: '客户洞察报告', value: customerReports },
            { label: '品类分析报告', value: productReports },
            { label: '涉及国家/市场', value: coveredMarkets }
          ].map((item, idx) => (
            <div key={idx} style={{
              background: 'rgba(160, 109, 68, 0.03)',
              border: '1px solid rgba(160, 109, 68, 0.08)',
              borderRadius: '16px',
              padding: '16px',
              textAlign: 'center',
              display: 'flex',
              flexDirection: 'column',
              gap: '4px'
            }}>
              <span style={{ fontSize: '0.75rem', color: 'var(--color-muted)' }}>{item.label}</span>
              <span style={{ fontSize: '1.75rem', fontWeight: 600, color: 'var(--color-accent)' }}>{item.value}</span>
            </div>
          ))}
        </div>

        <p style={{ 
          margin: '12px 0 0 0', 
          fontSize: '0.8rem', 
          lineHeight: 1.6, 
          color: 'var(--color-muted)',
          textAlign: 'center'
        }}>
          点击左侧图谱中的任意报告节点，即可在此查看该报告的智能商业画像与核心供需实体线索。
        </p>
      </div>
    );
  }
  ```

- [ ] **步骤 3：调整选中实体详情的 Emojis（公司实体）**
  修改 `components/NodeProfilePanel.tsx` 第 256-590 行中包含 Emoji 的标题与按钮。
  ```tsx
  // 标题
  "🏢 商业实体画像" -> "商业实体画像"
  "📝 公司基本情况 (管理员编辑)" -> "公司基本情况 (管理员编辑)"
  "📝 公司基本情况" -> "公司基本情况"
  "🌍 总部地点" -> "总部地点"
  "👥 员工规模" -> "员工规模"
  "🔗 官方网站" -> "官方网站"
  "🏷️ 同义别称 (别名)" -> "同义别称"
  "⚡ 竞争对手关系网" -> "竞争对手关系网"
  "🤝 合作商与供应商" -> "合作商与供应商"
  
  // 按钮文案
  "💾 保存公司基本情况" -> "保存公司基本情况"
  "🗑️ 永久删除此公司实体" -> "永久删除此公司实体"
  ```

- [ ] **步骤 4：调整选中报告详情并对标签配色做 VI 纯净化 (报告详情)**
  修改 `components/NodeProfilePanel.tsx` 第 591-855 行：
  1. 彻底去除 “报告 ID” 这一整行（包含其 JSX 节点）。
  2. 彻底去除 “所涉国家/市场” 这一个大的分类块。
  3. 定义统一的 Tag 配色（深碳灰色文字、淡沙色背景、淡米黄色边框）：
     ```tsx
     const tagStyle: React.CSSProperties = {
       background: 'rgba(160, 109, 68, 0.05)',
       color: 'var(--color-text)',
       border: '1px solid rgba(160, 109, 68, 0.15)',
       padding: '4px 10px',
       borderRadius: '12px',
       fontSize: '0.75rem',
       fontWeight: 500
     };
     ```
  4. 判断报告类型 `const isProduct = selectedNode.category === 'product' || selectedNode.node_type === 'product';`。
  5. 仅限非 `isProduct` (即公司报告) 时，渲染“经营玩家/品牌”、“竞争对手（Competitor）”和“覆盖渠道”三大板块。
  6. “涉及品类”板块在 `isProduct` 与非 `isProduct` 时均予以显示。
  7. 去除所有的 Emoji 装饰：
     ```tsx
     "👥 竞争对手 (Competitor)" -> "竞争对手"
     "📦 涉及品类" -> "涉及品类"
     "🛣️ 覆盖渠道" -> "覆盖渠道"
     "📝 报告概述" -> "报告概述"
     "📖 阅读报告详情" -> "阅读报告详情"
     "🗑️ 永久删除此报告" -> "永久删除此报告"
     ```

---

## 4. 验证计划

1. **手动编译与本地启动**
   运行 `npm run dev` 确保项目编译成功。
2. **看板逻辑确认**
   - 进入主页 `/my-graph`，在未选中节点时，右侧展示 2x2 网格看板，确认统计数据无误，且不含 Emoji。
   - 切换顶部筛选（地区、品类），确认右侧看板数据是否根据筛选结果实时更新。
3. **公司报告详情验证**
   - 点击图谱中的“客户/公司”类型报告，侧边栏能够加载，展示 4 层关系（品牌、竞争对手、品类、渠道），颜色风格统一为浅棕/碳灰（无多色），ID 与国家字段隐藏。
4. **品类报告详情验证**
   - 点击图谱中的“品类分析”类型报告，侧边栏能够加载，只展示“涉及品类”这一层实体关系与基本概述。
5. **标题及底部验证**
   - 图谱标题为“市场图谱”，圆点图例颜色对应橙、灰，字号字重对齐。
   - 底部标题为“你的报告”（无 Emoji）。
