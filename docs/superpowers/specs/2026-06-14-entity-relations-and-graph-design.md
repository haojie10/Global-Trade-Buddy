# 外贸实体关系网与图谱可视化设计规格说明书

本规格说明书定义了外贸报告分析系统中，关于“公司实体别名合并”以及“图谱中多色商业关系线（竞争、合作、品类）”的详细设计方案。

---

## 1. 背景与目标

在用户进行外贸商情分析时，经常遇到以下情况：
1.  **同名异译（同义词）**：例如“Detsky Mir”和“儿童世界”是同一家公司，但在上传报告时手动输入了不同名字，导致系统生成了两个独立的实体档案，信息无法拉通。我们希望将其统一归一化（Alias Merging），使得它们在全站被视为同一个公司。
2.  **商业关系交织（竞争与合作）**：两家公司可能互为“竞争对手”（如 Detsky Mir 与 Wildberries），或者有“供应商-客户”的合作关系。我们希望在图谱上能够以直观的**不同颜色连线**（如竞争连红线、合作连蓝线、经营品类连绿线）展示它们，并且用户不需要为了建立连接而在不相关的报告里强行写满所有竞争对手的名字。

本设计的目标是实现**从实体对齐到关系推理，再到图谱高定制化呈现**的完整商业分析闭环。

---

## 2. 数据库结构变更 (Database Schema Changes)

我们将保持现有 `reports`, `entities`, `entity_aliases`, `report_entities` 表的稳定，并引入一张新表 `entity_relations`，用于解耦并专门存储实体与实体之间的商业网络关系。

### 2.1. 新增实体关系表 `entity_relations`

该表用于定义商业网络中的连线信息。

```sql
CREATE TABLE IF NOT EXISTS entity_relations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    entity_id_a UUID NOT NULL REFERENCES entities(id) ON DELETE CASCADE,
    entity_id_b UUID NOT NULL REFERENCES entities(id) ON DELETE CASCADE,
    relation_type VARCHAR(50) NOT NULL CHECK (relation_type IN ('competitor', 'supplier', 'product_sale')),
    market_region VARCHAR(100), -- 限制在特定市场（如俄罗斯）
    created_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(entity_id_a, entity_id_b, relation_type, market_region)
);

CREATE INDEX IF NOT EXISTS idx_entity_relations_entity_a ON entity_relations(entity_id_a);
CREATE INDEX IF NOT EXISTS idx_entity_relations_entity_b ON entity_relations(entity_id_b);
```

### 2.2. 表关系说明

*   `entities` (1) ↔ (N) `entity_aliases`：主实体与别名关系。
*   `entities` (A) ↔ (B) `entity_relations`：实体之间的商业拓扑。
*   `reports` (1) ↔ (N) `report_entities` ↔ (1) `entities`：报告所提及的实体。

---

## 3. 别名归一化与实体合并逻辑

系统必须确保“一个实体只有一份档案”。如果用户动态发现了新的别名并希望合并：

### 3.1. 后端归一化 (Entity Normalization)
在解析报告或处理 `manualTags` 时，查询 `entity_aliases` 并自动对齐。
若用户手动输入的 tag 存在于 `entity_aliases` 的 `alias_name` 中，系统在写入 `report_entities` 时，**必须自动替换为主实体的 `entity_id`**。这部分逻辑已经在 `extractAndNormalizeEntities` 中建立，无需大改。

### 3.2. 动态实体合并 API (`/api/admin/entities/merge`)
当用户在界面上要求将“儿童世界”合并入“Detsky Mir”时，系统调用该 API。
*   **输入**：`source_entity_id` (被合并者, 如“儿童世界”的 ID), `target_entity_id` (主实体, 如“Detsky Mir”的 ID)。
*   **执行逻辑**：
    1.  开启数据库事务。
    2.  在 `entity_aliases` 中插入一条记录：将 `alias_name = '儿童世界'` 绑定到 `entity_id = target_entity_id`（Detsky Mir）。如果已存在别名，则更新其指向。
    3.  查询所有包含 `source_entity_id` 的 `report_entities`，将其 `entity_id` 批量修改为 `target_entity_id`。如果修改会触发 UNIQUE 约束冲突（即报告本就同时关联了两者），则直接删除冲突行。
    4.  查询所有与 `source_entity_id` 相关的 `entity_relations` 关系，将对应的 ID 替换为 `target_entity_id`。
    5.  从 `entities` 中安全删除 `source_entity_id` 记录。
    6.  提交事务。

