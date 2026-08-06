---
name: promo-xiaohongshu
description: 将 content-pipeline 中的客户报告或品类报告转化为小红书爆款图文卡片 Prompt、封面方案与文字草稿的 Skill，自动保存至 marketing-pipeline/xiaohongshu/。
---

# 小红书爆款营销转换 (promo-xiaohongshu)

本技能专门用于读取 `content-pipeline/` 下的报告或新闻，将其解构并转化为符合小红书调性的**高爆率图文卡片与文案**。

## 核心工作流

1. **读取源报告**：读取 `content-pipeline/customers/` 或 `content-pipeline/categories/` 中的最新报告。
2. **提炼爆款钩子 (Hook)**：
   - **痛点型**：《别再傻傻发报价单了！拿这份星空图谱去查查你的客户...》
   - **干货型**：《想做 Home Depot 的供应商？先避开这 3 个准入巨坑！》
3. **制作卡片图方案（3-5 张）**：
   - **卡片 1（封面）**：高对比度标题 + 星空图谱/报告截图（使用亮橘/暗黑风）。
   - **卡片 2-4（干货）**：买家核心采购特征 / 反堆料研发三要素。
   - **卡片 5（引导）**：“私信回复【背调】获取可交互星空图谱链接”。
4. **生成文字草稿**：
   - 包含表情符号（小红书排版）、话题标签（如 `#外贸干货 #客户开发 #外贸SOHO #开发信`）。
5. **保存产物**：
   - 存入 `d:/我的APP/Globaltradebuddy/marketing-pipeline/xiaohongshu/[日期-小红书文案.md]`。
