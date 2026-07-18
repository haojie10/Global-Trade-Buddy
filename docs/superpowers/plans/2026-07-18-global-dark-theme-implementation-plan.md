# 全局暗色主题 (Dark Mode) 与切换开关实现计划

> **面向 AI 代理的工作者：** 必需子技能：使用 superpowers:subagent-driven-development（推荐）或 superpowers:executing-plans 逐任务实现此计划。步骤使用复选框（`- [ ]`）语法来跟踪进度。

**目标：** 在项目全局实现暗色渐变主题切换（包含 CSS 变量切换与 LocalStorage 状态同步），并在 `Navbar.tsx` 中增加切换开关，实现首页、图谱页等页面一键适配类似 Demo 页面风格的深色质感。

**架构：** 在 `globals.css` 中定义基于 `body.dark-theme` 的颜色和布局变量覆盖。重构 `Navbar.tsx`，支持加载和保存 `gtb_theme`，动态控制 `.dark-theme` 的挂载，并将主要的卡片与内容区域的硬编码颜色更改为对应的 CSS 变量引用。

**技术栈：** Next.js, React, LocalStorage, CSS Variables.

---

### 任务 1：定义全局暗色主题样式变量

**文件：**
- 修改：`styles/globals.css`

- [ ] **步骤 1：重构 `:root` 与 `body.dark-theme` 的变量映射**
  在 `styles/globals.css` 中声明卡片、输入框、导航栏的变量，并加入切换平滑过渡效果：
  
  ```css
  /* 修改 body 选择器 */
  body {
    overflow-x: hidden;
    background: 
      linear-gradient(90deg, rgba(18, 18, 18, 0.02) 1px, transparent 1px),
      linear-gradient(135deg, #f5f5f7 0%, #f0f0f2 100%) !important;
    background-size: 100px 100%, cover;
    background-attachment: fixed;
    font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
    color: var(--color-text);
    transition: background 0.3s ease, color 0.3s ease;
  }
  
  /* 注入亮色默认变量 */
  :root {
    --bg-main: #f6f6f6;
    --bg-sub: #eaeaea;
    --color-accent: #ff641e;
    --color-text: #121212;
    --color-muted: #666666;
    
    --card-bg: rgba(255, 255, 255, 0.45);
    --card-border: rgba(18, 18, 18, 0.05);
    --navbar-bg: rgba(255, 255, 255, 0.45);
    --dropdown-bg: rgba(255, 255, 255, 0.95);
    --input-bg: rgba(255, 255, 255, 0.65);
  }
  
  /* 注入深色渐变变量（对应 Demo 调性） */
  body.dark-theme {
    background: 
      linear-gradient(90deg, rgba(255, 255, 255, 0.01) 1px, transparent 1px),
      radial-gradient(circle at center, #1a1919 0%, #090808 100%) !important;
    background-size: 100px 100%, cover;
    color: #ffffff;
    
    --bg-main: #0c0b0b;
    --bg-sub: #161515;
    --color-text: #ffffff;
    --color-muted: #a0a0a0;
    
    --card-bg: rgba(255, 255, 255, 0.05);
    --card-border: rgba(255, 255, 255, 0.08);
    --navbar-bg: rgba(9, 8, 8, 0.7);
    --dropdown-bg: rgba(26, 25, 25, 0.95);
    --input-bg: rgba(255, 255, 255, 0.08);
  }
  ```

- [ ] **步骤 2：对全局 report-card 补充暗色适配**
  在 `styles/globals.css` 结尾处追加暗色卡片的样式覆盖：
  ```css
  body.dark-theme .report-card {
    background: var(--card-bg) !important;
    border-color: var(--card-border) !important;
  }
  ```

---

### 任务 2：重构 `Navbar.tsx` 并添加主题切换按钮

**文件：**
- 修改：`components/Navbar.tsx`

- [ ] **步骤 1：引入主题 Hooks 与本地持久化逻辑**
  在 `Navbar` 组件顶部加入以下状态和副作用逻辑：
  
  ```tsx
  const [theme, setTheme] = useState<'light' | 'dark'>('light');
  
  useEffect(() => {
    const savedTheme = localStorage.getItem('gtb_theme') as 'light' | 'dark' || 'light';
    setTheme(savedTheme);
    if (savedTheme === 'dark') {
      document.body.classList.add('dark-theme');
    } else {
      document.body.classList.remove('dark-theme');
    }
  }, []);
  
  const toggleTheme = () => {
    const nextTheme = theme === 'light' ? 'dark' : 'light';
    setTheme(nextTheme);
    localStorage.setItem('gtb_theme', nextTheme);
    if (nextTheme === 'dark') {
      document.body.classList.add('dark-theme');
    } else {
      document.body.classList.remove('dark-theme');
    }
  };
  ```

- [ ] **步骤 2：替换硬编码背景颜色与添加切换按钮**
  1. 将 Navbar 的外层 `background` 替换为 `var(--navbar-bg)`，`borderBottom` 替换为 `var(--card-border)`。
  2. 将下拉菜单的 `background` 替换为 `var(--dropdown-bg)`，`border` 替换为 `var(--card-border)`。
  3. 在 Navbar 右侧登录菜单前插入切换开关按钮：
  
  ```tsx
  <button
    onClick={toggleTheme}
    style={{
      background: 'transparent',
      border: 'none',
      cursor: 'pointer',
      fontSize: '1.2rem',
      padding: '8px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      color: 'var(--color-text)',
      transition: 'transform 0.2s'
    }}
    title="切换主题"
  >
    {theme === 'light' ? '🌙' : '☀️'}
  </button>
  ```

---

### 任务 3：替换主页与图谱页的硬编码颜色属性

**文件：**
- 修改：`pages/index.tsx`
- 修改：`pages/my-graph.tsx`

- [ ] **步骤 1：重构 `pages/index.tsx` 中的卡片背景**
  将 `pages/index.tsx` 中的所有 `rgba(255, 255, 255, 0.45)` 及相关的硬编码边框色属性，统一替换为引用：
  - 卡片背景：`var(--card-bg)`
  - 卡片边框：`var(--card-border)`
  - 输入框背景：`var(--input-bg)`
  - 邮箱注册容器背景：`var(--card-bg)`

- [ ] **步骤 2：重构 `pages/my-graph.tsx` 中的面板背景**
  将 `pages/my-graph.tsx` 中筛选框和右侧画像面板的硬编码颜色属性替换为引用：
  - 筛选框背景：`var(--card-bg)`，边框：`var(--card-border)`
  - 下拉选择项背景：`var(--input-bg)`
  - 右侧画像挂载面板背景：`var(--card-bg)`

---

### 任务 4：执行编译与构建验证

- [ ] **步骤 1：本地 TypeScript 类型检查**
  运行：`npx tsc --noEmit` (使用 BypassSandbox = true)
  
- [ ] **步骤 2：本地 Next.js 生产环境打包测试**
  运行：`npm run build` (使用 BypassSandbox = true)
