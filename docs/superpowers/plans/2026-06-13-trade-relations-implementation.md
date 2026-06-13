# 外贸获客关系图谱设计与筛选穿透 实现计划

> **面向 AI 代理的工作者：** 必需子技能：使用 superpowers:subagent-driven-development（推荐）或 superpowers:executing-plans 逐任务实现此计划。步骤使用复选框（`- [ ]`）语法来跟踪进度。

**目标**：实现外贸关系图谱的实体归一化提取、排除词过滤，以及前端顶部的国家/品类筛选与点击穿透看板，提供卓越的高端交互。

**架构**：在 PostgreSQL 数据库中添加实体、别名和映射表；升级 `upload.ts` 以应用实体对齐与过滤策略；更新 API `graph.ts` 和前端 `my-graph.tsx` 以获取报告实体属性，展示筛选下拉框与详细侧边画像。

**技术栈**：Next.js, React, PostgreSQL, D3 (force-graph)

---

## 文件结构与职责

1. [NEW] `supabase/migrations/20260613000000_entity_normalization.sql`: 创建实体归一化及关系补充表。
2. [NEW] `bin/backfill-entities.js`: 为数据库现有报告填充归一化实体和关系的后端补偿脚本。
3. [MODIFY] `pages/api/admin/reports/upload.ts`: 重构实体提取逻辑，实现基于数据库的别名对齐、黑名单过滤、以及 `report_entities` 和关联创建。
4. [MODIFY] `pages/api/user/graph.ts`: 修改 `getUserGraph` 以返回各节点提取的实体（公司、品类、渠道）列表。
5. [MODIFY] `pages/my-graph.tsx`: 增加顶部筛选框（国家、品类），增加右侧边栏“商业画像看板”并支持节点点击联动，支持双击节点穿透。
6. [MODIFY] `components/ObsidianGraph.tsx`: 修改节点点击/悬浮以展示实体标签，支持点击通知父组件更新画像。

---

### 任务 1：创建数据库迁移脚本以扩展实体归一化结构

**文件：**
- 创建：`supabase/migrations/20260613000000_entity_normalization.sql`
- 测试：`bin/apply-migration-tmp.js` (临时测试迁移应用)

- [ ] **步骤 1：编写迁移 SQL 脚本**

在 `supabase/migrations/20260613000000_entity_normalization.sql` 中写入：

```sql
-- 创建实体表
CREATE TABLE IF NOT EXISTS entities (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    canonical_name VARCHAR(100) UNIQUE NOT NULL,
    entity_type VARCHAR(50) NOT NULL, -- 'company', 'product', 'channel'
    created_at TIMESTAMP DEFAULT NOW()
);

-- 创建别名表
CREATE TABLE IF NOT EXISTS entity_aliases (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    entity_id UUID REFERENCES entities(id) ON DELETE CASCADE,
    alias_name VARCHAR(100) UNIQUE NOT NULL,
    created_at TIMESTAMP DEFAULT NOW()
);

-- 创建报告与实体关联表
CREATE TABLE IF NOT EXISTS report_entities (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    report_id UUID REFERENCES reports(id) ON DELETE CASCADE,
    entity_id UUID REFERENCES entities(id) ON DELETE CASCADE,
    created_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(report_id, entity_id)
);

-- 在 relations 关系表中增加属性
ALTER TABLE relations ADD COLUMN IF NOT EXISTS market_region VARCHAR(50);
ALTER TABLE relations ADD COLUMN IF NOT EXISTS relation_type VARCHAR(50);

-- 插入基础实体以供冷启动
INSERT INTO entities (canonical_name, entity_type) VALUES
('A 公司', 'company'),
('B 公司', 'company'),
('丰田汽车', 'company'),
('铝合金轮毂', 'product'),
('刹车片', 'product'),
('紧固件', 'product'),
('发光壁挂绿植环', 'product'),
('中东非公路工程车桥', 'product'),
('配件超市', 'channel'),
('一级供应链', 'channel')
ON CONFLICT (canonical_name) DO NOTHING;

-- 插入别名
INSERT INTO entity_aliases (entity_id, alias_name)
SELECT id, '美国 A 公司' FROM entities WHERE canonical_name = 'A 公司'
ON CONFLICT (alias_name) DO NOTHING;

INSERT INTO entity_aliases (entity_id, alias_name)
SELECT id, '美国A公司' FROM entities WHERE canonical_name = 'A 公司'
ON CONFLICT (alias_name) DO NOTHING;

INSERT INTO entity_aliases (entity_id, alias_name)
SELECT id, '德国 B 公司' FROM entities WHERE canonical_name = 'B 公司'
ON CONFLICT (alias_name) DO NOTHING;

INSERT INTO entity_aliases (entity_id, alias_name)
SELECT id, '汽配连锁超市' FROM entities WHERE canonical_name = '配件超市'
ON CONFLICT (alias_name) DO NOTHING;
```

