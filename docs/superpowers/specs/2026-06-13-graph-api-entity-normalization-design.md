# Graph API 归一化实体与关系属性设计文档

本文档定义了升级 `pages/api/user/graph.ts` 的设计与实现方案。

## 1. 目标
1. 升级图谱数据查询接口，使返回的节点和连线携带更丰富的归一化实体和关系属性。
2. 保持向下兼容性，令现有的 `getUserGraph` 函数行为不变（默认返回 `'user'` 角色可见的图谱）。
3. 增强 API 路由，支持基于角色的权限判定，以返回不同范围的图谱数据。

## 2. 详细设计

### 2.1 数据结构

在 `pages/api/user/graph.ts` 中升级如下类型接口：

```typescript
export interface GraphNode {
  id: string;
  title: string;
  category: string;
  market_region: string;
  summary: string;
  companies: string[];
  products: string[];
  channels: string[];
}

export interface GraphLink {
  source: string;
  target: string;
  relation_key: string;
  market_region: string;
  relation_type: string;
}
```

### 2.2 接口与函数定义

新增并导出统一的获取图谱函数 `getGraphData`：

```typescript
/**
 * 统一获取图谱数据函数
 * @param userId 用户 ID
 * @param userRole 用户角色，可能为 'admin' 或 'user'
 * @param dbClient PG database client
 */
export async function getGraphData(
  userId: string,
  userRole: string,
  dbClient: any
): Promise<{ nodes: GraphNode[]; links: GraphLink[] }>
```

**向下兼容函数：**

```typescript
export async function getUserGraph(userId: string, dbClient: any) {
  return getGraphData(userId, 'user', dbClient);
}
```

### 2.3 数据获取与拼装逻辑 (方案 1)

1. **确定节点列表 (Nodes)**
   - 若 `userRole` 是 `'admin'`：
     - 执行 SQL：`SELECT id, title, category, market_region, summary FROM reports`
   - 若 `userRole` 是 `'user'`：
     - 执行 SQL：
       ```sql
       SELECT r.id, r.title, r.category, r.market_region, r.summary 
       FROM reports r
       JOIN unlocks u ON r.id = u.report_id
       WHERE u.user_id = $1
       ```
   - 若提取出的节点数量为 0，直接返回 `{ nodes: [], links: [] }`。

2. **批量查询关联实体**
   - 提取提取出的节点 ID 数组 `reportIds = nodes.map(n => n.id)`。
   - 执行 SQL 批量抓取这些节点所属的所有实体：
     ```sql
     SELECT re.report_id, e.canonical_name, e.entity_type
     FROM report_entities re
     JOIN entities e ON re.entity_id = e.id
     WHERE re.report_id = ANY($1)
     ```
   - 在 JS/TS 中遍历实体结果，将实体归入对应节点的对应数组（`companies`, `products`, `channels`）。

3. **批量查询连线关系 (Links)**
   - 执行 SQL：
     ```sql
     SELECT report_id_a AS source, report_id_b AS target, relation_key, market_region, relation_type
     FROM relations
     WHERE report_id_a = ANY($1) AND report_id_b = ANY($1)
     ```
     参数为 `reportIds`。

4. **数据整理输出**
   - 保证返回的节点中 `companies`, `products`, `channels` 字段均存在且默认为空数组 `[]`（而非 `undefined`），以符合规范。

### 2.4 API Handler 逻辑

更新 API 默认导出处理函数 `handler(req, res)`：
1. 请求方式校验：仅支持 `GET`，其它返回 `405`。
2. 解析参数：从 `req.query` 中获取 `userId` 和 `userRole`。
3. 判定 `role`：
   - 若 query 中传入了 `userRole`，直接使用该 `userRole`。
   - 若 query 中未传入 `userRole`，但传入了 `userId`：
     - 查询 `users` 表获取其角色：`SELECT role FROM users WHERE id = $1`。
     - 若获取成功，则将其作为 `userRole`（若不存在则默认为 `'user'`）。
   - 若 `userRole` 和 `userId` 均未传入，则 `userRole` 默认为 `'user'`。
4. 调用 `getGraphData(userId as string || '', resolvedRole, dbClient)` 并返回 200 结果。
5. 错误处理与连接释放：在 `try...catch...finally` 中确保 `dbClient.release()` 正常调用。

---

## 3. 测试策略

新建并编写对应的单元测试文件 `tests/graph-api.test.ts`：
1. **测试前置准备 (beforeAll)**：
   - 连接测试库，清理相关表（`users`, `reports`, `unlocks`, `relations`, `entities`, `report_entities`）。
   - 插入测试数据，包含：
     - 管理员用户和普通用户各一名。
     - 测试报告 3 篇（已解锁部分）。
     - 测试实体若干（包括公司、产品和渠道），并与报告关联。
     - 包含 `market_region` 和 `relation_type` 的测试关系连线。
2. **测试用例 1：`getGraphData` 普通用户模式**：
   - 验证该普通用户仅返回其已解锁 of 的报告节点。
   - 验证节点上 `companies`, `products`, `channels` 属性是数组，且内容正确。
   - 验证连线拥有 `market_region` 和 `relation_type` 属性，且内容正确。
3. **测试用例 2：`getGraphData` 管理员模式**：
   - 验证返回所有的报告节点。
   - 验证关联的所有实体和关系完整返回。
4. **测试用例 3：API Handler 权限路由**：
   - 模拟 NextApiRequest 和 NextApiResponse。
   - 测试当传入 query.userRole = 'admin' 时，直接返回全部节点与连线（无需读库角色）。
   - 测试当未传入 query.userRole，但 query.userId 存在时，通过数据库查询用户角色并应用。
   - 验证返回的数据结构完整。

---

## 4. 规格自检

1. **占位符扫描**：无 TODO 或未完成的段落。
2. **一致性**：所有新增接口及向下兼容规范均与旧的系统完全契合。
3. **范围**：本设计紧贴任务 4 的需求，未包含任何超范围的功能。
4. **模糊性**：明确了如果 query 中不含 `userRole` 时如何处理，以及 `companies`、`products`、`channels` 返回 `string[]` 类型的数据。
