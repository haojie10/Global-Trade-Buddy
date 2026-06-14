# 前端巨型页面/组件拆分设计方案 (Task P2)

本设计文档详细描述了将主页 `pages/index.tsx` 和拓扑图页面 `pages/my-graph.tsx` 进行模块化拆分的设计方案。通过抽离高内聚的功能模块，优化前端架构，降低这两个核心文件的复杂度。

## 1. 拆分模块设计

### 1.1 管理员发布报告模态框: `components/AdminPanel.tsx`

将 `pages/index.tsx` 中涉及管理员发布数据报告的拖拽、表单输入、以及调用上传 API 等逻辑和 JSX 封装到该组件中。

#### 1.1.1 接口定义 (Props)

```typescript
interface AdminPanelProps {
  isOpen: boolean;
  onClose: () => void;
  onUploadSuccess: () => void;
}
```

#### 1.1.2 内部状态管理与逻辑
- **文件状态**: `selectedFile: File | null`
- **拖拽状态**: `isDragActive: boolean`
- **解析后内容**: `rawHtmlContent: string`
- **手动标记**:
  - `manualCompanies: string[]`
  - `manualProducts: string[]`
  - `manualRegions: string[]`
  - `manualChannels: string[]`
- **交互逻辑**:
  - 文件选择/拖拽，并使用 `detectAndDecodeHtml` 转换为解码后的 HTML 内容。
  - 多行标签动态增加与删除（支持 Company, Product, Region, Channel）。
  - 处理提交，调用 `/api/admin/reports/upload` 进行发布。

---

### 1.2 报告大厅列表与筛选: `components/ReportList.tsx`

将 `pages/index.tsx` 中“品类分析与客户洞察报告大厅”的筛选栏（关键字搜索、类别下拉、地区下拉）以及报告列表网格（包含点击解锁、更新额度等）移动到此组件中。

#### 1.2.1 接口定义 (Props)

```typescript
interface PlatformReport {
  id: string;
  title: string;
  category: string;
  market_region: string;
  summary: string;
  isUnlocked: boolean;
}

interface ReportListProps {
  reports: PlatformReport[];
  userId: string;
  userRole: string;
  quota: number;
  onUnlockSuccess: (newQuota: number, unlockedReportId: string) => void;
}
```

#### 1.2.2 内部状态与过滤逻辑
- **筛选状态**:
  - `searchQuery: string`
  - `selectedCategory: string` ('All' | 'customer' | 'product')
  - `selectedRegion: string` ('All' | 具体的地区)
- **过滤计算**:
  - 自动根据选中的类别、地区和标题/摘要内容对传入的 `reports` 进行前端实时过滤。
- **一键解锁逻辑**:
  - 未解锁状态下点击“立即预览与解锁”或特定区域时，如果用户已登录，直接发起 `/api/user/unlock-action` 请求。
  - 解锁成功后，调用回调 `onUnlockSuccess` 通知父组件，以便父组件同步更新剩余额度和列表内的报告解锁状态。

---

### 1.3 拓扑侧边栏画像: `components/NodeProfilePanel.tsx`

将 `pages/my-graph.tsx` 中当选中网图节点后，侧边栏 Profile Tab 渲染公司实体详情（别名管理、合作伙伴、竞争对手、锁定/解锁情况等）和报告详情的庞大 JSX 以及关联的 API 请求（添加别名、添加竞争对手、添加合作伙伴、绑定实体等）搬移到这里。

#### 1.3.1 接口定义 (Props)

```typescript
import { GraphNode } from '../lib/graph-helpers';

interface NodeProfilePanelProps {
  selectedNode: GraphNode | null;
  userRole: string;
  entityDetail: any;
  onRefreshGraph: () => Promise<void>;
  onNodeSelectUpdate: (node: GraphNode | null) => void;
  onFetchEntityDetail: (entityId: string) => Promise<void>;
  onDeleteNodeSuccess: () => void;
}
```

#### 1.3.2 渲染与交互逻辑
- **节点类型条件渲染**:
  - `selectedNode.node_type === 'entity'` 且 `entity_type === 'company'`:
    - 渲染公司别名列表、添加别名表单（调用 `/api/admin/entities/merge`）。
    - 竞争对手关系网、添加竞争对手表单（调用 `/api/admin/entities/relation`）。
    - 合作伙伴列表、添加合作伙伴表单。
    - 管理员永久删除公司实体按钮（调用 `/api/admin/delete-node`）。
  - `selectedNode.node_type === 'report'`:
    - 渲染报告基本信息及关联的品牌、品类和覆盖渠道。
    - 提供品牌、品类、渠道的标注 and 绑定表单（调用 `/api/admin/reports/tag`，并动态触发 graph 重新拉取以更新侧边栏）。
    - 提供“阅读报告详情”跳转按钮。
    - 管理员永久删除报告按钮（调用 `/api/admin/delete-node`）。

---

## 2. 页面重构与解耦

### 2.1 主页 `pages/index.tsx`
- 移出全部关于报告发布的 Modal 状态、拖拽状态、标签输入框逻辑，只保留 `showUploadModal` 变量以控制组件的挂载，引入 `<AdminPanel isOpen={showUploadModal} onClose={() => setShowUploadModal(false)} onUploadSuccess={() => window.location.reload()} />`。
- 将原本零散渲染的列表部分替换为 `<ReportList reports={reports} userId={userId} userRole={userRole} quota={quota} onUnlockSuccess={handleUnlockSuccess} />`。
- 新增 `reports` state，在初始化时通过 Props 的 `allReports` 进行赋能。当触发 `handleUnlockSuccess` 时：
  ```typescript
  const handleUnlockSuccess = (newQuota: number, unlockedReportId: string) => {
    setQuota(newQuota);
    setReports(prev => prev.map(rep => rep.id === unlockedReportId ? { ...rep, isUnlocked: true } : rep));
  };
  ```

### 2.2 图谱页面 `pages/my-graph.tsx`
- 将侧边栏 Profile Tab 内的臃肿的 JSX 和 API 交互封装到 `<NodeProfilePanel>` 组件中。
- 主页面仅保留拓扑图的核心状态 `selectedNode`，并在 node 点击时激活侧边栏。所有的添加别名、关系和打标动作对接口的请求都被封装在组件内部，请求成功后通过组件传入的回调函数（`onRefreshGraph`, `onNodeSelectUpdate`）通知父组件更新或拉取最新的拓扑数据。

---

## 3. 测试与验证策略

- **单元与集成测试**: 运行 `npm run test`，确保原有 API 和业务逻辑通过。
- **构建测试**: 运行 `npm run build` 确保 TypeScript 类型编译和 Next.js 打包无误。
- **提交确认**: 代码测试通过且构建成功后，执行 commit 提交变更。
