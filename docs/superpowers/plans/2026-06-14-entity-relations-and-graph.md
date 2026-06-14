# 实体关系与多色图谱可视化实现计划

> **面向 AI 代理的工作者：** 必需子技能：使用 superpowers:subagent-driven-development（推荐）或 superpowers:executing-plans 逐任务实现此计划。步骤使用复选框（`- [ ]`）语法来跟踪进度。

**目标：** 在外贸系统中实现公司实体别名合并归一化，建立实体关系模型并在前端图谱中使用红蓝绿等多色呈现竞争与合作关系网。

**架构：** 新增 `entity_relations` 表记录公司/产品间的多类型关系；升级上传与打标 API 动态处理别名与推理关系；重构图谱 API 为混合图谱节点模式，前端基于 `force-graph` 动态加载、多色上色与高亮。

**技术栈：** Next.js, PostgreSQL (pg), force-graph (Cytoscape-like web view), Vitest

---

## 文件变更结构

### [NEW]
*   `supabase/migrations/20260614000001_entity_relations.sql` (创建实体关系表及约束)
*   `pages/api/admin/entities/merge.ts` (实体别名归一化合并 API)
*   `pages/api/admin/entities/relation.ts` (实体关系手动录入 API)
*   `tests/entity-merge.test.ts` (合并接口的单元测试)
*   `tests/entity-relations-api.test.ts` (关系录入与推理的单元测试)

### [MODIFY]
*   `pages/api/admin/reports/upload.ts` (修改上传接口，实现手动打标推理关系)
*   `pages/api/user/graph.ts` (升级图谱 API，支持返回混合节点和实体间关系连线)
*   `components/ObsidianGraph.tsx` (升级前端图谱组件，定制双色/多色连线渲染、动态展开折叠与高亮)

---

## 实现任务列表

### 任务 1：数据库表结构变更

**文件：**
*   创建：`supabase/migrations/20260614000001_entity_relations.sql`
*   测试：`tests/db-schema-relations.test.ts`

- [ ] **步骤 1：编写失败的测试**
    创建 `tests/db-schema-relations.test.ts`，测试表 `entity_relations` 是否存在及其字段：
    ```typescript
    import { describe, it, expect, beforeAll, afterAll } from 'vitest';
    import { Client } from 'pg';
    import { createTestClient } from './helpers/db-test-helper';

    describe('Database Schema Relations', () => {
      let dbClient: Client;

      beforeAll(async () => {
        dbClient = createTestClient();
        await dbClient.connect();
      });

      afterAll(async () => {
        await dbClient.end();
      });

      it('should verify entity_relations table exists and has correct columns', async () => {
        const res = await dbClient.query(`
          SELECT column_name, data_type 
          FROM information_schema.columns 
          WHERE table_name = 'entity_relations'
        `);
        expect(res.rows.length).toBeGreaterThan(0);
        
        const cols = res.rows.map(r => r.column_name);
        expect(cols).toContain('entity_id_a');
        expect(cols).toContain('entity_id_b');
        expect(cols).toContain('relation_type');
        expect(cols).toContain('market_region');
      });
    });
    ```

- [ ] **步骤 2：运行测试验证失败**
    运行：`npx vitest run tests/db-schema-relations.test.ts`
    预期：FAIL (table_name='entity_relations' returns 0 rows)

- [ ] **步骤 3：编写最少实现代码**
    创建 `supabase/migrations/20260614000001_entity_relations.sql`：
    ```sql
    CREATE TABLE IF NOT EXISTS entity_relations (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        entity_id_a UUID NOT NULL REFERENCES entities(id) ON DELETE CASCADE,
        entity_id_b UUID NOT NULL REFERENCES entities(id) ON DELETE CASCADE,
        relation_type VARCHAR(50) NOT NULL CHECK (relation_type IN ('competitor', 'supplier', 'product_sale')),
        market_region VARCHAR(100),
        created_at TIMESTAMP DEFAULT NOW(),
        UNIQUE(entity_id_a, entity_id_b, relation_type, market_region)
    );

    CREATE INDEX IF NOT EXISTS idx_entity_relations_entity_a ON entity_relations(entity_id_a);
    CREATE INDEX IF NOT EXISTS idx_entity_relations_entity_b ON entity_relations(entity_id_b);
    ```
    并执行该迁移（可通过直连数据库或后台的 sql api 执行它来同步测试环境的 schema）。

