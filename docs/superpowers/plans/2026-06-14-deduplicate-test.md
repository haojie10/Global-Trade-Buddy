# 测试层去重实现计划

> **面向 AI 代理的工作者：** 必需子技能：使用 superpowers:subagent-driven-development（推荐）或 superpowers:executing-plans 逐任务实现此计划。步骤使用复选框（`- [ ]`）语法来跟踪进度。

**目标：** 消除测试层（`tests/` 目录）中的大量重复代码，特别是数据库清理逻辑、`mockReqRes` 模拟对象生成器和测试数据工厂方法。

**架构：** 在 `tests/helpers/db-test-helper.ts` 中集中定义并导出 `cleanDatabase`, `mockReqRes` 以及快速测试数据工厂 `createTestUser`, `createTestReport` 等，再批量修改 9 个测试文件以引用这些公共函数。

**技术栈：** Vitest, Node.js, TypeScript, PostgreSQL

---

### 任务 1：重构 `tests/helpers/db-test-helper.ts`

**文件：**
- 修改：[tests/helpers/db-test-helper.ts](file:///Users/jason/Documents/Antigravity/Project/Globaltradebuddy/tests/helpers/db-test-helper.ts)

- [ ] **步骤 1：在 tests/helpers/db-test-helper.ts 中编写并导出 cleanDatabase, mockReqRes 还有测试数据创建工厂函数。**
  我们将新增以下内容：
  ```typescript
  import { Client } from 'pg';
  import { crypto } from 'crypto'; // 或者直接使用 gen_random_uuid

  export function createTestClient(): Client {
    return new Client({
      connectionString: process.env.TEST_DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/postgres',
    });
  }

  export async function cleanDatabase(client: any) {
    await client.query('DELETE FROM notes');
    await client.query('DELETE FROM favorites');
    await client.query('DELETE FROM unlocks');
    await client.query('DELETE FROM relations');
    await client.query('DELETE FROM report_entities');
    await client.query('DELETE FROM entity_aliases');
    await client.query('DELETE FROM entity_relations');
    await client.query('DELETE FROM entities');
    await client.query('DELETE FROM reports');
    await client.query('DELETE FROM users');
  }

  export function mockReqRes(options: {
    method?: string;
    body?: any;
    query?: any;
    headers?: any;
    cookies?: any;
    session?: { userId: string; role: string };
  } = {}) {
    const req = {
      method: options.method || 'POST',
      body: options.body || {},
      query: options.query || {},
      headers: options.headers || {},
      cookies: options.cookies || {},
    } as any;

    if (options.session) {
      req.cookies.gtb_session = Buffer.from(JSON.stringify(options.session)).toString('base64');
    }

    let statusVal = 200;
    let jsonVal: any = null;
    const res = {
      status(code: number) {
        statusVal = code;
        return this;
      },
      json(data: any) {
        jsonVal = data;
        return this;
      },
      setHeader() {
        return this;
      }
    } as any;

    return { req, res, getStatus: () => statusVal, getJson: () => jsonVal };
  }

  export async function createTestUser(
    client: any,
    options: {
      id?: string;
      phoneNumber: string;
      email?: string;
      role?: string;
      freeQuota?: number;
      password?: string;
    }
  ) {
    const id = options.id || crypto.randomUUID();
    const email = options.email || null;
    const role = options.role || 'user';
    const freeQuota = options.freeQuota !== undefined ? options.freeQuota : 3;
    const phone = options.phoneNumber;
    const password = options.password || null;

    const query = `
      INSERT INTO users (id, phone_number, email, role, free_quota, password)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING id, phone_number, email, role, free_quota
    `;
    const res = await client.query(query, [id, phone, email, role, freeQuota, password]);
    return res.rows[0];
  }

  export async function createTestReport(
    client: any,
    options: {
      id?: string;
      title: string;
      category?: string;
      marketRegion?: string;
      summary?: string;
      contentHtml?: string;
    }
  ) {
    const id = options.id || crypto.randomUUID();
    const title = options.title;
    const category = options.category || 'product';
    const marketRegion = options.marketRegion || null;
    const summary = options.summary || null;
    const contentHtml = options.contentHtml || null;

    const query = `
      INSERT INTO reports (id, title, category, market_region, summary, content_html)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING id, title, category, market_region, summary, content_html
    `;
    const res = await client.query(query, [id, title, category, marketRegion, summary, contentHtml]);
    return res.rows[0];
  }
  ```

- [ ] **步骤 2：Commit**
  ```bash
  git add tests/helpers/db-test-helper.ts
  git commit -m "refactor: add cleanDatabase, mockReqRes and factory functions to db-test-helper"
  ```

### 任务 2：重构 `tests/auth-api.test.ts`

**文件：**
- 修改：[tests/auth-api.test.ts](file:///Users/jason/Documents/Antigravity/Project/Globaltradebuddy/tests/auth-api.test.ts)

- [ ] **步骤 1：导入 `cleanDatabase` 和 `mockReqRes`，移除本文件局部的 `mockReqRes` 并且在 `beforeEach` 中使用 `cleanDatabase(dbClient)`。**
- [ ] **步骤 2：运行 `vitest run tests/auth-api.test.ts` 验证通过。**
- [ ] **步骤 3：Commit**
  ```bash
  git add tests/auth-api.test.ts
  git commit -m "refactor: use cleanDatabase and mockReqRes in auth-api.test.ts"
  ```

### 任务 3：重构 `tests/extensions.test.ts`

**文件：**
- 修改：[tests/extensions.test.ts](file:///Users/jason/Documents/Antigravity/Project/Globaltradebuddy/tests/extensions.test.ts)

- [ ] **步骤 1：导入 `cleanDatabase`，用其替换 `beforeAll` / `beforeEach` 中的逐表清理 SQL。**
- [ ] **步骤 2：运行 `vitest run tests/extensions.test.ts` 验证通过。**
- [ ] **步骤 3：Commit**
  ```bash
  git add tests/extensions.test.ts
  git commit -m "refactor: use cleanDatabase in extensions.test.ts"
  ```

### 任务 4：重构 `tests/graph-api.test.ts`

**文件：**
- 修改：[tests/graph-api.test.ts](file:///Users/jason/Documents/Antigravity/Project/Globaltradebuddy/tests/graph-api.test.ts)

- [ ] **步骤 1：导入 `cleanDatabase` 和 `mockReqRes`。在 `beforeAll`/`beforeEach` 里用 `cleanDatabase` 代替旧的清理语句。移除文件局部的 `mockReqRes`。**
- [ ] **步骤 2：使用统一的 `mockReqRes` 替换调用逻辑。例如把 `mockReqRes({ userId: userIdAdmin, role: 'admin' })` 替换为使用 `mockReqRes({ session: { userId: userIdAdmin, role: 'admin' } })`。**
- [ ] **步骤 3：运行 `vitest run tests/graph-api.test.ts` 验证通过。**
- [ ] **步骤 4：Commit**
  ```bash
  git add tests/graph-api.test.ts
  git commit -m "refactor: use cleanDatabase and mockReqRes in graph-api.test.ts"
  ```

### 任务 5：重构 `tests/security-api.test.ts`

**文件：**
- 修改：[tests/security-api.test.ts](file:///Users/jason/Documents/Antigravity/Project/Globaltradebuddy/tests/security-api.test.ts)

- [ ] **步骤 1：导入并使用 `cleanDatabase` 替换 `beforeAll`/`beforeEach` 里的多表清理。**
- [ ] **步骤 2：运行 `vitest run tests/security-api.test.ts` 并验证通过。**
- [ ] **步骤 3：Commit**
  ```bash
  git add tests/security-api.test.ts
  git commit -m "refactor: use cleanDatabase in security-api.test.ts"
  ```

### 任务 6：重构 `tests/upload-pipeline.test.ts`

**文件：**
- 修改：[tests/upload-pipeline.test.ts](file:///Users/jason/Documents/Antigravity/Project/Globaltradebuddy/tests/upload-pipeline.test.ts)

- [ ] **步骤 1：导入并使用 `cleanDatabase` 替换全局 `beforeAll`/`beforeEach` 清理逻辑。**
- [ ] **步骤 2：运行 `vitest run tests/upload-pipeline.test.ts` 并验证通过。**
- [ ] **步骤 3：Commit**
  ```bash
  git add tests/upload-pipeline.test.ts
  git commit -m "refactor: use cleanDatabase in upload-pipeline.test.ts"
  ```

### 任务 7：重构其他包含 mockReqRes 重复定义的文件

**文件：**
- 修改：[tests/delete-node-api.test.ts](file:///Users/jason/Documents/Antigravity/Project/Globaltradebuddy/tests/delete-node-api.test.ts)
- 修改：[tests/entity-merge.test.ts](file:///Users/jason/Documents/Antigravity/Project/Globaltradebuddy/tests/entity-merge.test.ts)
- 修改：[tests/entity-relations-api.test.ts](file:///Users/jason/Documents/Antigravity/Project/Globaltradebuddy/tests/entity-relations-api.test.ts)
- 修改：[tests/report-tag-api.test.ts](file:///Users/jason/Documents/Antigravity/Project/Globaltradebuddy/tests/report-tag-api.test.ts)

- [ ] **步骤 1：重构 `tests/delete-node-api.test.ts`**
  - 导入 `mockReqRes` 和 `cleanDatabase`（如有需要）。
  - 移除局部的 `mockReqRes`。更新测试用例中 `mockReqRes` 的调用方式。
  - 运行 `vitest run tests/delete-node-api.test.ts` 确认通过。

- [ ] **步骤 2：重构 `tests/entity-merge.test.ts`**
  - 导入 `mockReqRes`，移除局部 `mockReqRes`，更新调用，并运行 `vitest run tests/entity-merge.test.ts` 确认通过。

- [ ] **步骤 3：重构 `tests/entity-relations-api.test.ts`**
  - 导入 `mockReqRes`，移除局部 `mockReqRes`，更新调用，并运行 `vitest run tests/entity-relations-api.test.ts` 确认通过。

- [ ] **步骤 4：重构 `tests/report-tag-api.test.ts`**
  - 导入 `mockReqRes`，移除局部 `mockReqRes`，更新调用（注意原局部 `mockReqRes` 传参：`body, isLoggedIn = true`，应替换为 `mockReqRes({ body, session: isLoggedIn ? { userId: '10000000-0000-0000-0000-000000000000', role: 'admin' } : undefined })`），并运行 `vitest run tests/report-tag-api.test.ts` 确认通过。

- [ ] **步骤 5：Commit**
  ```bash
  git add tests/delete-node-api.test.ts tests/entity-merge.test.ts tests/entity-relations-api.test.ts tests/report-tag-api.test.ts
  git commit -m "refactor: use unified mockReqRes in node deletion, merge, relations, and tagging tests"
  ```

### 任务 8：全量回归测试

- [ ] **步骤 1：运行全量回归测试 `npm run test`。**
- [ ] **步骤 2：Commit 所有最终修改并发布最终 commit。**
  ```bash
  git commit -a --allow-empty -m "refactor: deduplicate test setup and mock handlers (tasks P4.1-P4.2)"
  ```