- [ ] **步骤 2：创建临时 Node 迁移工具并执行**

创建 `/Users/jason/Documents/Antigravity/Project/Globaltradebuddy/bin/apply-migration-tmp.js`：

```javascript
const fs = require('fs');
const { Client } = require('pg');

async function main() {
  const client = new Client({
    connectionString: 'postgresql://postgres:postgres@localhost:5432/postgres'
  });
  await client.connect();
  const sql = fs.readFileSync('supabase/migrations/20260613000000_entity_normalization.sql', 'utf8');
  await client.query(sql);
  console.log('Migration applied successfully!');
  await client.end();
}
main().catch(console.error);
```

运行：`node bin/apply-migration-tmp.js`
预期：输出 "Migration applied successfully!" 并且不损坏已有报告和用户数据。

- [ ] **步骤 3：清理临时迁移文件并 Commit**

运行：`rm bin/apply-migration-tmp.js`
提交：
```bash
git add supabase/migrations/20260613000000_entity_normalization.sql
git commit -m "feat: add entity normalization tables and relation columns to DB schema"
```

---

### 任务 2：实现现有报告的实体/关系补偿脚本 (Backfill)

由于数据库中已有 7 份报告（包括 Mosco 和绿植报告），我们必须回填它们的实体和关系，不能将现有报告删除。

**文件：**
- 创建：`bin/backfill-entities.js`

- [ ] **步骤 1：编写 Backfill 脚本**

在 `bin/backfill-entities.js` 中写入：

```javascript
const { Client } = require('pg');

// 简单归一化规则
const commonKeywords = [
  { name: 'A 公司', type: 'company', match: ['A 公司', 'A Company', '美国A公司', '美国 A 公司'] },
  { name: 'B 公司', type: 'company', match: ['B 公司', 'B Company', '德国 B 公司'] },
  { name: '丰田汽车', type: 'company', match: ['丰田', 'Toyota'] },
  { name: '铝合金轮毂', type: 'product', match: ['铝合金轮毂', '轮毂'] },
  { name: '刹车片', type: 'product', match: ['刹车片'] },
  { name: '紧固件', type: 'product', match: ['紧固件', '螺丝', '螺栓'] },
  { name: '发光壁挂绿植环', type: 'product', match: ['绿植', 'Wall Decor Rings'] },
  { name: '中东非公路工程车桥', type: 'product', match: ['车桥', '工程车桥'] },
  { name: '配件超市', type: 'channel', match: ['汽配连锁超市', '连锁配件超市', '连锁超市'] },
  { name: '一级供应链', type: 'channel', match: ['一级供应链', '供应链体系'] },
];

const blacklist = ['公司', '工厂', '超市', '产品', '客户', '供应商', '采购商', '贸易'];

async function main() {
  const client = new Client({
    connectionString: 'postgresql://postgres:postgres@localhost:5432/postgres'
  });
  await client.connect();

  console.log('Starting backfill for existing reports...');
  
  // 1. 获取所有报告
  const reportsRes = await client.query('SELECT id, title, content_html, market_region FROM reports');
  
  for (const report of reportsRes.rows) {
    const text = report.title + ' ' + report.content_html;
    
    // 提取并匹配实体
    for (const kw of commonKeywords) {
      // 检查黑名单
      if (blacklist.includes(kw.name)) continue;

      let hasMatch = false;
      for (const m of kw.match) {
        if (text.includes(m)) {
          hasMatch = true;
          break;
        }
      }

      if (hasMatch) {
        // 获取或创建主实体
        let entRes = await client.query('SELECT id FROM entities WHERE canonical_name = $1', [kw.name]);
        let entId;
        if (entRes.rows.length === 0) {
          const insertEnt = await client.query(
            'INSERT INTO entities (canonical_name, entity_type) VALUES ($1, $2) RETURNING id',
            [kw.name, kw.type]
          );
          entId = insertEnt.rows[0].id;
        } else {
          entId = entRes.rows[0].id;
        }

        // 插入报告-实体映射
        await client.query(
          'INSERT INTO report_entities (report_id, entity_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
          [report.id, entId]
        );
        console.log(`Associated Report "${report.title}" with Entity "${kw.name}"`);
      }
    }
  }

  // 2. 补偿 relations 表属性
  const relationsRes = await client.query('SELECT id, report_id_a, report_id_b, relation_key FROM relations');
  for (const rel of relationsRes.rows) {
    // 根据 A 报告的 region 回填边属性
    const repARes = await client.query('SELECT market_region FROM reports WHERE id = $1', [rel.report_id_a]);
    if (repARes.rows.length > 0) {
      const region = repARes.rows[0].market_region || '全球';
      await client.query(
        'UPDATE relations SET market_region = $1, relation_type = $2 WHERE id = $3',
        [region, 'produces', rel.id]
      );
    }
  }

  console.log('Backfill completed successfully!');
  await client.end();
}

main().catch(console.error);
```

