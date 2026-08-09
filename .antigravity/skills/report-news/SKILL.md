---
name: report-news
description: 全球外贸热点与 GTB 54 品类行业情报生成 Skill。结合大模型知识库动态生成检索词，依托 SerpAPI Google News 原生检索与 7 天严格时效过滤，深度抓取海外权威媒体真实 URL 与高清配图，产出 400~500 字深度商业事实解析及中国外贸供应链实操启示，并智能关联 GTB 54 标准品类（无上限多标签）。
---

# GTB 54品类实时行业新闻与热点情报 (report-news)

本技能用于针对 GlobalTradeBuddy (GTB) 平台的 **54 个标准品类** 以及 **周末宏观外贸大盘**，自动化抓取海外一手权威新闻，提取真实有效链接与高清 `og:image` 配图，并输出 400~500 字深度商业事实与中国制造工厂供应链实操启示。

---

## 核心质量与时效红线（强制执行）

1. **真实链接保障**：必须来自真实海外新闻源（如 Reuters, BBC, Retail Dive, CNBC, Forbes 等权威媒体），严禁臆造虚假或失效链接。
2. **7 天时效严格核验**：必须为最近 7 天内发生的真实新闻（通过 `isWithinDays` 算法严格拦截过期旧闻）。
3. **真实配图提取**：必须优先抓取新闻源页面的 `<meta property="og:image">` 高清大图。
4. **深度商业解析（Recap 400~500字）**：严禁三言两语敷衍！必须交代事件完整脉络、具体金额/门店数/数据指标、高管人事任命/开店投资、行业协会立场与主流玩家反应。
5. **智能多标签关联（无数量上限）**：
   - 综合大渠道（如 Home Depot, Walmart, Target）战略级新闻，自动关联其涵盖的全部相关品类（可达 10~20+ 个品类）；
   - 周六（全球海运与外贸汇率大盘）与周日（下周外贸合规日历与展会前瞻），自动关联全部 54 个品类。
6. **图谱隔离原则**：资讯仅进入 `news` 板块用于前台展示、多选订阅与公域 SEO 引流，**绝对不写入个人知识图谱（my-graph）**。

---

## 核心工作流与大模型动态检索规范

### 第一步：大模型常识库驱动的动态检索词构建
充分调动大模型自身的全球商业知识库，针对目标品类系统化融入：
* **主要品牌与核心玩家**（Key Players / Major Retailers）；
* **行业协会与官方标准组织**（Trade Associations / Standard Bodies）；
* **重大商业与人事变动**（`leadership`, `CEO`, `expansion`, `store openings`, `investment`, `acquisition`, `earnings`）；
* **政策法规与关税预警**（`tariff`, `compliance`, `supply chain`, `recall`）。

**检索模式示例**：
* 汽配品类：`("auto parts" OR "Auto Care Association" OR "AutoZone" OR "brake pads") ("leadership" OR "expansion" OR "tariff" OR "supply chain") news`
* 家电品类：`("home appliances" OR "AHAM" OR "Best Buy" OR "kitchen appliances") ("store openings" OR "investment" OR "compliance" OR "earnings") news`
* 周末海运：`("container freight rate" OR "SCFI" OR "Drewry WCI" OR "Red Sea shipping" OR "USD exchange rate") (shipping OR logistics) news`

---

### 第二步：执行底层采集与配图抓取
可以直接运行 Skill 内置的自包含脚本：
```bash
# 针对特定品类抓取
node .antigravity/skills/report-news/scripts/fetch-news.js --category="宠物用品"

# 按照今日星期几排期批量抓取板块
node .antigravity/skills/report-news/scripts/fetch-news.js

# 周六/周日宏观大盘测试
node .antigravity/skills/report-news/scripts/fetch-news.js --day=6
```

---

### 第三步：四段式深度结构化输出标准

生成的每条资讯必须满足以下 JSON / HTML 结构：

```json
{
  "title": "家得宝(Home Depot)加码户外与智能工具采购：宣布2026年全美新开80家专业门店",
  "recap": "【400~500字深度事实解析：详细交代家得宝本次投资80家新店的具体资金规模、重点陈列品类（如无绳电动工具、庭院智能灌溉、耐候性建筑材料）、高管采购总监关于供应链采购周期的最新表态，以及全美五金制造协会对此轮零售补库周期的评估……】",
  "highlights": [
    "计划全美新开 80 家 Pro 级专业五金工具门店",
    "重点增加无绳锂电工具及智能庭院品类的货架采购面积 15%",
    "预计将带动超过 12 亿美元的相关供应链采购订单"
  ],
  "takeaways": "【150~200字中国外贸工厂供应链实操启示：深度指导中国五金、工具、园林制造企业如何根据 Home Depot 的最新选品转向进行快拆结构改良、BOM成本优化以及满足其最新的包装箱容率要求……】",
  "industries": ["五金", "工具", "园林用品", "建筑及装饰材料", "照明产品"],
  "countries": ["美国"],
  "source_url": "https://www.retaildive.com/news/home-depot-pro-store-expansion/...",
  "imageUrl": "https://www.retaildive.com/assets/hd-store-og.jpg"
}
```

---

### 第四步：自动写入平台
脚本与 Agent 自动将提炼后的富文本 HTML 写入 `news` 数据表，并自动在 `news_industries` 建立与 GTB 标准品类（`industries` 表）的多对多绑定关系。
