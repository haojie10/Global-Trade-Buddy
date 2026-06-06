# Globaltradebuddy (外贸智友) 实现计划

> **面向 AI 代理的工作者：** 必需子技能：使用 superpowers:subagent-driven-development（推荐）或 superpowers:executing-plans 逐任务实现此计划。步骤使用复选框（`- [ ]`）语法来跟踪进度。

**目标：** 构建一个专为中国外贸业务员服务的资讯平台，包含 360 度客户洞察与品类分析、个性化 Obsidian 知识图谱、外贸工具箱、个人笔记、收藏夹及裂变邀请功能，采用本地部署开源 Supabase 数据库。

**架构：** 前端使用 Next.js (React) SSR 保障 SEO，图谱采用 Force-Graph (D3-force) 渲染用户解锁报告的子网关系，后端使用 Next.js API Routes 进行图片脱水、付费额度控制和安全水印拦截，图片存放在腾讯云/阿里云对象存储。

**技术栈：** Next.js (React), Tailwind CSS / Vanilla CSS, Force-Graph, PostgreSQL, Docker (部署开源 Supabase), Vitest (测试工具)。

---

### 任务 1：项目初始化与开发环境搭建

**文件：**
*   创建：`package.json`
*   创建：`tsconfig.json`
*   创建：`vitest.config.ts`
*   创建：`docker-compose.yml` (Supabase 本地部署配置)
*   测试：`tests/init.test.ts`

- [ ] **步骤 1：编写环境初始化测试**
    创建 `tests/init.test.ts`：
    ```typescript
    import { describe, it, expect } from 'vitest';
    describe('Environment Init Test', () => {
      it('should basic healthcheck pass', () => {
        expect(1 + 1).toBe(2);
      });
    });
    ```

- [ ] **步骤 2：配置项目依赖与初始化**
    创建 `package.json`：
    ```json
    {
      "name": "globaltradebuddy",
      "version": "1.0.0",
      "scripts": {
        "dev": "next dev",
        "build": "next build",
        "start": "next start",
        "test": "vitest run"
      },
      "dependencies": {
        "next": "^14.0.0",
        "react": "^18.2.0",
        "react-dom": "^18.2.0",
        "force-graph": "^1.43.0",
        "@supabase/supabase-js": "^2.39.0"
      },
      "devDependencies": {
        "typescript": "^5.0.0",
        "vitest": "^1.0.0",
        "@types/react": "^18.2.0"
      }
    }
    ```
    创建 `tsconfig.json` 并运行测试验证环境是否正常：
    运行：`npm install && npm run test`
    预期：PASS，看到测试结果通过。

- [ ] **步骤 3：配置本地 Supabase Docker-Compose**
    创建本地部署 Supabase 的 `docker-compose.yml` 配置文件（由于本地 Supabase 官方提供一键 docker 模板，直接在此放置最简 PostgreSQL + Auth 容器）。
    运行：`docker-compose up -d`
    预期：Supabase 容器群正常在后台启动，可以通过 `http://localhost:8000` 访问。

- [ ] **步骤 4：Commit**
    ```bash
    git add package.json tsconfig.json docker-compose.yml tests/init.test.ts
    git commit -m "chore: 初始化 Next.js 项目与 Docker Supabase 开发环境"
    ```

---

### 任务 2：初始化 PostgreSQL 数据库结构与种子数据

**文件：**
*   创建：`supabase/migrations/20260606000000_init_schema.sql`
*   测试：`tests/db-schema.test.ts`

- [ ] **步骤 1：编写数据库表结构测试**
    创建 `tests/db-schema.test.ts`，测试连接本地 Postgres 并验证我们定义的 6 张核心表（`users`, `reports`, `unlocks`, `relations`, `notes`, `favorites`）是否存在。
    ```typescript
    import { describe, it, expect } from 'vitest';
    import { createClient } from '@supabase/supabase-js';
    
    const supabase = createClient('http://localhost:8000', 'mock-anon-key'); // 替换为本地密钥
    describe('Database Schema Test', () => {
      it('should have required tables', async () => {
        const { data: tables, error } = await supabase.rpc('get_tables_list'); // 自定义测试函数
        expect(error).toBeNull();
        expect(tables).toContain('reports');
        expect(tables).toContain('unlocks');
        expect(tables).toContain('relations');
      });
    });
    ```

