# 个人图谱双主题切换与流光动效重构实现计划

> **面向 AI 代理的工作者：** 必需子技能：使用 superpowers:subagent-driven-development（推荐）或 superpowers:executing-plans 逐任务实现此计划。步骤使用复选框（`- [ ]`）语法来跟踪进度。

**目标：** 在个人知识图谱页面实现一键切换“暖乳砂极简”与“霓虹暗黑星空”双主题，仅影响 Canvas 图谱视窗，并在暗黑模式下呈现炫酷的 3D 发光节点、荧光连线和粒子能量流动效果。

**架构：**
1. 升级 `lib/graph-styles.ts` 导出支持多主题的网格背景样式计算函数。
2. 在 `components/ObsidianGraph.tsx` 组件中，使用 `localStorage` 维护本地 `graphTheme` 状态。
3. 在图谱组件的卡片右上角渲染悬浮的主题切换按钮，控制图谱状态并在切换时触发重绘。
4. 重构 `nodeCanvasObject` 以及 `linkColor`、`linkWidth`、`linkDirectionalParticles` 的属性绑定，实现在 Cyberpunk 下的高对比度霓虹发光、高对比文字和能量粒子流速配置。

**技术栈：** Next.js, React, HTML5 Canvas 2D, Force-Graph 2D API.

---

## 1. 计划涉及的文件与职责决策

