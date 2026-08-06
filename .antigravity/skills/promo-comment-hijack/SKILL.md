---
name: promo-comment-hijack
description: 热评截流与专家式干货答疑 Skill。用于生成监控关键词表与按痛点分类的高赞评论回复模板，保存至 marketing-pipeline/comment-playbook/。
---

# 评论区截流与干货回复话术库 (promo-comment-hijack)

本技能专门用于在小红书、知乎、抖音等爆款贴下进行“专家式干货截流”，通过提供极高价值的洞察引导潜在用户查看主页。

## 核心工作流

1. **关键词监控维护**：
   维护 `marketing-pipeline/comment-playbook/keywords.json`：
   包含：`客户要完报价单跑了`、`海关数据不准`、`SOHO如何找客户`、`Home Depot供应商`、`外贸避坑` 等。

2. **按痛点场景生成高赞回答**：
   - **绝不直接发网页链接或微信**（避免违规删评）。
   - **痛点 A：客户丢了/不理人**
     - *回复*：“建议先查买家的供应链状态。之前我们用网状拓扑做背调，发现这类客户往往在用你的报价向原工厂压价...（展现专业度，引导看主页）”
   - **痛点 B：想做大零售商但不懂准入**
     - *回复*：“大渠道主要卡在环保与包装箱容率上。反堆料降低 BOM 才是关键，手头刚好整理了一份准入拆解...”

3. **保存与更新**：
   - 定期更新 `marketing-pipeline/comment-playbook/reply-templates.md`。