- [ ] **步骤 2：执行 Backfill 脚本**

运行：`node bin/backfill-entities.js`
预期：输出 "Backfill completed successfully!"，并在数据库里为 Mosco 报告分配 "运费波动" 等实体，为绿植报告分配 "发光壁挂绿植环" 实体。

- [ ] **步骤 3：清理 Backfill 脚本并 Commit**

运行：`rm bin/backfill-entities.js`
提交：
```bash
git add .
git commit -m "feat: run database entity backfill for existing reports"
```

---

### 任务 3：升级后台提取与归一化逻辑 (upload.ts)

**文件：**
- 修改：`pages/api/admin/reports/upload.ts`

- [ ] **步骤 1：重构 parseMetadata 并与数据库别名库结合**

在 `pages/api/admin/reports/upload.ts` 中修改 `parseMetadata` 及主 handler 逻辑，实现：
1. 提取所有公司名、产品品类、以及渠道词汇。
2. 过滤黑名单 `['公司', '工厂', '超市', '产品', '客户', '供应商', '采购商', '贸易']`。
3. 检查数据库 `entity_aliases` 并进行归一化对齐。

修改代码为：

```typescript
// 替换 pages/api/admin/reports/upload.ts 中的 parseMetadata 及 handler 逻辑
// 并在写入报告时同时写入 report_entities 表，并在 relations 表中建边并携带 market_region。
```

*(此处将在实现时写入精确的 TS 代码块，在计划文档中呈现其概要逻辑)*

---

### 任务 4：修改后端 API `graph.ts` 以返回归一化实体属性

**文件：**
- 修改：`pages/api/user/graph.ts`

- [ ] **步骤 1：让节点包含公司、品类和渠道列表**

在 `pages/api/user/graph.ts` 中升级 `getUserGraph`：
使用 `LEFT JOIN report_entities` 关联并使用 `JSON_AGG` 或分组把实体的标准名（`canonical_name`）和分类（`entity_type`）打包回传前端。

---

### 任务 5：重构前端图谱视图页面以支持顶部筛选与侧边画像看板

**文件：**
- 修改：`pages/my-graph.tsx`
- 修改：`components/ObsidianGraph.tsx`

- [ ] **步骤 1：添加顶部筛选 UI (国家/市场，核心品类)**
- [ ] **步骤 2：加入右侧栏联动卡片（当点击图谱中的报告节点时，切换展示该报告的详细画像：核心玩家、涉及品类、销售渠道、主销国家）**
- [ ] **步骤 3：支持双击节点穿透过滤（只保留一阶关联节点）**

---
