# Graph API 归一化实体与关系属性实现计划

> **面向 AI 代理的工作者：** 必需子技能：使用 superpowers:subagent-driven-development（推荐）或 superpowers:executing-plans 逐任务实现此计划。步骤使用复选框（`- [ ]`）语法来跟踪进度。

**目标：** 升级 `pages/api/user/graph.ts`，使之能获取并返回归一化实体（companies, products, channels）以及关系属性（market_region, relation_type），支持在 query 里传入 `userRole` 或自适应读取用户角色，同时提供完善的单元测试覆盖。

**架构：** 在 `pages/api/user/graph.ts` 中增加并导出 `getGraphData`，使用多步 SQL 查询分别查出节点、关联实体和关联连线，并在内存中根据实体类型归类组装；向下兼容 `getUserGraph`；更新 `handler` 处理角色优先级与读取。

**技术栈：** Next.js API Routes, PostgreSQL, Vitest

---

### 任务 1：设计与实现 `getGraphData` 核心逻辑 (TDD)

**文件：**
- 修改：`pages/api/user/graph.ts`
- 创建：`tests/graph-api.test.ts`

- [ ] **步骤 1：编写失败的测试**
  在 `tests/graph-api.test.ts` 中导入并测试 `getGraphData`（包含普通用户与管理员）。

  ```typescript
  import { describe, it, expect, beforeAll, afterAll } from 'vitest';
  import { Client } from 'pg';
  import { createTestClient } from './helpers/db-test-helper';
  import { getGraphData, getUserGraph } from '../pages/api/user/graph';

  describe('Graph Core API - getGraphData & Compatibility', () => {
    let dbClient: Client;
    let userIdNormal: string;
    let userIdAdmin: string;
    let reportIdA: string;
    let reportIdB: string;

    beforeAll(async () => {
      dbClient = createTestClient();
      await dbClient.connect();

      // 清理相关表
      await dbClient.query('DELETE FROM unlocks');
      await dbClient.query('DELETE FROM relations');
      await dbClient.query('DELETE FROM report_entities');
      await dbClient.query('DELETE FROM entities');
      await dbClient.query('DELETE FROM reports');
      await dbClient.query('DELETE FROM users');

      // 1. 创建测试用户
      const normalRes = await dbClient.query(
        `INSERT INTO users (phone_number, role) VALUES ('13800000001', 'user') RETURNING id`
      );
      userIdNormal = normalRes.rows[0].id;

      const adminRes = await dbClient.query(
        `INSERT INTO users (phone_number, role) VALUES ('13800000002', 'admin') RETURNING id`
      );
      userIdAdmin = adminRes.rows[0].id;

      // 2. 创建测试报告
      const repA = await dbClient.query(
        `INSERT INTO reports (title, category, market_region, summary, content_html) 
         VALUES ('A公司铝合金轮毂报告', 'customer', '欧美', 'A公司摘要', '全文A') 
         RETURNING id`
      );
      reportIdA = repA.rows[0].id;

      const repB = await dbClient.query(
        `INSERT INTO reports (title, category, market_region, summary, content_html) 
         VALUES ('刹车片市场品类洞察', 'product', '中东', '刹车片摘要', '全文B') 
         RETURNING id`
      );
      reportIdB = repB.rows[0].id;

      // 3. 关联关系，增加 market_region 和 relation_type
      await dbClient.query(
        `INSERT INTO relations (report_id_a, report_id_b, relation_key, market_region, relation_type) 
         VALUES ($1, $2, '共有组件', '中东', 'supply_chain')`,
        [reportIdA, reportIdB]
      );

      // 4. 解锁信息 (普通用户仅解锁 reportIdA)
      await dbClient.query(
        `INSERT INTO unlocks (user_id, report_id) VALUES ($1, $2)`,
        [userIdNormal, reportIdA]
      );

      // 5. 插入实体并关联
      const entComp = await dbClient.query(
        `INSERT INTO entities (canonical_name, entity_type) VALUES ('测试公司', 'company') RETURNING id`
      );
      const entProd = await dbClient.query(
        `INSERT INTO entities (canonical_name, entity_type) VALUES ('测试产品', 'product') RETURNING id`
      );
      const entChan = await dbClient.query(
        `INSERT INTO entities (canonical_name, entity_type) VALUES ('测试渠道', 'channel') RETURNING id`
      );

      await dbClient.query(
        `INSERT INTO report_entities (report_id, entity_id) VALUES 
         ($1, $4), ($1, $5), ($2, $6)`,
        [reportIdA, entComp.rows[0].id, entProd.rows[0].id, entChan.rows[0].id]
      );
    });

    afterAll(async () => {
      await dbClient.end();
    });

    it('should query personal graph data for normal user with entities and relation attributes', async () => {
      // 1. 普通用户仅解锁了 reportIdA，没有解锁 reportIdB，因此图谱没有连线
      const data = await getGraphData(userIdNormal, 'user', dbClient);
      expect(data.nodes.length).toBe(1);
      expect(data.nodes[0].id).toBe(reportIdA);
      expect(data.nodes[0].title).toBe('A公司铝合金轮毂报告');
      expect(data.nodes[0].summary).toBe('A公司摘要');
      
      // 验证实体属性
      expect(data.nodes[0].companies).toContain('测试公司');
      expect(data.nodes[0].products).toContain('测试产品');
      expect(data.nodes[0].channels).toEqual([]); // 应该为空数组而非 undefined

      expect(data.links.length).toBe(0); // 由于仅解锁一个，连线被安全过滤
    });

    it('should query full graph data for admin including all nodes, entities and connection attributes', async () => {
      // 2. 管理员用户应该查到所有节点和连线，不论是否解锁
      const data = await getGraphData('', 'admin', dbClient);
      expect(data.nodes.length).toBe(2);
      
      const nodeA = data.nodes.find(n => n.id === reportIdA)!;
      const nodeB = data.nodes.find(n => n.id === reportIdB)!;
      expect(nodeA).toBeDefined();
      expect(nodeB).toBeDefined();

      expect(nodeA.companies).toContain('测试公司');
      expect(nodeA.products).toContain('测试产品');
      expect(nodeB.channels).toContain('测试渠道');

      // 验证连线及其实体属性
      expect(data.links.length).toBe(1);
      expect(data.links[0].source).toBe(reportIdA);
      expect(data.links[0].target).toBe(reportIdB);
      expect(data.links[0].relation_key).toBe('共有组件');
      expect(data.links[0].market_region).toBe('中东');
      expect(data.links[0].relation_type).toBe('supply_chain');
    });

    it('should verify backward compatibility of getUserGraph', async () => {
      const data = await getUserGraph(userIdNormal, dbClient);
      expect(data.nodes.length).toBe(1);
      expect(data.nodes[0].id).toBe(reportIdA);
    });
  });
  ```

