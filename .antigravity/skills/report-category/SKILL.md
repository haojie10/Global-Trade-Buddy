---
name: report-category
description: 移植并强化自 Category Insight 的品类与海外零售渠道调研报告生成 Skill。针对特定品类及海外大卖场/零售渠道（如 Dollarama, Home Depot, Target 等）进行横向对比，生成包含反堆料研发方案及概念图的 HTML 报告，存入 content-pipeline/categories/ 并自动上传平台。
---

# 品类与渠道洞察报告 (report-category)

本技能继承自 **Category Insight** 核心规范，为中国制造企业与外贸工厂提供全球零售渠道品类调研与对比分析工作流，生成高颜值 HTML 商业洞察报告，并自动上传发布至 GlobalTradeBuddy 平台。

## 核心工作流

### 第一步：要素搜集与渠道穿透
1. 明确分析的**品类名称**、**目标市场国家**及 **3 个对比零售渠道**（如 Home Depot, Lowe's, Dollarama 等）。
2. 使用 `search_web` 或浏览器搜集目标渠道的在架 SKU、自有品牌与大牌结构、价格带与规格。
3. 追溯目标渠道在华代工厂与海关/提单数据逻辑。

### 第二步：生成反堆料产品研发方案
1. **反堆料与成本控制原则（强制执行）**：
   研发建议**严禁采用盲目堆料让成本剧增**（如乱加传感器、多余电路板）。必须优先通过**机构创新**（去螺钉/快拆）、**物流箱容率提升**（折叠平铺降海运费）或**材料规避税费**等方式降低 BOM 与交付成本。
2. **研发建议三要素规范**：
   - **用户画像**：明确消费群体与使用场景。
   - **客群痛点**：深刻挖掘现有产品在使用/购买中的真实痛点。
   - **解决方案**：基于反堆料原则，给出极具落地方案。
3. 使用 `generate_image` 为产品方案生成概念图，Base64 内嵌至 HTML 中。

### 第三步：生成 HTML 并存入管道
1. 生成自包含 HTML 文件，保存至 `d:/我的APP/Globaltradebuddy/content-pipeline/categories/[品类-市场-insight].html`。
2. **元数据强校验**：
   - `<meta name="category" content="product">`
   - `products` 元数据必须严格使用 `d:/我的APP/Globaltradebuddy/docs/GTB产品结构.xlsx` 中的 **54个标准行业名称**。
3. **视觉风格**：暖沙乳白背景 `#fdfbf7` + 暖橘 `#ff641e` 焦点色，无 Emoji，自包含 Base64 嵌入。

### 第四步：自动上传平台
报告保存后，自动检测 API 端点（如 `http://localhost:3000/api/agent/publish`），将品类报告推送到 GlobalTradeBuddy 平台。