*   [MODIFY] [graph-styles.ts](file:///Users/jason/Documents/Antigravity/Project/Globaltradebuddy/lib/graph-styles.ts)
    *   职责：更新 `getGraphContainerBackgroundStyle` 函数，支持传入 `theme: 'warm' | 'cyberpunk'` 参数，并分别返回匹配的网格点阵 CSS 样式。
*   [MODIFY] [ObsidianGraph.tsx](file:///Users/jason/Documents/Antigravity/Project/Globaltradebuddy/components/ObsidianGraph.tsx)
    *   职责：引入 `graphTheme` 状态并在右上角绝对定位悬浮毛玻璃切换按钮；在 Canvas 绘制回调中，针对 `cyberpunk` 主题，开启节点霓虹发光阴影，切换霓虹连线色彩与粒子流光。

---

## 2. 详细执行任务

### 任务 1：升级背景样式计算函数 (`lib/graph-styles.ts`)

**文件：**
- 修改：`lib/graph-styles.ts`

- [ ] **步骤 1：修改 `getGraphContainerBackgroundStyle` 支持 `theme` 参数**
  重写 `lib/graph-styles.ts` 中的 `getGraphContainerBackgroundStyle`。

```typescript
export function getGraphContainerBackgroundStyle(theme: 'warm' | 'cyberpunk' = 'warm'): React.CSSProperties {
  if (theme === 'cyberpunk') {
    return {
      background: '#0b0f19',
      backgroundImage: 'radial-gradient(rgba(56, 189, 248, 0.12) 1.5px, transparent 1.5px)',
      backgroundSize: '24px 24px'
    };
  }
  return {
    background: 'rgba(246, 246, 246, 0.03)',
    backgroundImage: 'radial-gradient(rgba(18, 18, 18, 0.08) 1px, transparent 1px)',
    backgroundSize: '24px 24px'
  };
}
```

- [ ] **步骤 2：Commit 变更**

```bash
git add lib/graph-styles.ts
git commit -m "feat: support theme parameter in graph background style helper"
```

---

### 任务 2：实现组件内主题状态与悬浮控制按钮 (`components/ObsidianGraph.tsx`)

**文件：**
- 修改：`components/ObsidianGraph.tsx`

- [ ] **步骤 1：在组件内部初始化 `graphTheme` 状态，并绑定 LocalStorage 缓存**
  在 `ObsidianGraph` 组件声明的第一行（Line 57 左右）插入主题状态声明。

```typescript
  const [graphTheme, setGraphTheme] = React.useState<'warm' | 'cyberpunk'>(() => {
    if (typeof window !== 'undefined') {
      return (localStorage.getItem('gtb_graph_theme') as 'warm' | 'cyberpunk') || 'warm';
    }
    return 'warm';
  });
```

- [ ] **步骤 2：在组件的返回 JSX 中添加绝对定位的主题切换按钮**
  在 `components/ObsidianGraph.tsx` 的外层 `div`（Line 467 开始的 return 块）右上角浮动定位按钮。
  并在 `onClick` 中调用 `setGraphTheme`，将最新的值同步至 `localStorage`。

```typescript
      {/* 绝对定位的局部主题切换按钮 */}
      <button
        onClick={() => {
          setGraphTheme(prev => {
            const next = prev === 'warm' ? 'cyberpunk' : 'warm';
            localStorage.setItem('gtb_graph_theme', next);
            return next;
          });
        }}
        style={{
          position: 'absolute',
          top: '12px',
          right: '80px', // 避让其他全屏/控制图标
          zIndex: 100,
          background: graphTheme === 'cyberpunk' ? 'rgba(56, 189, 248, 0.15)' : 'rgba(15, 23, 42, 0.05)',
          backdropFilter: 'blur(8px)',
          WebkitBackdropFilter: 'blur(8px)',
          border: graphTheme === 'cyberpunk' ? '1px solid rgba(56, 189, 248, 0.3)' : '1px solid rgba(15, 23, 42, 0.1)',
          color: graphTheme === 'cyberpunk' ? '#38bdf8' : 'var(--color-text)',
          borderRadius: '50%',
          width: '32px',
          height: '32px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer',
          boxShadow: graphTheme === 'cyberpunk' ? '0 0 10px rgba(56, 189, 248, 0.2)' : 'none',
          transition: 'all 0.3s'
        }}
        title={graphTheme === 'cyberpunk' ? "切换为暖砂极简模式" : "切换为霓虹暗黑模式"}
      >
        {graphTheme === 'cyberpunk' ? (
          // 亮色太阳图标
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="4" />
            <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41" />
          </svg>
        ) : (
          // 暗色星空/月亮图标
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z" />
          </svg>
        )}
      </button>
```

- [ ] **步骤 3：绑定外围包裹 Card 的样式，使其随主题切换平滑变色**
  修改 `components/ObsidianGraph.tsx` return 块最外层卡片 `div` 和顶部 Header `div` 的内联 `style` 属性。
  当 `graphTheme === 'cyberpunk'` 时：
  - 卡片外框：`background: 'rgba(11, 15, 25, 0.95)'`, `border: '1px solid rgba(56, 189, 248, 0.15)'`, `boxShadow: '0 10px 40px rgba(56, 189, 248, 0.08)'`
  - 图谱标题 Header `div`：`background: 'rgba(56, 189, 248, 0.02)'`, `borderBottom: '1px solid rgba(56, 189, 248, 0.12)'`
  - 标题文字 `span` 样式：`color: '#f8fafc'`
  - 网格 Canvas 区域背景：`getGraphContainerBackgroundStyle(graphTheme)`

- [ ] **步骤 4：Commit 变更**

```bash
git add components/ObsidianGraph.tsx
git commit -m "feat: implement graphTheme state and floating toggle button in ObsidianGraph"
```

---

### 任务 3：重构 Canvas 霓虹发光与流光连线渲染逻辑 (`components/ObsidianGraph.tsx`)

**文件：**
- 修改：`components/ObsidianGraph.tsx`

- [ ] **步骤 1：同步状态 Ref 并绑定 forceGraph 实例背景色**
  在 `components/ObsidianGraph.tsx` 中新增主题的 Ref 映射，并把 `ForceGraph` 挂载参数中的背景色绑定到主题状态：
  - 新增 `const graphThemeRef = useRef(graphTheme);`，并在 `useEffect`（第 151 行左右）同步其值：`graphThemeRef.current = graphTheme;`。
  - 在 `ForceGraph` 的 `.backgroundColor(...)` 回调处，修改为：
    `.backgroundColor(graphThemeRef.current === 'cyberpunk' ? '#0b0f19' : 'rgba(0,0,0,0)')`

- [ ] **步骤 2：重写 `nodeCanvasObject` 的节点与文字发光渲染**
  当 `graphThemeRef.current === 'cyberpunk'` 时：
  - 在 Canvas 绘制文字或节点前，设置阴影发光样式：
    ```typescript
    ctx.shadowBlur = 10 / globalScale;
    ctx.shadowColor = isReport ? 'rgba(56, 189, 248, 0.8)' : 'rgba(167, 139, 250, 0.8)';
    ```
    （在绘制完节点和文字后，务必将 `ctx.shadowBlur = 0` 恢复默认值以免干扰其他图形的绘制）。
  - 设置高对比的标签文字颜色：
    ```typescript
    ctx.fillStyle = graphThemeRef.current === 'cyberpunk'
      ? `rgba(248, 250, 252, ${opacity})` // 暗黑霓虹高光白 (slate-50)
      : `rgba(60, 57, 53, ${opacity * 0.95})`; // 暖乳砂炭黑 (graphite)
    ```

- [ ] **步骤 3：重构连线色彩（`linkColor`）与流体粒子参数**
  - 当 `graphThemeRef.current === 'cyberpunk'` 时，连线配色重写为高饱和的霓虹色彩映射，不再通过原本的 `getLinkColor` 返回。
  - 重构 `linkDirectionalParticles` 的回调。在 Cyberpunk 模式下，允许为特定核心关系（如竞争、供销）开启 `3` 个粒子流动，其他关系开启 `1` 个粒子。
  - 重写粒子速度，确保在粒子激活时流速平滑运动。

- [ ] **步骤 4：Commit 变更**

```bash
git add components/ObsidianGraph.tsx
git commit -m "feat: implement cyberpunk neon node drawing and flow particles in Canvas"
```

---

## 3. 验证与手动测试指南

### 手动验证步骤：
1. 本地启动开发服务器 `npm run dev` 并访问 `/my-graph`。
2. 检查右上角是否出现了精美的毛玻璃圆形主题按钮。
3. 点击切换，确认 Canvas 区域背景平滑变为深黑色，连线上开启了萤火虫般的动态粒子流动，节点带有精致的外发光阴影。
4. 确认在双主题下，点击节点的“二阶高亮算法”和“四角细线呼吸选择框”依然能 60fps 顺畅运行。
5. 刷新网页，确认本地缓存生效，图谱保持上一次的主题配置。