- [ ] **步骤 2：编写 SQL 迁移脚本**
    创建 `supabase/migrations/20260606000000_init_schema.sql`，写入我们在设计中定义的表结构、外键关联、唯一约束，并添加获取表的辅助 RPC 函数用于测试。
    运行：运行 Supabase 迁移：`npx supabase db push`（或通过 psql 导入本地实例）。
    运行：`npm run test tests/db-schema.test.ts`
    预期：PASS。

- [ ] **步骤 3：Commit**
    ```bash
    git add supabase/migrations/20260606000000_init_schema.sql tests/db-schema.test.ts
    git commit -m "db: 迁移核心 PostgreSQL 表结构并验证通过"
    ```

---

### 任务 3：开发报告上传“脱水”处理 API

**文件：**
*   创建：`pages/api/admin/reports/upload.ts` (核心 API 接口)
*   创建：`bin/upload-report.js` (本地运行的命令行转码和上传脚本)
*   测试：`tests/upload-pipeline.test.ts`

- [ ] **步骤 1：编写上传及脱水管道测试**
    创建 `tests/upload-pipeline.test.ts`，模拟发送一个大 HTML 字符串（含有 Base64 编码的图片和 UTF-16LE 编码的字符），测试接口是否成功将图片剥离，并将图片转存（Mock 云存储）返回 CDN URL。
    ```typescript
    import { describe, it, expect } from 'vitest';
    import { runDehydration } from '../../../pages/api/admin/reports/upload';

    describe('Report Dehydration Test', () => {
      it('should extract base64 images and shrink html size', async () => {
        const rawHtml = `<html><body><img src="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAUAAAAFCAYAAACNbyblAAAAHElEQVQI12P4//8/w38GIAXDIBKE0DHxgljNBAAO9TXL0Y4OHwAAAABJRU5ErkJggg==" /></body></html>`;
        const { cleanHtml, extractedImages } = await runDehydration(rawHtml);
        expect(cleanHtml).not.toContain('data:image/png;base64');
        expect(cleanHtml).toContain('http://mock-cdn.com/images/');
        expect(extractedImages.length).toBe(1);
      });
    });
    ```

- [ ] **步骤 2：实现转码与 Base64 脱水提取逻辑**
    在 `pages/api/admin/reports/upload.ts` 中实现：
    1. 接收文件，利用正则 `/src="data:image\/([a-zA-Z]*);base64,([^"]*)"/g` 匹配所有 Base64 图片。
    2. 将 Base64 解码为 Buffer，上传至 COS/OSS，生成 CDN 链接替换原 HTML。
    3. 分析标题提取关键词建立 `relations` 表。
    在 `bin/upload-report.js` 中编写本地命令行工具，使用 `fs.readFileSync(path, 'utf16le')` 读取文件，自动转码为 `utf-8` 并调用 API。
    运行：`npm run test tests/upload-pipeline.test.ts`
    预期：PASS。

- [ ] **步骤 3：Commit**
    ```bash
    git add pages/api/admin/reports/upload.ts bin/upload-report.js tests/upload-pipeline.test.ts
    git commit -m "feat: 实现报告上传转码及图片动态脱水 API"
    ```

---

### 任务 4：开发 Obsidian 图谱与安全拦截 API

**文件：**
*   创建：`pages/api/user/graph.ts` (获取图谱节点 API)
*   创建：`pages/api/user/report-detail.ts` (已解锁报告安全读取 API)
*   测试：`tests/security-api.test.ts`

- [ ] **步骤 1：编写安全读取与图谱过滤测试**
    测试当未解锁用户访问报告详情 API 时，应只返回 summary，content_html 为空；只有已解锁用户能获取 content_html。同时，图谱 API 返回的 relations 必须仅为该用户已解锁节点的关联网。
    ```typescript
    import { describe, it, expect } from 'vitest';
    // 编写模拟调用安全 API 逻辑
    ```

- [ ] **步骤 2：实现过滤逻辑与关联子网提取**
    在 `pages/api/user/graph.ts` 中：
    1. 鉴权获取 `user_id`。
    2. 查询 `unlocks` 获取已解锁列表。
    3. 在 `relations` 中查找 `report_id_a` 和 `report_id_b` 均在已解锁列表中的记录并返回。
    在 `pages/api/user/report-detail.ts` 中实现权限校验与截断。
    运行：`npm run test tests/security-api.test.ts`
    预期：PASS。

