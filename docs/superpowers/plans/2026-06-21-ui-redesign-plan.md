# Globaltradebuddy UI 视觉重构实现计划

> **面向 AI 代理的工作者：** 必需子技能：使用 superpowers:subagent-driven-development（推荐）或 superpowers:executing-plans 逐任务实现此计划。步骤使用复选框（`- [ ]`）语法来跟踪进度。

**目标：** 将整个 App UI 重构为基于“方案 B”的暖乳白纸张极简高级风，去除全站 Emoji、实体边框线，换用 1px 极细线条 SVG 矢量图标并应用 300 极细按钮字重与 22px 舒适圆角。

**架构：**
1. 在 `globals.css` 中定义集中化的 CSS 变量（配色、字重、字距、圆角）；
2. 剥离 `pages/index.tsx`, `components/ReportList.tsx`, `pages/my-graph.tsx` 中的行内物理边框（`border`）和 Emoji；
3. 将行内样式属性对接 CSS 变量（通过 `var(...)`），嵌入 1px 描边 SVG 矢量图形作为替代；
4. 运行本地自动化测试以防重构过程中业务状态与核心过滤函数失效。

**技术栈：** Next.js 14, React 18, CSS Custom Properties, SVG, Vitest.

---

### 任务 1：全局 CSS 变量系统与清理 (globals.css)

**文件：**
- 修改：`styles/globals.css`
- 测试：`tests/frontend-render.test.ts`

- [ ] **步骤 1：在 globals.css 中声明 631 调色及排版变量**
  修改 `styles/globals.css` 头部，将用户确定的沙盒微调参数作为全局 CSS 变量引入，并重构全局公共组件（如水滴按钮、悬浮卡片等）去除边框和修改字重。
  
  ```css
  :root {
    --bg-main: #fdfbf7;      /* 主背景色 (70%): 护眼暖乳白 */
    --bg-sub: #f6f3ec;       /* 结构辅助色 (20%): 无框承载色 */
    --color-accent: #ff641e; /* 焦点强调色 (10%): 极富活力的暖阳橘 */
    --color-text: #3c3935;   /* 主要文字: 柔和石墨深灰 */
    --color-muted: #7a756f;  /* 次要文字: 烟灰次要描述 */
    
    --btn-font-weight: 300;      /* 按钮与交互文字字重: 极细 Light */
    --btn-letter-spacing: 0px;   /* 按钮字间距 */
    --border-radius: 22px;       /* 柔和高级的圆角大小 */
  }

  /* 升级原本的水滴按钮，更名为 .sand-btn 去除框线并应用新变量 */
  .sand-btn {
    background: var(--bg-sub);
    border: none;
    border-radius: var(--border-radius);
    color: var(--color-accent);
    padding: 10px 24px;
    font-weight: var(--btn-font-weight);
    letter-spacing: var(--btn-letter-spacing);
    box-shadow: 0 4px 12px rgba(160, 109, 68, 0.03);
    transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1);
    cursor: pointer;
    outline: none;
    display: inline-block;
    text-align: center;
    font-size: 0.85rem;
  }

  .sand-btn:hover {
    background: var(--bg-main);
    box-shadow: 0 6px 16px rgba(160, 109, 68, 0.08);
    transform: translateY(-1px);
  }

  /* 移除 globals.css 中的 floating-card 物理 border，改用微妙柔和投影 */
  .floating-card {
    position: absolute;
    background: var(--bg-sub);
    border: none;
    border-radius: 14px;
    padding: 12px 18px;
    align-items: center;
    gap: 10px;
    box-shadow: 0 6px 20px rgba(160, 109, 68, 0.02);
    z-index: 2;
  }
  ```

- [ ] **步骤 2：运行基础测试集确认未影响原有底层渲染逻辑**
  运行：`npm run test tests/frontend-render.test.ts`
  预期：PASS

- [ ] **步骤 3：Commit 更改**
  运行：
  ```bash
  git add styles/globals.css
  git commit -m "style: define css variables for Warm Cream palette and refactor global buttons"
  ```

---

### 任务 2：首页背景及顶部导航栏去框、去 Emoji 重构 (index.tsx)

**文件：**
- 修改：`pages/index.tsx`
- 测试：`tests/auth-api.test.ts`

- [ ] **步骤 1：重构背景与导航栏元素**
  修改 `pages/index.tsx` 中的 `HomePage` 组件返回的根容器及其导航栏布局。
  - 将根容器的行内样式 `background: '#f8fafc'` 修改为 `background: 'var(--bg-main)'`。
  - 删除星云渐变图层。
  - 将顶部导航栏 header 的 `background: 'rgba(255, 255, 255, 0.75)'` 修改为 `background: 'var(--bg-sub)'`，去掉 `border: '1px solid rgba(15, 23, 42, 0.08)'`，修改为 `box-shadow: '0 10px 40px rgba(160, 109, 68, 0.02)'`。
  - 去除 `🌐`、`🕸️`、`👑`、`🚪` 等 Emoji。
  - 使用 1px SVG 图标更新导航栏元素：
    
    ```tsx
    // 替换 🌐
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--color-accent)" strokeWidth="1.1" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: '6px' }}>
      <circle cx="12" cy="12" r="10" />
      <line x1="2" y1="12" x2="22" y2="12" />
      <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
    </svg>
    
    // 替换 🕸️ 知识网图链接，应用 .sand-btn 类
    <Link href="/my-graph" className="sand-btn" style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '6px' }}>
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" strokeLinejoin="round">
        <path d="M4.5 16.5c-1.5 1.26-2.5 3.19-2.5 5.5h20c0-2.31-1-4.24-2.5-5.5" />
        <circle cx="12" cy="12" r="2" />
        <circle cx="12" cy="2" r="1" />
        <circle cx="4" cy="16" r="1" />
        <circle cx="20" cy="16" r="1" />
      </svg>
      个人知识拓扑网图
    </Link>
    ```