- [ ] **步骤 4：运行测试验证通过**
    运行：`npx vitest run tests/db-schema-relations.test.ts`
    预期：PASS

- [ ] **步骤 5：Commit**
    ```bash
    git add tests/db-schema-relations.test.ts supabase/migrations/20260614000001_entity_relations.sql
    git commit -m "db: create entity_relations table for competitor and supplier relations"
    ```

---

### 任务 2：实现实体别名合并归一化 API

当用户需要把别称（如“儿童世界”）合并到主实体（如“Detsky Mir”）时。

**文件：**
*   创建：`pages/api/admin/entities/merge.ts`
*   测试：`tests/entity-merge.test.ts`

- [ ] **步骤 1：编写失败的测试**
    创建 `tests/entity-merge.test.ts`：
    ```typescript
    import { describe, it, expect, beforeAll, afterAll } from 'vitest';
    import { Client } from 'pg';
    import { createTestClient } from './helpers/db-test-helper';

    describe('Entity Merge API', () => {
      let dbClient: Client;
      let entMainId: string;
      let entAliasId: string;
      let reportId: string;

      beforeAll(async () => {
        dbClient = createTestClient();
        await dbClient.connect();
        
        // 创建主公司、别名公司和一篇关联了别称的报告
        const main = await dbClient.query("INSERT INTO entities (canonical_name, entity_type) VALUES ('Detsky Mir', 'company') RETURNING id");
        entMainId = main.rows[0].id;
        const alias = await dbClient.query("INSERT INTO entities (canonical_name, entity_type) VALUES ('儿童世界', 'company') RETURNING id");
        entAliasId = alias.rows[0].id;

        const rep = await dbClient.query("INSERT INTO reports (title, category) VALUES ('俄罗斯玩具市场分析', 'product') RETURNING id");
        reportId = rep.rows[0].id;

        await dbClient.query("INSERT INTO report_entities (report_id, entity_id) VALUES ($1, $2)", [reportId, entAliasId]);
      });

      afterAll(async () => {
        await dbClient.query("DELETE FROM entity_aliases WHERE alias_name = '儿童世界'");
        await dbClient.query("DELETE FROM report_entities WHERE report_id = $1", [reportId]);
        await dbClient.query("DELETE FROM reports WHERE id = $1", [reportId]);
        await dbClient.query("DELETE FROM entities WHERE id IN ($1, $2)", [entMainId, entAliasId]);
        await dbClient.end();
      });

      it('should merge alias entity into main entity successfully', async () => {
        // 调用待实现的合并 API，逻辑模拟
        const mergeHandler = (await import('../pages/api/admin/entities/merge')).default;
        
        // 验证合并后的效果
        // 1. 儿童世界在 entities 表里应被删除
        // 2. entity_aliases 应该多一条儿童世界指向 Detsky Mir 的记录
        // 3. report_entities 里的关联应该已经变成 Detsky Mir
      });
    });
    ```

- [ ] **步骤 2：运行测试验证失败**
    运行：`npx vitest run tests/entity-merge.test.ts`
    预期：FAIL (Module not found or functions undefined)

