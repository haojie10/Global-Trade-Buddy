# 设计规格说明：测试层去重 (Task P4)

## 1. 目标与背景
消除 `tests/` 目录中的重复代码。具体包括：
1. 重复的数据库表清理逻辑 (`DELETE FROM ...`)。
2. 重复的 Express 请求/响应模拟辅助函数 (`mockReqRes`)。
3. 繁琐的 SQL 插入和测试数据准备逻辑，替换为简单的工厂方法 (`createTestUser`, `createTestReport` 等)。

## 2. 方案选择与权衡

### 方案 A：严格执行任务说明中的 API 接口
直接引入 `cleanDatabase` 及极简的 `mockReqRes`。
- **优点**：结构简单，跟任务说明高度一致。
- **缺点**：部分测试用例（如 `delete-node-api.test.ts`, `graph-api.test.ts`, `report-tag-api.test.ts`）需要复杂的 Session Cookie 编码逻辑，如果在 `mockReqRes` 中没有很好的抽象，各测试文件仍会包含重复的 Cookie 编码逻辑。

### 方案 B：增强版的统一 `mockReqRes`（推荐）
在 `mockReqRes` 的 `options` 参数中，除了支持 `method`, `body`, `query`, `headers` 外，增加对 `session` 和 `cookies` 的可选支持。
- **优点**：一并消除各测试中对 `gtb_session` Base64 序列化的重复代码，代码库更加整洁。
- **缺点**：无。

因此我们推荐 **方案 B**。

## 3. 设计细节

### 3.1 `tests/helpers/db-test-helper.ts` 重构

新增三个辅助工具：
1. **`cleanDatabase(client: Client)`**
   按外键约束依赖顺序删除所有表中的数据：
   - notes, favorites, unlocks, relations, report_entities, entity_aliases, entity_relations, entities, reports, users。

2. **`mockReqRes(options)`**
   ```typescript
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
   ```

3. **测试数据工厂方法**
   为了避免测试代码直接拼接 SQL 构建测试用户/报告，提供快速创建工具：
   - `createTestUser(client, id, email, role, phone)`
   - `createTestReport(client, id, title, content, price, fileUrl)`

### 3.2 目标测试文件重构列表
我们将对以下文件进行重构以引入 `cleanDatabase` 或统一的 `mockReqRes`：
- [tests/auth-api.test.ts](file:///Users/jason/Documents/Antigravity/Project/Globaltradebuddy/tests/auth-api.test.ts)
- [tests/delete-node-api.test.ts](file:///Users/jason/Documents/Antigravity/Project/Globaltradebuddy/tests/delete-node-api.test.ts)
- [tests/entity-merge.test.ts](file:///Users/jason/Documents/Antigravity/Project/Globaltradebuddy/tests/entity-merge.test.ts)
- [tests/entity-relations-api.test.ts](file:///Users/jason/Documents/Antigravity/Project/Globaltradebuddy/tests/entity-relations-api.test.ts)
- [tests/extensions.test.ts](file:///Users/jason/Documents/Antigravity/Project/Globaltradebuddy/tests/extensions.test.ts)
- [tests/graph-api.test.ts](file:///Users/jason/Documents/Antigravity/Project/Globaltradebuddy/tests/graph-api.test.ts)
- [tests/report-tag-api.test.ts](file:///Users/jason/Documents/Antigravity/Project/Globaltradebuddy/tests/report-tag-api.test.ts)
- [tests/security-api.test.ts](file:///Users/jason/Documents/Antigravity/Project/Globaltradebuddy/tests/security-api.test.ts)
- [tests/upload-pipeline.test.ts](file:///Users/jason/Documents/Antigravity/Project/Globaltradebuddy/tests/upload-pipeline.test.ts)

## 4. 验证计划
重构后，运行 `npm run test` 以验证 17 个文件、50 个测试用例 100% 成功通过。