- [ ] **步骤 2：运行登录和认证接口单元测试确保无异常阻断**
  运行：`npm run test tests/auth-api.test.ts`
  预期：PASS

- [ ] **步骤 3：Commit 更改**
  运行：
  ```bash
  git add pages/index.tsx
  git commit -m "feat: refactor homepage background and top header with clean svg icons"
  ```

---

### 任务 3：重构 Hero 区和小提示标签 (index.tsx)

**文件：**
- 修改：`pages/index.tsx`
- 测试：`tests/frontend-render.test.ts`

- [ ] **步骤 1：重构 Hero 区的排版与浮动卡片**
  - 重构“全智能出海展业伴侣”小提示，去除 `✨` Emoji，改用极细轻淡的背景块装饰：
    ```tsx
    <span style={{
      background: 'rgba(160, 109, 68, 0.05)',
      padding: '4px 12px',
      borderRadius: '8px',
      color: 'var(--color-accent)',
      fontSize: '0.75rem',
      fontWeight: 300,
      letterSpacing: '1.5px',
      display: 'inline-block',
      marginBottom: '24px'
    }}>
      全智能出海展业伴侣
    </span>
    ```
  - 将大标题字重设为 `fontWeight: 300`，字色设为 `var(--color-text)`。
  - 重构 4 个悬浮浮动卡片（全球商机、结汇汇率、前沿报告、海关检索）：
    - 移除全部 emoji。
    - 换用细线条 1.1px 描边的 SVG（如放大镜、金币、折线图等）。
    - 移除实体 border 样式，圆角设为 `14px`。
  - 将首屏的“探索洞察报告库 ↓”大按钮转换为无框的 `.sand-btn` 主调颜色按钮：
    ```tsx
    <button onClick={scrollToInsights} className="sand-btn" style={{ padding: '14px 36px', fontSize: '0.95rem' }}>
      探索洞察报告库
    </button>
    ```

- [ ] **步骤 2：运行基础测试套件**
  运行：`npm run test tests/frontend-render.test.ts`
  预期：PASS

- [ ] **步骤 3：Commit 更改**
  运行：
  ```bash
  git add pages/index.tsx
  git commit -m "feat: redesign hero section typography, buttons and fine-line cards"
  ```

---

### 任务 4：重构报告大厅列表及过滤组件 (ReportList.tsx)

**文件：**
- 修改：`components/ReportList.tsx`
- 测试：`tests/report-filter.test.ts`

- [ ] **步骤 1：修改 ReportList.tsx 样式、去 border、去 emoji**
  - 重构顶部的筛选栏：将 `background: 'rgba(255, 255, 255, 0.45)'` 修改为 `background: 'var(--bg-sub)'`，去掉 `border: '1px solid rgba(15, 23, 42, 0.08)'`，设置 `borderRadius: 'var(--border-radius)'`。
  - 输入框和 Select 组件统一采用无物理 border、应用 `var(--bg-main)` 填充背景，圆角采用 12px，去掉 `🔍` emoji 并替换为 SVG 图标。
  - 重构报告卡片主体：
    - 移除卡片 `border: '1px solid rgba(15, 23, 42, 0.08)'`，换用微投影 `box-shadow: 0 4px 20px rgba(160, 109, 68, 0.015)`。
    - 将 `borderRadius` 设置为 `var(--border-radius)`。
    - 去除 `👥`、`📈` 等分类选项和卡片里的 Emoji。
    - 按钮/未解锁提示使用极细字重和圆角，并用 1px 细线 SVG 锁形表示未解锁状态。

- [ ] **步骤 2：运行报告过滤功能核心测试**
  运行：`npm run test tests/report-filter.test.ts`
  预期：PASS

- [ ] **步骤 3：Commit 更改**
  运行：
  ```bash
  git add components/ReportList.tsx
  git commit -m "feat: strip report list border line and emoji, styling cards with clean variables"
  ```

---

### 任务 5：同步修改知识拓扑页面并全站回归 (my-graph.tsx)

**文件：**
- 修改：`pages/my-graph.tsx`
- 测试：`tests/graph-styles.test.ts`

- [ ] **步骤 1：同步重构知识拓扑页面排版**
  - 修改 `pages/my-graph.tsx`：背景色变更为 `var(--bg-main)`，重构导航条与顶部提示去除 emoji 并应用极细字距与 1px 细线 SVG。
  - 运行：`npm run test tests/graph-styles.test.ts`
  - 预期：PASS

- [ ] **步骤 2：全站所有单元测试运行校验**
  运行：`npm run test`
  预期：所有 19 个测试套件均 100% 通过（PASS）

- [ ] **步骤 3：Commit 更改**
  运行：
  ```bash
  git add pages/my-graph.tsx
  git commit -m "feat: sync typography and background styling for topology network page"
  ```
