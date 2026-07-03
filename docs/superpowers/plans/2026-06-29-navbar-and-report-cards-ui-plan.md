# 导航栏与报告卡片 UI 升级实现计划

> **对于 Agent 工作者：** 必需的子技能：推荐使用 `sp-subagent-driven-development` 或 `sp-executing-plans` 来逐个任务实现此计划。步骤使用复选框 (`- [ ]`) 语法以便追踪。

**目标:** 
1. 将首页和图谱页面的 Header 导航栏背景色改为品牌色 `#ff641e`，文字和按钮调整为舒服的高对比度白色/磨砂半透明白。
2. 加深报告卡片底色，使其在网页浅色底色中具有强烈对比度；使用 CSS 让卡片在鼠标悬停 hover 时背景变为品牌色，内部字体与图标全套自动变白。
3. 状态化重构报告卡片下方的动作文本：已解锁状态只显示“已解锁”与“立即阅读 →”；未解锁状态显示“未解锁”密码锁按钮与“立即预览与解锁 →”。

---

## 任务 1：升级 styles/globals.css 新增报告卡片 Hover 响应规则

- [ ] **步骤 1：增加卡片样式类 `.report-card` 的样式定义**
  在 `styles/globals.css` 尾部追加全新的样式规则。使用 `!important` 覆盖内联排版背景，定义 hover 瞬间后代文字、SVG、按钮和已解锁 Tag 的自动染色转换规则：
  ```css
  .report-card {
    background: #efe9df !important; /* 默认深底色，增强对比度 */
    transition: all 0.4s cubic-bezier(0.16, 1, 0.3, 1) !important;
  }

  .report-card:hover {
    background: var(--color-accent, #ff641e) !important;
    transform: translateY(-4px) !important;
    box-shadow: 0 12px 30px rgba(255, 100, 30, 0.25) !important;
  }

  /* 悬停时所有内部子文本和链接强制变白 */
  .report-card:hover * {
    color: #ffffff !important;
    border-color: rgba(255, 255, 255, 0.25) !important;
  }

  .report-card:hover svg {
    stroke: #ffffff !important;
  }

  .report-card:hover button {
    background: rgba(255, 255, 255, 0.2) !important;
    color: #ffffff !important;
  }

  .report-card:hover .unlocked-tag {
    background: rgba(255, 255, 255, 0.2) !important;
    color: #ffffff !important;
  }
  ```

---

## 任务 2：重构 components/ReportList.tsx 绑定卡片样式与解锁动作逻辑

- [ ] **步骤 1：绑定 class 并在 JSX 中优化悬浮与解锁展示逻辑**
  修改 `components/ReportList.tsx` 中的报告卡片组件（约第 162-290 行）：
  - 增加 `className="report-card"`。
  - 去除 JSX 中内联的 `onMouseOver` 和 `onMouseOut` 函数（相关动效已移至 globals.css 中，以获得更极致的前端流畅度）。
  - 给已解锁标签加上 `className="unlocked-tag"`，使其能响应 hover 漂白。
  - 将底部已解锁与未解锁提示块（行 242-289）合并，使得已解锁时右侧仅显示“立即阅读 →”，而未解锁时右侧显示“立即预览与解锁 →”。
  ```tsx
  {report.isUnlocked ? (
    <>
      <span className="unlocked-tag" style={{
        fontSize: '0.75rem',
        fontWeight: 300,
        padding: '4px 10px',
        borderRadius: '8px',
        background: 'rgba(16, 185, 129, 0.08)',
        color: '#059669',
        display: 'flex',
        alignItems: 'center',
        gap: '4px',
        transition: 'all 0.3s'
      }}>
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="20 6 9 17 4 12" />
        </svg>
        已解锁
      </span>
      <span style={{ fontSize: '0.8rem', color: 'var(--color-accent)', fontWeight: 'var(--btn-font-weight)', letterSpacing: 'var(--btn-letter-spacing)', transition: 'all 0.3s' }}>
        立即阅读 →
      </span>
    </>
  ) : (
    <>
      <button
        onClick={(e) => handleUnlock(e, report.id)}
        style={{
          background: 'rgba(255, 100, 30, 0.08)',
          border: 'none',
          color: 'var(--color-accent)',
          fontSize: '0.75rem',
          fontWeight: 300,
          padding: '4px 10px',
          borderRadius: '8px',
          cursor: 'pointer',
          transition: 'background 0.2s',
          display: 'flex',
          alignItems: 'center',
          gap: '4px'
        }}
        onMouseOver={(e) => e.currentTarget.style.background = 'rgba(255, 100, 30, 0.15)'}
        onMouseOut={(e) => e.currentTarget.style.background = 'rgba(255, 100, 30, 0.08)'}
      >
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
          <path d="M7 11V7a5 5 0 0 1 10 0v4" />
        </svg>
        未解锁
      </button>
      <span style={{ fontSize: '0.8rem', color: 'var(--color-accent)', fontWeight: 'var(--btn-font-weight)', letterSpacing: 'var(--btn-letter-spacing)', transition: 'all 0.3s' }}>
        立即预览与解锁 →
      </span>
    </>
  )}
  ```

---

## 任务 3：升级页面中的导航栏（Header）配色与文字高对比度排版

- [ ] **步骤 1：重构 pages/index.tsx 的导航栏**
  修改 `pages/index.tsx` 中的 `<header>` 及其子元素（约第 126-245 行）：
  - 将背景 `background` 修改为品牌色 `#ff641e`，移除 `backdropFilter` 并增加品牌色阴影。
  - 将 Logo 文字与地球图标描边改为 `#ffffff`。
  - 将“普通用户”、“游客模式”的文字颜色设为极淡微透明的白色 `rgba(255, 255, 255, 0.85)`。
  - 将剩余额度数字 `<b>` 颜色转为纯白。
  - 重塑“退出登录”与“登录/注册”按钮，样式更改为：`background: rgba(255, 255, 255, 0.15)`, `border: 1px solid rgba(255, 255, 255, 0.25)`, `color: #ffffff`，并在 `onMouseOver` 与 `onMouseOut` 中加入背景透明度的交互切换。

- [ ] **步骤 2：重构 pages/my-graph.tsx 的导航栏**
  修改 `pages/my-graph.tsx` 中的 `<header>` 及其子元素（约第 213-279 行）：
  - 将背景修改为品牌色 `#ff641e`。
  - 将图标和“市场图谱”标题文字改写为纯白色 `#ffffff`。
  - 将返回平台报告大厅按钮也转换为带有 `rgba(255, 255, 255, 0.15)` 磨砂感的半透明白设计。
  - 将“业务员 ID”和“剩余额度”等所有辅助信息文本全部转换为白色/微透明白。

---

## 任务 4：验证平台类型与编译正确性

- [ ] **步骤 1：静态类型分析**
  运行 `npx.cmd tsc --noEmit`，确保无任何编译或类型破坏。