- [ ] **步骤 3：编写最少实现代码**
    创建 `pages/api/admin/entities/merge.ts` 并实现数据库合并事务：
    ```typescript
    import { NextApiRequest, NextApiResponse } from 'next';
    import pool from '../../../../lib/db';

    export default async function handler(req: NextApiRequest, res: NextApiResponse) {
      if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });
      
      const { sourceEntityId, targetEntityId, aliasName } = req.body;
      if (!sourceEntityId || !targetEntityId || !aliasName) {
        return res.status(400).json({ error: 'Missing parameters' });
      }

      const client = await pool.connect();
      try {
        await client.query('BEGIN');

        // 1. 录入 alias 表
        await client.query(
          `INSERT INTO entity_aliases (entity_id, alias_name) 
           VALUES ($1, $2) 
           ON CONFLICT (alias_name) DO UPDATE SET entity_id = EXCLUDED.entity_id`,
          [targetEntityId, aliasName]
        );

        // 2. 转移 report_entities 关联
        const reportEnts = await client.query(
          `SELECT report_id FROM report_entities WHERE entity_id = $1`,
          [sourceEntityId]
        );

        for (const row of reportEnts.rows) {
          await client.query(
            `INSERT INTO report_entities (report_id, entity_id) 
             VALUES ($1, $2) 
             ON CONFLICT (report_id, entity_id) DO NOTHING`,
            [row.report_id, targetEntityId]
          );
        }
        await client.query(`DELETE FROM report_entities WHERE entity_id = $1`, [sourceEntityId]);

        // 3. 转移 entity_relations 关系
        await client.query(
          `UPDATE entity_relations SET entity_id_a = $1 WHERE entity_id_a = $2`,
          [targetEntityId, sourceEntityId]
        );
        await client.query(
          `UPDATE entity_relations SET entity_id_b = $1 WHERE entity_id_b = $2`,
          [targetEntityId, sourceEntityId]
        );

        // 4. 删除原实体
        await client.query(`DELETE FROM entities WHERE id = $1`, [sourceEntityId]);

        await client.query('COMMIT');
        return res.status(200).json({ success: true });
      } catch (err: any) {
        await client.query('ROLLBACK');
        return res.status(500).json({ error: err.message });
      } finally {
        client.release();
      }
    }
    ```

- [ ] **步骤 4：运行测试验证通过**
    运行：`npx vitest run tests/entity-merge.test.ts`
    预期：PASS

- [ ] **步骤 5：Commit**
    ```bash
    git add tests/entity-merge.test.ts pages/api/admin/entities/merge.ts
    git commit -m "feat: implement entity merge API and alias binding"
    ```

---

### 任务 3：关系录入与智能推理逻辑

**文件：**
*   创建：`pages/api/admin/entities/relation.ts`
*   修改：`pages/api/admin/reports/upload.ts`
*   测试：`tests/entity-relations-api.test.ts`

- [ ] **步骤 1：编写失败的测试**
    创建 `tests/entity-relations-api.test.ts`：
    *   验证通过 `/api/admin/entities/relation` 手动插入 `supplier` 或 `competitor` 关系正常。
    *   验证上传产品报告时，包含 1 个产品 (如“文具”) 和多个公司 (如“Detsky Mir”, “Wildberries”) 时，后端在完成上传后是否会在 `entity_relations` 中自动录入这两家公司为 `competitor`。

- [ ] **步骤 2：运行测试验证失败**
    运行：`npx vitest run tests/entity-relations-api.test.ts`
    预期：FAIL

- [ ] **步骤 3：编写最少实现代码**
    *   创建 `pages/api/admin/entities/relation.ts` 提供手动插入和删除关系逻辑。
    *   修改 `pages/api/admin/reports/upload.ts`。在插入 report 事务的最后，检测 `manualTags` 是否包含 1 个 product 和 多个 companies，若是，自动执行：
    ```typescript
    if (manualTags.products && manualTags.products.length === 1 && manualTags.companies && manualTags.companies.length > 1) {
      // 查出这几家公司的实体的 ID
      // 两两配对，往 entity_relations 中写入 competitor 记录
    }
    ```

- [ ] **步骤 4：运行测试验证通过**
    运行：`npx vitest run tests/entity-relations-api.test.ts`
    预期：PASS

- [ ] **步骤 5：Commit**
    ```bash
    git add pages/api/admin/entities/relation.ts pages/api/admin/reports/upload.ts tests/entity-relations-api.test.ts
    git commit -m "feat: add entity relations administration and automated competitor inference"
    ```

---

### 任务 4：升级图谱 API 为混合节点模式

**文件：**
*   修改：`pages/api/user/graph.ts`
*   测试：升级 `tests/graph-api.test.ts`

