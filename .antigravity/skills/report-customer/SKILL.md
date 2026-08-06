---
name: report-customer
description: 移植并强化自 Company Insight Pro 的 360 度买家与企业战略情报生成 Skill。用于为目标海外买家生成深度背调报告，涵盖供应链穿透、决策链分析、财务评估与实战跟进建议，生成自包含 HTML 并存入 content-pipeline/customers/ 及自动上传平台。
---

# 客户 360° 深度背调与战略情报 (report-customer)

本技能继承自 **Company Insight Pro** 核心规范，为外贸智友提供专业、深度且具交互性的买家战略情报报告，为中国出口企业提供一站式“知己知彼”的背调与跟进决策支持。

## 核心能力

1. **千字级买家深度画像**：深度解构企业的历史演进、核心基因与当前战略重点。
2. **财务与信用穿透**：分析最新全年销售额、利润率变动、投资去向及违约风险。
3. **决策链与采购实体解构**：从 C 级高管、亚洲采购代表处到品类经理的权责及对接通道。
4. **供应链与合规深度报告**：涵盖非食品采购规模、主要市场竞争对手格局、供应商布局（剔除关联公司）及环保合规红线。
5. **痛点与实战建议**：针对买家业务痛点提供对华供应商的具体跟进与报价策略。

## 执行工作流

### 1. 深度调研阶段
- **全网搜索**：使用 `search_web` 或 `read_url_content` 搜索目标公司的最新财报、官网新闻、行业研报、亚洲/中国采购代表处及竞争对手。
- **合规与财务**：关注最新财年的营业额、EBITDA，以及 SMETA、BSCI、EcoVadis、法国 AGEC 法案等合规门槛。

### 2. 报告结构化与存放
生成的 HTML 报告保存至：`d:/我的APP/Globaltradebuddy/content-pipeline/customers/[公司名小写-customer-insight].html`

必须包含以下核心板块：
- **概览与历史**：千字概览、营业额、渠道结构、历史事件。
- **渠道深挖与竞争格局**：渠道分布、地理布局、同业竞争对手格局及消费人群画像。
- **自有品牌分析**：自主品牌矩阵定位、贴牌采购商机。
- **财务与市场**：财务穿透与非食品类营收占比。
- **业务单元与决策链**：采购组织结构与亚洲采购办公室实体。
- **供应链与合规**：采购图谱、核心供应商（必须为具体公司名简称），以及合规红线。
- **痛点与实战建议**：面向中国出口企业/供应商的实战跟进建议。

### 3. 元数据与标准品类强校验（强制要求）
HTML `<head>` 区域必须注入精确 `<meta>` 标签：

```html
<meta name="category" content="customer">
<meta name="summary" content="[150字以内的报告摘要说明]">
<meta name="company_name" content="[标准公司主名，如 BAUHAUS AG]">
<meta name="company_aliases" content="[公司别名/曾用名]">
<meta name="company_website" content="[官方网站网址]">
<meta name="competitors" content="[同业竞争对手简称列表，逗号分割]">
<meta name="products" content="[GTB标准品类列表，逗号分割]">
<meta name="regions" content="[市场地区列表]">
<meta name="channels" content="[产品销售分销渠道简称]">
<meta name="suppliers" content="[核心供应商简称列表]">
<meta name="customers" content="[核心买方/大客户简称列表]">
<meta name="sister_parents" content="[母公司/集团简称]">
```

> **品类名称标准化（强约束）**：
> `products` 标签及全文涉及的产品品类名称，必须严格匹配项目文件 `d:/我的APP/Globaltradebuddy/docs/GTB产品结构.xlsx` 中的 **54个标准行业名称**（例如：使用“五金”、“工具”、“家居用品”、“家用电器”，禁止自创非标词）。

### 4. 自动上传平台
报告保存后，自动检测端口 `http://localhost:3000/api/agent/publish` 或 `.env` 中的 `GTB_API_URL`，发送 POST 请求将报告与拓扑关系注入 GlobalTradeBuddy 平台。
