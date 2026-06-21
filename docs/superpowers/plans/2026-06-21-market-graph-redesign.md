# 市场图谱纯前端演示及交互重构 实现计划 (新增 4 点真实 App 优化)

> **面向 AI 代理的工作者：** 必需子技能：使用 superpowers:subagent-driven-development（推荐）或 superpowers:executing-plans 逐任务实现此计划。步骤使用复选框（`- [ ]`）语法来跟踪进度。

**目标：** 根据最新反馈，将样式对调、默认参数设置、Legend 精简和右侧研报画像面板 Scheme B 极简重构应用到真实的 App 组件和页面中。

**技术栈：** Next.js, React, Vitest, force-graph (HTML5 Canvas)

---

### 任务 4：重构 `lib/graph-styles.ts` (线条样式对调与测试更新)

**文件：**
- 修改：`lib/graph-styles.ts`
- 测试：`tests/graph-styles.test.ts`

- [ ] **步骤 1：对调竞争关系 (competitor) 与供销关系 (supplier) 的线宽、虚线与粒子逻辑**
  修改 `lib/graph-styles.ts`，使得：
  1. `competitor` (竞争) ── 继承供销样式：基础宽度变为 `2.2`，虚线模式为 `null` (实线)。
  2. `supplier` (供销/经销) ── 继承竞争样式：基础宽度变为 `3.5`，虚线模式为 `[2, 2]` (最粗虚线)。
  3. 修改 `getLinkParticles` 映射：
     - `competitor` 拥有 2 个流动粒子。
     - `supplier` 拥有 0 个流动粒子。

- [ ] **步骤 2：更新 `tests/graph-styles.test.ts` 中的断言**
  修改测试用例，使线宽、Dash 划线和粒子测试匹配对调后的属性：
  ```typescript
  expect(getLinkWidth('supplier')).toBe(3.5);
  expect(getLinkWidth('competitor')).toBe(2.2);
  expect(getLinkLineDash('supplier')).toEqual([2, 2]);
  expect(getLinkLineDash('competitor')).toBeNull();
  expect(getLinkParticles('competitor')).toBe(2);
  expect(getLinkParticles('supplier')).toBe(0);
  ```

- [ ] **步骤 3：运行测试并 Commit**
  运行 `npx vitest run tests/graph-styles.test.ts` 确保通过。
  提交代码：`git commit -am "feat: swap competitor and supplier connection visual styles"`

---

### 任务 5：重构 `components/ObsidianGraph.tsx` (精简 Legend 与粒子映射)

**文件：**
- 修改：`components/ObsidianGraph.tsx`

- [ ] **步骤 1：去除 Legend 中的 Checkbox 复选框并精简文字**
  1. 移除左下角“图谱关系”卡片中每一个关系对应的 `<input type="checkbox">`。
  2. 去掉文字标签中括号 `()` 及其内部的注释（只保留“竞争关系”、“供销关系”、“经营关系”、“涉及关系”纯文本标签）。
  3. 将 Legend 外围 `div` 的 `pointerEvents` 设回 `none`（仅作为高雅的图例浮层）。
  
- [ ] **步骤 2：对调粒子流动绑定关系**
  在 `linkDirectionalParticles` 配置中：
  - 将 `supplier` 触发粒子改为 `competitor` 触发。
  ```typescript
  .linkDirectionalParticles(l => (speedScale && speedScale > 0 && l.relation_type === 'competitor') ? 2 : 0)
  ```

- [ ] **步骤 3：运行测试并 Commit**
  运行 TypeScript 类型自检，并提交修改。

---

### 任务 6：重构 `pages/my-graph.tsx` (默认配置参数注入)

**文件：**
- 修改：`pages/my-graph.tsx`

- [ ] **步骤 1：修改 React 状态默认初始值**
  将 `my-graph.tsx` 中的状态默认值更新为：
  - `nodeSizeScale` 默认值：`0.5`
  - `lineWidthScale` 默认值：`1.9`
  - `speedScale` 默认值：`1.8`
  - `customColors.operation` 默认值：`#c8c3fb` (对应 `rgb(200, 195, 251)`)

- [ ] **步骤 2：Commit 改动**

---

### 任务 7：重构 `components/NodeProfilePanel.tsx` (画像板块 Scheme B 极简风格重构)

**文件：**
- 修改：`components/NodeProfilePanel.tsx`

- [ ] **步骤 1：重构包裹卡片外框样式**
  将报告详情外框（第 408 行分支处）由原来的半透明白底、粗边框重构为无实体框、微弱投影的极简暖乳白底卡片：
  ```typescript
  background: 'var(--bg-sub)', // 替换原来的 rgba(255, 255, 255, 0.65) 为微黄卡片底色
  borderRadius: '22px',       // 统一圆角为 22px
  border: 'none',             // 去掉 1px 实体边框线
  boxShadow: '0 6px 20px rgba(160, 109, 68, 0.015)' // 极淡轻影
  ```

- [ ] **步骤 2：去物理边框与统一 badges/tags 浅底色**
  重构报告详情中：国家/市场、经营品牌（`companies`）、涉及品类（`products`）、覆盖渠道（`channels`）的所有 badges：
  - 移去物理边框：`border: 'none'`
  - 去除鲜艳刺眼的背景，统一改用素雅亮底背景：`background: 'var(--bg-main)'`
  - 文字颜色统一使用 `#7a756f` (次要文字烟灰)

- [ ] **步骤 3：优化输入框与按钮视觉规范**
  - 重构 3 个关联表单输入框，去除生硬边框，增加轻影和微圆角。
  - 重构底部的“阅读报告详情”链接样式，使其符合 Scheme B 优雅扁平字重，圆角为 `20px`。

- [ ] **步骤 4：运行全面测试并 Commit**
  提交最终画像改动并验证。