- [ ] **步骤 3：Commit**
    ```bash
    git add pages/api/user/graph.ts pages/api/user/report-detail.ts tests/security-api.test.ts
    git commit -m "feat: 实现 Obsidian 关联子网提取与详情页后端安全隔离"
    ```

---

### 任务 5：开发前端网状知识图谱与动态水印报告页

**文件：**
*   创建：`components/ObsidianGraph.tsx` (图谱组件)
*   创建：`components/WatermarkContainer.tsx` (动态防盗水印组件)
*   创建：`pages/reports/[id].tsx` (报告详情页)
*   测试：`tests/frontend-render.test.tsx`

- [ ] **步骤 1：编写前端渲染与水印测试**
    编写测试确认在页面加载时，Canvas 水印已被成功挂载在 DOM 树中，且报告卡片能正确渲染底层推荐卡片。
    ```typescript
    // 测试前端 DOM 结构
    ```

- [ ] **步骤 2：实现前端图谱与水印详情页**
    *   在 `components/ObsidianGraph.tsx` 中引入 `Force-Graph` 渲染获取的 nodes 和 links。
    *   在 `components/WatermarkContainer.tsx` 中使用 Canvas 循环绘制倾斜 30 度的文字水印（手机号 + 时间）。
    *   在 `pages/reports/[id].tsx` 中布局：上方报告富文本，下方循环渲染强关联的其他报告卡片。
    运行：`npm run test tests/frontend-render.test.tsx`
    预期：PASS。

- [ ] **步骤 3：Commit**
    ```bash
    git add components/ObsidianGraph.tsx components/WatermarkContainer.tsx pages/reports/[id].tsx
    git commit -m "feat: 开发前端 Obsidian 图谱渲染与报告动态防盗水印详情页"
    ```

---

### 任务 6：集成汇率、HS Code、时区看板与 Mock AI 抠图工具

**文件：**
*   创建：`components/ToolsPanel.tsx` (工具箱面板)
*   创建：`pages/api/tools/currency.ts` (汇率 API)
*   创建：`pages/api/tools/image-beautify.ts` (Mock AI 商品图美化接口)
*   测试：`tests/tools.test.ts`

- [ ] **步骤 1：编写工具 API 测试**
    测试汇率换算逻辑，HS Code 查询接口，以及 AI 抠图接口上传照片后是否返回了抠图后的图片链接。
    ```typescript
    // 测试接口响应
    ```

- [ ] **步骤 2：实现小工具集成**
    *   在 `pages/api/tools/image-beautify.ts` 中，模拟调用抠图接口，返回处理过的 CDN 图片并叠加展厅效果。
    *   在 `components/ToolsPanel.tsx` 整合汇率换算卡片、HS Code 查询输入框和时区看板。
    运行：`npm run test tests/tools.test.ts`
    预期：PASS。

- [ ] **步骤 3：Commit**
    ```bash
    git add components/ToolsPanel.tsx pages/api/tools/currency.ts pages/api/tools/image-beautify.ts tests/tools.test.ts
    git commit -m "feat: 集成汇率、时区、HS Code 工具及 AI 商品图美化原型"
    ```

---

### 任务 7：开发拓展功能（个人笔记、收藏夹与多级邀请裂变）

**文件：**
*   创建：`pages/api/user/note.ts` (笔记读写 API)
*   创建：`pages/api/user/favorite.ts` (收藏 API)
*   创建：`pages/api/user/invite.ts` (邀请码及额度兑换 API)
*   测试：`tests/extensions.test.ts`

- [ ] **步骤 1：编写拓展功能测试**
    测试写入笔记是否成功并能再次读取；测试用户使用正确的邀请码注册时，被邀请人与邀请人是否各自增加了额度。
    ```typescript
    // 编写笔记、收藏和邀请码兑换额度的逻辑测试
    ```

- [ ] **步骤 2：实现拓展模块**
    在相应 API 中编写对 `notes`, `favorites` 表的 CRUD 操作，并编写处理邀请关系绑定、触发 `users.free_quota` 加额度的事务逻辑。
    运行：`npm run test tests/extensions.test.ts`
    预期：PASS。

- [ ] **步骤 3：Commit**
    ```bash
    git add pages/api/user/note.ts pages/api/user/favorite.ts pages/api/user/invite.ts tests/extensions.test.ts
    git commit -m "feat: 实现个人笔记挂载、收藏夹及多级邀请额度裂变功能"
    ```