- [ ] **步骤 2：运行测试验证失败**
  运行：`npx vitest run tests/graph-api.test.ts`
  预期：编译或运行报错，提示 `getGraphData` 无法从 `../pages/api/user/graph` 中解析/导入。

- [ ] **步骤 3：编写最少实现代码**
  在 `pages/api/user/graph.ts` 中实现 `getGraphData` 及更新原有的类型接口，同时保留导出 `getUserGraph`。

  ```typescript
  // 在 pages/api/user/graph.ts 中：
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

  export async function getGraphData(userId: string, userRole: string, dbClient: any) {
    let nodes: any[] = [];
    if (userRole === 'admin') {
      const res = await dbClient.query(
        `SELECT id, title, category, market_region, summary FROM reports`
      );
      nodes = res.rows;
    } else {
      const res = await dbClient.query(
        `SELECT r.id, r.title, r.category, r.market_region, r.summary 
         FROM reports r
         JOIN unlocks u ON r.id = u.report_id
         WHERE u.user_id = $1`,
        [userId]
      );
      nodes = res.rows;
    }

    if (nodes.length === 0) {
      return { nodes: [], links: [] };
    }

    const reportIds = nodes.map(n => n.id);

    // 查询实体
    const entitiesRes = await dbClient.query(
      `SELECT re.report_id, e.canonical_name, e.entity_type
       FROM report_entities re
       JOIN entities e ON re.entity_id = e.id
       WHERE re.report_id = ANY($1)`,
      [reportIds]
    );

    // 查询连线关系
    const relationsRes = await dbClient.query(
      `SELECT report_id_a AS source, report_id_b AS target, relation_key, market_region, relation_type 
       FROM relations 
       WHERE report_id_a = ANY($1) AND report_id_b = ANY($1)`,
      [reportIds]
    );

    // 初始化节点的归一化实体数组
    const nodeMap = new Map<string, any>();
    for (const node of nodes) {
      node.companies = [];
      node.products = [];
      node.channels = [];
      nodeMap.set(node.id, node);
    }

    // 分类拼装实体
    for (const entityRow of entitiesRes.rows) {
      const node = nodeMap.get(entityRow.report_id);
      if (node) {
        if (entityRow.entity_type === 'company') {
          node.companies.push(entityRow.canonical_name);
        } else if (entityRow.entity_type === 'product') {
          node.products.push(entityRow.canonical_name);
        } else if (entityRow.entity_type === 'channel') {
          node.channels.push(entityRow.canonical_name);
        }
      }
    }

    return {
      nodes,
      links: relationsRes.rows,
    };
  }

  export async function getUserGraph(userId: string, dbClient: any) {
    return getGraphData(userId, 'user', dbClient);
  }
  ```

- [ ] **步骤 4：运行测试验证通过**
  运行：`npx vitest run tests/graph-api.test.ts`
  预期：测试通过。