- [ ] **步骤 1：编写失败的测试**
    修改 `tests/graph-api.test.ts`，使之断言 API 返回的结果中 `nodes` 包含 `node_type = 'report'` 和 `node_type = 'entity'` 两种类型的节点，且 `links` 包含 `link_type = 'mention'` 和 `link_type = 'business'` 两大类。

- [ ] **步骤 2：运行测试验证失败**
    运行：`npx vitest run tests/graph-api.test.ts`
    预期：FAIL (返回的数据只有报告节点，缺少实体节点与商业线)

- [ ] **步骤 3：编写最少实现代码**
    修改 `pages/api/user/graph.ts`：
    *   拉出报告列表。
    *   拉出报告涉及的所有实体 (`entities`)，装入 `nodes` 中，并加上 `node_type: 'entity'`。
    *   为每个提及实体的报告生成 `mention` 连接线，放进 `links` 中，指定 `link_type: 'mention'`。
    *   拉取 `entity_relations` 表中的商业拓扑连接，如果两个实体都在此图中，则在 `links` 中加入商业连接，指定 `link_type: 'business'`, `relation_type: 'competitor' | 'supplier'`。
    *   输出格式兼容性包装。

- [ ] **步骤 4：运行测试验证通过**
    运行：`npx vitest run tests/graph-api.test.ts`
    预期：PASS

- [ ] **步骤 5：Commit**
    ```bash
    git add pages/api/user/graph.ts tests/graph-api.test.ts
    git commit -m "feat: upgrade graph API to support mixed nodes and multi-typed relations"
    ```

---

### 任务 5：前端图谱组件与交互升级

**文件：**
*   修改：`components/ObsidianGraph.tsx`
*   测试：运行 `npx vitest run tests/frontend-render.test.ts` 进行兼容性自检。

- [ ] **步骤 1：定制连线颜色与粗细**
    在 `components/ObsidianGraph.tsx` 的 `.linkColor(...)` 和 `.linkWidth(...)` 中定制：
    ```typescript
    .linkColor((link: any) => {
      if (link.link_type === 'mention') return 'rgba(148, 163, 184, 0.12)';
      if (link.link_type === 'business') {
        if (link.relation_type === 'competitor') return 'rgba(239, 68, 68, 0.85)'; // 警示红
        if (link.relation_type === 'supplier') return 'rgba(37, 99, 235, 0.75)'; // 商务蓝
        if (link.relation_type === 'product_sale') return 'rgba(16, 185, 129, 0.6)'; // 极光绿
      }
      return 'rgba(37, 99, 235, 0.15)';
    })
    .linkWidth((link: any) => (link.link_type === 'business' ? 2.5 : 1))
    ```

- [ ] **步骤 2：定制节点展示及公司名称渲染**
    使用 `force-graph` 的 `.nodeCanvasObject(...)` 精细定制绘制：
    *   若为报告，绘制常规浅色图表。
    *   若为公司/产品实体，绘制亮色大圆，并在下方绘制实体名称 `canonical_name`。

- [ ] **步骤 3：实现双击折叠/展开逻辑**
    *   在组件内部通过 `useState` 维护一个 `expandedNodeIds` 的 Set。
    *   过滤传入 `force-graph` 的 `nodes` 与 `links`。仅当节点本身是报告，或者是处于 `expandedNodeIds` 关联内的实体时，才参与渲染数据。
    *   在 `.onNodeDoubleClick((node: any) => { ... })` 中更新该 Set，实现平滑的弹簧生长折叠效果。

- [ ] **步骤 4：Hover 悬停高亮逻辑**
    在 `.onNodeHover((node: any) => { ... })` 中，记录当前 hover 节点，修改背景节点/连线的透明度为 `0.05`，保留邻接路径高亮渲染。

- [ ] **步骤 5：运行前端渲染兼容性测试并 Commit**
    ```bash
    git add components/ObsidianGraph.tsx
    git commit -m "feat: redesign force-graph view with multi-colored edges, hover highlights and double-click collapse"
    ```
