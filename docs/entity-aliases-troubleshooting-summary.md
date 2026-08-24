# GlobalTradeBuddy 实体别名与关系拓扑问题排查总结与交接报告

## 1. 业务诉求与 Bug 现象

### 1.1 用户的标准预期（Single Source of Truth）
* **以 HTML `<meta>` 标签为唯一事实标准**：上传报告时，提取的实体与别名必须严格等于 HTML 的 Meta 标签（`company_name` 为主体，`company_aliases` 为别名，`sister_parents` 为姐妹公司等）。
* **所见即所得**：管理后台【编辑关系实体】中展示的内容、保存的内容与数据库实际存储的内容必须 100% 保持一致，无任何隐式推导。

### 1.2 当前出现的异常现象
以 `ALDI Nord` 研报为例（HTML Meta 原文：主体公司为 `ALDI Einkauf SE & Co. oHG`，别名仅 5 个：`ALDI Nord, 阿尔迪北, 阿尔迪北方, ALDI Nord Group, Unternehmensgruppe ALDI Nord`，姐妹公司为 `ALDI SÜD, Trader Joe's`）：
1. **别名爆炸污染**：管理后台展开该报告后，主体公司名下除了正确的 5 个别名外，还带出了 `沃尔玛 (Walmart)`, `达乐 (Dollar General)`, `DG`, `Yellow Banana`, `ALDI SÜD` 等近 30 个完全不相关的历史残留别名。
2. **姐妹公司缺失**：HTML 中明确声明了 `ALDI SÜD`，但在后台【💛 姐妹公司】一栏中只有 `Trader Joe's`，`ALDI SÜD` 始终无法呈现。
3. **后台编辑保存失效**：在管理后台【✏️ 编辑关系实体】弹窗中手动把无关别名全部删除、补上 `ALDI SÜD` 并点击保存后，列表刷新依然呈现原样。

---

## 2. 系统架构与数据表设计

系统全量运行于腾讯云轻量服务器（Next.js + 自建 PostgreSQL）。涉及的核心数据表如下：

```
┌─────────────────────────────────┐       1 : N       ┌─────────────────────────────────┐
│        entities (实体表)        │ ───────────────── │    entity_aliases (别名表)      │
│ ------------------------------- │                   │ ------------------------------- │
│ id: UUID (PK)                   │                   │ id: UUID (PK)                   │
│ canonical_name: VARCHAR (唯一)   │                   │ entity_id: UUID (FK -> entities)│
│ entity_type: VARCHAR            │                   │ alias_name: VARCHAR (UNIQUE)    │
└─────────────────────────────────┘                   └─────────────────────────────────┘
                 │ 1
                 │
                 │ N
┌─────────────────────────────────┐       N : 1       ┌─────────────────────────────────┐
│    report_entities (关联表)     │ ───────────────── │        reports (报告主表)       │
│ ------------------------------- │                   │ ------------------------------- │
│ report_id: UUID (FK -> reports) │                   │ id: UUID (PK)                   │
│ entity_id: UUID (FK -> entities)│                   │ title: VARCHAR                  │
│ role: VARCHAR (primary/sister...)│                   │ content_html: TEXT              │
│ source: VARCHAR (manual/auto)   │                   │ primary_entity_id: UUID         │
└─────────────────────────────────┘                   └─────────────────────────────────┘
```

---

## 3. 核心调用链路

1. **Agent 自动化发布**：
   `publish_report.py` ➔ 调用 `POST /api/agent/publish.ts` ➔ 调用 `lib/entity-extractor.ts` 的 `extractAndNormalizeEntities()` ➔ 写入 `reports`, `report_entities`, `entity_aliases`。
2. **管理员手动上传**：
   `pages/admin/reports.tsx` ➔ 调用 `POST /api/admin/reports/upload.ts` ➔ 调用 `extractAndNormalizeEntities()` ➔ 写入数据库。
3. **管理后台展示**：
   `pages/admin/reports.tsx` ➔ 调用 `GET /api/admin/reports/list.ts` ➔ 通过 SQL `SELECT STRING_AGG(ea.alias_name, '|||') FROM entity_aliases ea WHERE ea.entity_id = e.id` 聚合读取该实体的所有别名。
4. **管理后台编辑保存**：
   `pages/admin/reports.tsx`（点击保存）➔ 调用 `POST /api/admin/reports/update-entities.ts` ➔ 重新调用 `extractAndNormalizeEntities()` 并更新 `report_entities` 和 `entity_aliases`。

---

## 4. 排查定位出的深层根因（Root Causes）

### 根因 1：历史实体贪婪合并（Greedy Merging）引发的别名雪崩污染
* **原因**：在旧版 `lib/entity-extractor.ts` 中，存在一段“智能合并”逻辑：当一个别名匹配到已有实体时，代码执行了 `UPDATE entity_aliases SET entity_id = primaryEntityId WHERE entity_id = existingEntityId`，并物理删除了 `existingEntityId`。
* **后果**：曾经在某次处理中，`Walmart`、`Dollar General`、`ALDI SÜD` 的实体被物理删除，它们的名下所有别名全部被改绑到了 `ALDI Einkauf SE & Co. oHG` 上。

