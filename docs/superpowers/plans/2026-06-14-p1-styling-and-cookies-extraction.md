# P1 内联样式与冗余代码提取 实现计划

> **面向 AI 代理的工作者：** 必需子技能：使用 superpowers:subagent-driven-development（推荐）或 superpowers:executing-plans 逐任务实现此计划。步骤使用复选框（`- [ ]`）语法来跟踪进度。

**目标：** 通过提取冗余代码（parseCookies）和全局样式（CSS）到统一模块，减少主页面与组件文件体积，并清理无用导入。

**架构：**
1. 提取公共模块 `lib/cookies.ts` 并导出 `parseCookies`，并在主页面中引入。
2. 引入 `pages/_app.tsx` 以及 `styles/globals.css`，将分散在各处的 `.water-drop-btn`、`@keyframes` 及其他全局样式提取至 `globals.css`。
3. 清除 `pages/index.tsx`、`pages/my-graph.tsx` 和 `pages/reports/[id].tsx` 顶部的 `import { Client } from 'pg'`。

**技术栈：** Next.js (React), TypeScript, CSS, Vitest

---

### 任务 1：提取 parseCookies 至 lib/cookies.ts 并应用

**文件：**
- 创建：`lib/cookies.ts`
- 修改：`pages/index.tsx`
- 修改：`pages/my-graph.tsx`
- 修改：`pages/reports/[id].tsx`

- [ ] **步骤 1：创建 lib/cookies.ts 并导出 parseCookies**
  内容见：`lib/cookies.ts`

- [ ] **步骤 2：在 pages/index.tsx 中引入并使用 lib/cookies.ts 的 parseCookies**
  删除原有 local 的 `parseCookies`。

- [ ] **步骤 3：在 pages/my-graph.tsx 中引入并使用 lib/cookies.ts 的 parseCookies**
  删除原有 local 的 `parseCookies`。

- [ ] **步骤 4：在 pages/reports/[id].tsx 中引入并使用 lib/cookies.ts 的 parseCookies**
  删除原有 local 的 `parseCookies`。

---

### 任务 2：创建 styles/globals.css 并提取全局 CSS

**文件：**
- 创建：`styles/globals.css`

- [ ] **步骤 1：创建 styles/globals.css 并写入提取的样式**
  包含：`.water-drop-btn`、`@keyframes spin`、`.floating-planet`、`@keyframes float`、`@keyframes float1/2/3/4`、`.floating-card`、`.floating-card-1/2/3/4`、`.animate-on-scroll`、`.animate-on-scroll.in-view` 等样式。

---

### 任务 3：创建 pages/_app.tsx 加载全局 CSS

**文件：**
- 创建：`pages/_app.tsx`

- [ ] **步骤 1：创建 pages/_app.tsx 并导入 globals.css**

---

### 任务 4：清理页面和组件中的冗余 style jsx 块及 spin style

**文件：**
- 修改：`pages/index.tsx`
- 修改：`pages/my-graph.tsx`
- 修改：`pages/reports/[id].tsx`
- 修改：`components/ToolsPanel.tsx`

- [ ] **步骤 1：清理 pages/index.tsx 中的 <style jsx global>**
  删除原有的全局动画和水滴按钮样式。

- [ ] **步骤 2：清理 pages/my-graph.tsx 中的两处 <style jsx global>**
  删除原有的两处全局样式定义。

- [ ] **步骤 3：清理 pages/reports/[id].tsx 中的 <style jsx global>**
  删除原有的全局样式定义。

- [ ] **步骤 4：清理 components/ToolsPanel.tsx 中的 <style jsx> 及 @keyframes spin style**
  删除原有的 style jsx，以及内联 style 中的 `@keyframes spin` 定义。

---

### 任务 5：清理未使用的 pg.Client 导入

**文件：**
- 修改：`pages/index.tsx`
- 修改：`pages/my-graph.tsx`
- 修改：`pages/reports/[id].tsx`

- [ ] **步骤 1：从 pages/index.tsx 顶部删除 import { Client } from 'pg'**
- [ ] **步骤 2：从 pages/my-graph.tsx 顶部删除 import { Client } from 'pg'**
- [ ] **步骤 3：从 pages/reports/[id].tsx 顶部删除 import { Client } from 'pg'**

---

### 任务 6：运行测试、编译并提交

- [ ] **步骤 1：运行 npm run test 验证测试通过**
- [ ] **步骤 2：运行 npm run build 验证构建成功**
- [ ] **步骤 3：提交所有修改，commit 消息为 "refactor: extract styles and helper to globals (tasks P1.1-P1.6)"**