- [ ] **步骤 5：Commit**
  ```bash
  git add pages/api/user/graph.ts tests/graph-api.test.ts
  git commit -m "feat: implement getGraphData core logic with entity normalization"
  ```

---

### 任务 2：更新与测试 API handler 路由逻辑

**文件：**
- 修改：`pages/api/user/graph.ts`
- 修改：`tests/graph-api.test.ts`

- [ ] **步骤 1：编写失败的测试**
  在 `tests/graph-api.test.ts` 底部追加 API handler 测试。

  ```typescript
  // 在 tests/graph-api.test.ts 底部追加：
  import graphHandler from '../pages/api/user/graph';

  describe('Graph API Handler', () => {
    let dbClient: Client;
    let userIdNormal: string;
    let userIdAdmin: string;

    beforeAll(async () => {
      dbClient = createTestClient();
      await dbClient.connect();
      // 获取已存在的测试用户 ID
      const normalRes = await dbClient.query("SELECT id FROM users WHERE phone_number = '13800000001'");
      userIdNormal = normalRes.rows[0].id;
      const adminRes = await dbClient.query("SELECT id FROM users WHERE phone_number = '13800000002'");
      userIdAdmin = adminRes.rows[0].id;
    });

    afterAll(async () => {
      await dbClient.end();
    });

    function mockReqRes(query: any) {
      const req = {
        method: 'GET',
        query,
      } as any;
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
      } as any;
      return { req, res, getStatus: () => statusVal, getJson: () => jsonVal };
    }

    it('should fallback userRole to query users table if userRole is missing', async () => {
      const { req, res, getStatus, getJson } = mockReqRes({ userId: userIdAdmin });
      await graphHandler(req, res);
      expect(getStatus()).toBe(200);
      // 因为 userIdAdmin 是 admin 角色，即使没有传 userRole，自动获取后返回 2 个节点
      expect(getJson().nodes.length).toBe(2);
    });

    it('should respect explicitly passed userRole query parameter', async () => {
      // 显式传入 userRole = 'admin' 即使 userId 是普通用户，也返回管理员权限数据
      const { req, res, getStatus, getJson } = mockReqRes({ userId: userIdNormal, userRole: 'admin' });
      await graphHandler(req, res);
      expect(getStatus()).toBe(200);
      expect(getJson().nodes.length).toBe(2); // 管理员节点数为 2
    });

    it('should default userRole to user if both missing or role query fails', async () => {
      const { req, res, getStatus, getJson } = mockReqRes({ userId: '00000000-0000-0000-0000-000000000000' }); // 不存在用户 ID
      await graphHandler(req, res);
      expect(getStatus()).toBe(200);
      expect(getJson().nodes.length).toBe(0); // 默认为 user 角色，且无解锁，返回 0 节点
    });
  });
  ```

- [ ] **步骤 2：运行测试验证失败**
  运行：`npx vitest run tests/graph-api.test.ts`
  预期：API Handler 测试用例失败（因为目前 `handler` 还不支持 `userRole` 覆盖和根据 `userId` 自动查询角色的逻辑）。

- [ ] **步骤 3：编写最少实现代码**
  在 `pages/api/user/graph.ts` 中实现升级后的 `handler`：

  ```typescript
  // 在 pages/api/user/graph.ts 的 handler 中：
  export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (req.method !== 'GET') {
      return res.status(405).json({ error: 'Method Not Allowed' });
    }

    const { userId, userRole } = req.query;
    
    // 如果两个参数都没有，则由于向下兼容，可以抛出错误（除非是 admin 场景）
    // 为了保持一致的报错，如果缺 userId 且缺 userRole，报 400
    if (!userId && !userRole) {
      return res.status(400).json({ error: 'Missing userId parameter' });
    }

    const dbClient = await pool.connect();

    try {
      let resolvedRole = userRole as string;
      if (!resolvedRole) {
        if (userId) {
          const userRes = await dbClient.query(
            `SELECT role FROM users WHERE id = $1`,
            [userId]
          );
          if (userRes.rows.length > 0) {
            resolvedRole = userRes.rows[0].role || 'user';
          } else {
            resolvedRole = 'user';
          }
        } else {
          resolvedRole = 'user';
        }
      }

      const graphData = await getGraphData(userId as string || '', resolvedRole, dbClient);
      return res.status(200).json(graphData);
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    } finally {
      dbClient.release();
    }
  }
  ```

- [ ] **步骤 4：运行测试验证通过**
  运行：`npx vitest run tests/graph-api.test.ts`
  预期：所有测试通过。
  
  运行整体测试套件以验证是否有任何回归：
  运行：`npm test`

- [ ] **步骤 5：Commit**
  ```bash
  git add pages/api/user/graph.ts tests/graph-api.test.ts
  git commit -m "feat: upgrade graph API handler to support userRole parameter and database role fallback"
  ```