### 根因 2：姐妹公司被判定为“主体自身”而遭剔除
* **原因**：由于 `ALDI SÜD` 曾被误当做 `ALDI Einkauf SE & Co. oHG` 的别名挂在 `entity_aliases` 里，当代码解析 `sisters: ['ALDI SÜD', ...]` 时，系统根据别名查到了主体公司自己。
* **后果**：主体公司自身不能作为自己的姐妹公司，角色被固定为 `primary`，导致 `ALDI SÜD` 无法以 `sister_parent` 角色进入 `report_entities`。

### 根因 3：删除报告并未清理全局别名表，导致重新上传继续复用脏数据
* **原因**：点击后台“删除报告”时，只删除了 `reports` 和 `report_entities`，但全局 `entities` 和 `entity_aliases` 表里的记录依然存在。重新上传时又命中了同一个 `entity_id`，导致展示层再次把旧别名读出。

---

## 5. 目前已尝试的修改手段与代码改动记录

| 文件路径 | 修改内容 | 意图与目标 |
| :--- | :--- | :--- |
| **`lib/entity-extractor.ts`** | 1. 彻底删除了跨实体吞并与物理删除其他实体的危险代码；<br>2. 在解析 `sisters/competitors/suppliers` 时，增加 `if (primaryEntityId && ent.id === primaryEntityId) continue;` 防护。 | 杜绝 A 公司吞并 B 公司别名；防止姐妹公司被误识别为主体自身。 |
| **`pages/api/admin/reports/update-entities.ts`** | 在保存实体时，采用清空后重插模式：执行 `DELETE FROM entity_aliases WHERE entity_id = $1` 清空该主体旧别名，再逐一 `INSERT` 当前表单保留的别名。 | 实现后台编辑别名时的物理差量覆盖，做到所见即所得。 |
| **`pages/api/admin/reports/upload.ts`** | 修复表单别名解析（`manualTags.companies.slice(1)`），并在入库后同步清空旧别名后重新插入当前别名。 | 保证手动上传时别名与表单 1:1 对齐。 |
| **`pages/api/agent/publish.ts`** | 正则强化，提取 `company_aliases` 后入库前清空该主体的历史旧别名并重新插入。 | 保证脚本上传时严格按照 Meta 入库。 |
| **`lib/relation-calculator.ts`** | 在 `recalculateAllRelations()` 的第 0 步加入了核心实体的拆分与自愈重建逻辑。 | 尝试在全量重算图谱时自动清洗脏数据。 |
| **`bin/clean-contaminated-entities.js`** | 编写了直接连接本地 PostgreSQL 的独立清洗脚本。 | 尝试直接通过命令行执行 SQL 修复。 |

---

## 6. 后续排查的关键疑点与给接手模型的建议

尽管上述逻辑在代码层已做重构，但若线上依然复现该问题，接手模型/工程师可优先排查以下切入点：

1. **`list.ts` 的查询作用域问题**：
   * 目前 `pages/api/admin/reports/list.ts` 查询报告别名时，是通过 `entity_aliases` 全局表根据 `e.id` 聚合的：
     ```sql
     (SELECT STRING_AGG(ea.alias_name, '|||') FROM entity_aliases ea WHERE ea.entity_id = e.id) as aliases
     ```
   * **排查建议**：检查数据库中 `entities` 表里是否存在多个名为 `ALDI Einkauf SE & Co. oHG` 或其变体的重复实体记录？是否存在外键或触发器导致 `entity_aliases` 的 `DELETE` 失败或发生回滚？
2. **`extractAndNormalizeEntities` 函数的调用时序**：
   * 在 `update-entities.ts` 中，先调用了 `extractAndNormalizeEntities()`（此函数内部会从数据库全量读取 `entityMap` 放入内存），随后才在下面执行 `DELETE FROM entity_aliases`。
   * **排查建议**：检查是否因为内存中的 `entityMap` 读取的是清理前的旧快照，导致后续推导又把旧别名写入了数据库？是否应当在进入归一化之前就先在事务中完成别名表的物理重置？
3. **数据库实机数据核验**：
   * 直接在服务器上通过 `psql` 执行 SQL：
     ```sql
     SELECT id, canonical_name FROM entities WHERE canonical_name ILIKE '%ALDI%';
     SELECT * FROM entity_aliases WHERE entity_id IN (SELECT id FROM entities WHERE canonical_name ILIKE '%ALDI%');
     SELECT * FROM report_entities WHERE report_id = '目标报告ID';
     ```
   * 从物理数据库层面直接观察 `UPDATE / DELETE` 发生后的实际记录变化，排查事务是否被 `ROLLBACK`。