---

## 4. 商业关系录入与推理逻辑

### 4.1. 手动快捷录入
在报告查看页或图谱侧边栏的“实体档案面板”中，提供添加“合作伙伴/供应商”和“竞争对手”的快捷操作。输入后，前端发送 POST 请求至 `/api/admin/entities/relation`，直接往 `entity_relations` 表中插入对应类型（`supplier` 或 `competitor`）的记录。

### 4.2. 上传产品/品类报告时的自动推理
若上传的报告满足以下条件：
*   手动输入的标签包含 **1 个产品** (如：`玩具`) 和 **多个公司** (如：`Detsky Mir`, `Wildberries`)。
*   系统自动推理判定：这几家公司在“玩具”品类上是竞争对手。
*   系统在保存报告的同时，自动向 `entity_relations` 表中写入这些公司之间的两两竞争关系记录：`relation_type = 'competitor'`, `market_region = 报告的市场地区`。

---

## 5. 图谱 API 改造与前端双色/多色连线渲染

### 5.1. API 改造 (`/api/user/graph.ts`)
图谱 API 返回的数据结构从纯“报告网”升级为“报告-实体混合网络”。

#### 返回的节点 (`nodes`)：
1.  **报告节点**：`node_type: 'report'`，渲染为文档或圆形图标。
2.  **实体节点**：`node_type: 'entity'`，包括属性 `entity_type: 'company' | 'product' | 'channel'`。

#### 返回的连线 (`links`)：
1.  **引用关系线**：`link_type: 'mention'`，连接报告与实体。
2.  **商业关系线**：`link_type: 'business'`，连接两个实体，包含 `relation_type: 'competitor' | 'supplier' | 'product_sale'`。

---

### 5.2. 前端图谱组件定制 (`components/ObsidianGraph.tsx`)

使用 `force-graph` 进行高度美观的定制：

#### A. 连线颜色与样式定制
*   **`mention` 线**：极淡灰色 `rgba(148, 163, 184, 0.12)`，宽度 1px。
*   **`competitor` 竞争线**：**警示红** `rgba(239, 68, 68, 0.85)`，宽度 2.5px，支持渲染为虚线或双向对抗粒子效果。
*   **`supplier` 合作/供应线**：**商务蓝** `rgba(37, 99, 235, 0.75)`，宽度 2.5px，带微弱粒子流动效果。
*   **`product_sale` 经营品类线**：**极光绿** `rgba(16, 185, 129, 0.6)`，宽度 1.5px。

#### B. 交互式展开与折叠（防乱设计）
*   **初始状态**：只渲染 `node_type = 'report'` 节点和与其直接相连的 `'company'` 类型实体节点。品类节点（如“玩具”）及非直系竞争对手默认折叠隐藏。
*   **展开交互**：双击公司节点，触发局部数据重新拼装，将与该节点相连的品类节点及其他竞争对手平滑弹出（展开）；再次双击收起。

#### C. 悬浮高亮 (Focus Mode)
*   鼠标 Hover 在任何节点 $N$ 上时，其他不相干的节点与连线的 opacity 渐变淡化为 `0.05`。
*   只保留节点 $N$、与其直接关联的所有节点，以及连结它们的彩线保持 `1.0` 的高亮。

---

## 6. 验证方案 (Verification Plan)

### 6.1. 单元与集成测试
1.  **实体合并测试** (`tests/entity-merge.test.ts`)：
    *   验证调用 `/api/admin/entities/merge` 后，被合并实体的所有报告是否成功转移到主实体。
    *   验证别名表是否新增成功，旧实体是否彻底安全删除。
2.  **图谱数据 API 测试** (`tests/graph-api.test.ts`)：
    *   验证返回的 JSON 结构中包含 `node_type` 和 `link_type` 字段，且连线中能准确区分 `competitor` 与 `supplier`。

### 6.2. 手动测试
1.  管理员上传一份产品报告，包含“玩具”和“Detsky Mir”、“Wildberries”。查看并确认在 `entity_relations` 表中自动建立了两者的竞争关系。
2.  打开前端图谱，确认 `Detsky Mir` 和 `Wildberries` 之间展现了一条清晰的**红色竞争对手线**，悬浮高亮工作正常。
