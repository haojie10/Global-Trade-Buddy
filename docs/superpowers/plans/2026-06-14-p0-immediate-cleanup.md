# P0 立即清理 实现计划

> **面向 AI 代理的工作者：** 必需子技能：使用 superpowers:subagent-driven-development（推荐）或 superpowers:executing-plans 逐任务实现此计划。步骤使用复选框（`- [ ]`）语法来跟踪进度。

**目标：** 清理项目中的垃圾临时文件并更新 .gitignore，确保代码库整洁。

**架构：** 删除无用文件并添加对应的忽略规则。具体包括：删除根目录的 scratch_check.js、tsconfig.tsbuildinfo、tests/init.test.ts，以及全工作区内的 .DS_Store。更新 .gitignore 文件以过滤 `Template/*.html` 和确保过滤 .DS_Store。

**技术栈：** Shell, Git, Vitest

---

### 任务 1：删除垃圾文件 scratch_check.js

**文件：**
- 删除：`scratch_check.js`

- [ ] **步骤 1：删除 scratch_check.js**
  运行：`rm scratch_check.js`
  预期：文件被删除。

---

### 任务 2：删除 tsconfig.tsbuildinfo 并修改 .gitignore 忽略它

**文件：**
- 删除：`tsconfig.tsbuildinfo`
- 修改：`.gitignore`

- [ ] **步骤 1：删除 tsconfig.tsbuildinfo**
  运行：`rm tsconfig.tsbuildinfo`
  预期：文件被删除。

- [ ] **步骤 2：检查并确保 .gitignore 中存在 *.tsbuildinfo**
  修改：`.gitignore`，确认包含 `*.tsbuildinfo`。

---

### 任务 3：修改 .gitignore 忽略 Template/*.html

**文件：**
- 修改：`.gitignore`

- [ ] **步骤 1：在 .gitignore 中添加 Template/*.html**
  修改：`.gitignore`
  在适当位置（如 # production 或 # misc 下）增加 `Template/*.html`。

---

### 任务 4：删除空壳测试文件 tests/init.test.ts

**文件：**
- 删除：`tests/init.test.ts`

- [ ] **步骤 1：删除 tests/init.test.ts**
  运行：`rm tests/init.test.ts`
  预期：文件被删除。

---

### 任务 5：清除工作区中的 .DS_Store 并在 .gitignore 中确保忽略了 .DS_Store

**文件：**
- 删除：所有 `.DS_Store` 文件
- 修改：`.gitignore`

- [ ] **步骤 1：删除整个工作区所有的 .DS_Store**
  运行：`find . -name ".DS_Store" -depth -exec rm {} \;`
  预期：所有 .DS_Store 均被删除。

- [ ] **步骤 2：检查并确认 .gitignore 中包含 .DS_Store**
  修改：`.gitignore` 确认包含 `.DS_Store`。

---

### 任务 6：运行测试并提交

- [ ] **步骤 1：运行 npm run test 验证测试依然全部通过**
  运行：`npm run test`
  预期：16 passed。

- [ ] **步骤 2：提交变更，commit 消息为 "refactor: P0 immediate cleanup (tasks P0.1-P0.5)"**
  运行：`git add .gitignore tests/init.test.ts` (其实被删除的文件会被 git 识别为 deleted，所以 `git add -A` 或 `git add .` 合适，但要注意不要 add 不该 add 的文件。当前 git status 是 clean 的，所以直接运行 `git add .` 是安全的)
  运行：`git commit -m "refactor: P0 immediate cleanup (tasks P0.1-P0.5)"`
