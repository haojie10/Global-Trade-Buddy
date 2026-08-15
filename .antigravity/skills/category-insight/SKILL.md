---
name: category-insight
description: |
  针对特定零售市场（如北美、加拿大、欧洲、亚太）和不同渠道进行特定品类的深度调研与横向对比，并生成一份高颜值的 HTML 可视化报告与概念产品设计图，并自动上传发布至 GlobalTradeBuddy 平台。
  触发条件：
  - 用户提到「品类洞察」「品类调研」「渠道对比分析」「竞品对比」「市场洞察」「Category Insight」「上传平台」
  - 用户要求分析某个特定渠道的特定产品（如 Dollarama 的泳帽、Dollar General 的手持风扇、Canadian Tire 的纸袋等）并形成报告
  - 用户需要一份针对制造企业的研发升级建议与产品设计图
---

# 品类洞察（Category Insight）

本技能提供了一套规范的全球零售渠道品类调研与对比分析工作流，通过自动化的报告生成、Base64 图片内嵌、文件清理技术以及一键平台上传，为用户交付一份自包含、无冗余临时文件且已发布上线至平台（`https://globaltradebuddy.vercel.app`）的精美 HTML 商业洞察报告。

## 准备与方法论导航

在开展具体调研前，必须先仔细阅读本技能自带的调研方法学参考文档：
- **渠道与分析方法论**：[methodology.md](references/methodology.md)（详细梳理了折价一元店、家居建材连锁、专业运动百货、综合大卖场等渠道的客群定位与采购逻辑）。
- **UI 视觉规范**：[ui-spec.md](references/ui-spec.md)（报告的 CSS 色彩、排版、圆角、标签、按钮等 UI 规范，生成 HTML 前必须阅读并严格遵守）。

---

## 核心工作流

按照以下步骤严格执行，确保过程全自动化与输出质量：

### 第一步：明确要素与检索

1. 与用户确认分析的**品类名称（英文与中文）**、**目标市场国家**及**三个对比零售渠道**（如用户未指明，请查阅 [methodology.md](references/methodology.md) 根据国家选取三家合适的渠道）。
2. 使用 `search_web` 或通过浏览器爬取目标网站，搜集各渠道的相关在架 SKU、自主贴牌与经销大牌结构、价格分布以及规格特点。
3. **供应链与供应商穿透挖掘**：针对目标渠道（尤其是零售商/自有品牌运营主体）在中国的代工厂及供应链关系进行深度追溯。
   - **挖掘工具**：利用海关数据（包括报关单、提单、舱单等海关运输单据）以及公开的 EAC/符合性声明注册信息，分析其真实的进口商、离岸中转商及实际出口生产厂家。
   - **处理规范**：若通过上述多源数据成功穿透，需在报告中结构化列出代表代工厂、出货口岸和物流周期；若经尽职检索，确实无法在公开的海关与提单数据库中找到相关记录，则必须显示"无公开信息"，严禁捏造虚假信息。
4. 检索并提炼消费者在电商或论坛上关于该品类的**核心使用痛点**（如寿命短、压迫性胀痛、接口落后、雨淋易破损等）。

### 第二步：生成产品概念设计图与研发方案

1. 针对提取的渠道空白点与消费者痛点，为制造企业提出 3 条具体的产品升级研发方向，并起好极具溢价感和商业美学的产品名称。
2. **反堆料与成本控制原则（强制执行）**：产品开发建议**严禁采用堆料的方式让成本直线上升**（如盲目堆砌芯片、传感器、多余电路板或昂贵的压铸框架）。必须优先通过**机构创新**（如去螺钉磁吸/快拆）、**物流箱容率提升**（如折叠平铺降低海运集装箱运费）或**材料规避税费**（如 PCR 塑料规避包装税）等去中介化方式降低 BOM 与综合交付成本。
3. **研发建议三要素规范（强制包含）**：每一个产品开发建议必须显式附带以下三项结构化内容：
   - **1. 消费群体或者用户（用户画像）**：明确具体年龄段、生活/使用场景及消费特征。
   - **2. 这些群体的痛点**：深刻挖掘该客群在现有渠道产品使用或购买过程中的真实痛点。
   - **3. 开发建议**：基于反堆料原则，给出针对性的技术、结构或材料落地路径（卡片内标题统一简写为「3. 开发建议：」，不显示多余冗长文字）。
4. 使用 `generate_image` 工具为这三款产品各生成一张高清概念设计图，图片保存在 artefacts 目录下。
   - **⚠️ 降级与生图提示词规范（强制要求）**：若在生成图片时因 API 额度超限或其他故障导致**未能成功输出完整的三张 AI 渲染图片**，**坚决禁止生成任何 SVG 矢量图或 Python PIL 绘制的替代图！** 此时必须向用户**显式输出这 3 张概念图的完整英文 Prompt（生图提示词）**，提醒用户可使用外部生图工具生成图片后，重命名为 `concept_1.png`、`concept_2.png`、`concept_3.png` 放入工作目录，然后再执行后续的图片 Base64 嵌入与平台上传流程。
5. 使用 `run_command`（在 Windows PowerShell 下）将这三张图片拷贝到您的工作目录（如 `d:\我的APP\品类洞察\`）中，重命名为易于引用的短文件名（如 `concept_1.png`、`concept_2.png`、`concept_3.png`）。

### 第三步：基于模板构建 HTML 报告

1. **元数据注入（强制要求）**：生成的 HTML 文档 `<head>` 区域必须注入以下精确的 `<meta>` 标签（多值标签使用英文半角逗号 `,` 分割）：

   ```html
   <meta name="category" content="product">
   <meta name="summary" content="[150字以内的报告摘要说明]">
   <meta name="company_name" content="">
   <meta name="company_aliases" content="">
   <meta name="company_website" content="">
   <meta name="competitors" content="[对比渠道/竞品列表，如 Action, GiFi, Centrakor]">
   <meta name="products" content="[产品与品类列表，如 泳帽, 硅胶泳帽, 运动配件]">
   <meta name="regions" content="[市场地区列表，如 加拿大, 北美]">
   <meta name="channels" content="[调研的渠道商列表，如 Dollarama, Canadian Tire, Walmart]">
   <meta name="suppliers" content="[报告中提到的产品品牌所有者公司列表（必须使用品牌简称，不得用完整法律实体名称，且不得是调研渠道自身），如 Speedo, TYR]">
   <meta name="customers" content="[核心买方/渠道商列表（必须为具体公司名，且不得为该调研渠道的关联公司）；若无法明确到具体公司则留空]">
   <meta name="sister_parents" content="">
   ```
   
   > 注意：`category` 为 `product` 时，`company_name`、`company_website`、`sister_parents`、`company_aliases` 留空（`content=""`），但标签必须保留。`suppliers` 填写报告中出现的主要产品品牌简称（如 `Paulmann` 而非 `Paulmann Licht GmbH`，`Signify` 而非 `Signify Philips Hue`），不可填写调研渠道自身。`customers` 同理用简称。

   > **`products` 元数据与品类名称强校验规范（强制要求）**：`products` 字段的值及标题中的【产品类别】必须**严格等于 GTB 产品结构标准品类名称的精确字符串（B 列）**，严禁凭直觉拟造或自创同义词。
   > - **标准文件路径**：`references/GTB产品结构.xlsx`（已纳入本技能 `references/` 目录，无需依赖工作目录）。
   > - **操作流程与代码强提取**：在填写 `products` meta 和命名标题之前，先运行以下命令打印 B 列全量字典集：
   >   ```bash
   >   python -c "import pandas as pd; df = pd.read_excel('C:/Users/066/.gemini/config/skills/category-insight/references/GTB产品结构.xlsx'); print(list(df['行业名称 (Category CN)'].dropna().astype(str).str.strip()))"
   >   ```
   > - **精准匹配示例与反例警告（强约束）**：
   >   - ❌ **误写**：`个人护理电器`、`美妆工具`（非 B 列原词）
   >   - ✅ **正确**：`个人护理用具`（B 列原词，Code 36）
   >   - ❌ **误写**：`家用电器类`
   >   - ✅ **正确**：`家用电器`（B 列原词，Code 1）
   > - **规则兜底**：若调研品类跨多个分类用英文半角逗号分割列出（如 `卫浴设备, 照明产品`）。发布脚本 `publish_report.py` 已内置强校验纠错机制，会双重拦截非标词。

2. **UI 规范强制对齐（编码前必须先阅读 [ui-spec.md](references/ui-spec.md)）**：
   - **色彩体系**：使用暖沙乳白 `#fdfbf7` 主背景、暖橘 `#ff641e` 焦点色，禁用高饱和度红绿蓝紫。品类分析图例使用烟灰 `#7a756f`。
   - **字体排版**：系统无衬线字体，大标题 1.25rem/400，正文 0.85~0.95rem/400。
   - **圆角与阴影**：主卡片 22px、子容器 14~16px、标签 12px，阴影使用暖沙色系 rgba。
   - **标签净化**：关联实体标签统一使用 `.report-tag` 轻沙配色，禁用彩色胶囊。
   - **无 Emoji**：禁止任何 Emoji，使用 Feather Icons 风格 SVG 替代。
   - **按钮样式**：使用 `.sand-btn` 水滴按钮样式。

3. 复制本技能预置的毛玻璃特效 HTML 模板：
   - **模板路径**：[报告模板 HTML](assets/report-template.html)
   - **目标路径**：拷贝到工作目录下，并按照**「品类 + 市场」**的规范进行命名（例如 `swim-cap-canadian-retail-insight.html`，符合短横线命名标准）。
4. **命名与标题规范（强制要求）**：
   - 网页标题 `<title>` 与正文 `<h1>` 的命名规则必须为：**`产品类别-产品关键词-市场-渠道调研报告`**。其中：产品类别必须根据 **`references/GTB产品结构.xlsx` 的 B 列（行业名称）** 获得（例如 `卫浴设备` 或 `照明产品`）；产品关键词为调研的品类名称（例如 `发光镜`）；市场为调研的区域（例如 `法国市场`）；渠道为目标渠道（例如 `安达屋`）。
5. **品牌与标识规范（强制要求）**：
   - 坚决移去任何 `Howstoday`、`Ningbo`、`昊特赛` 的文字与 Logo，全局替换为 **`Market Graphic`**。右上角 Logo 使用极简精致的矢量图表 SVG + `Market Graphic` 文字的组合（类名改为 `powered-by-mg`），不使用 Base64 图片以缩减文件体积。
6. **页脚与数据来源批注规范（强制要求）**：
   - 报告底部 `<footer>` 区域必须显著标明数据与信息来源（如欧盟符合性声明数据库、海关进口报关单与货运提单数据、渠道官方在架技术参数及用户评价等），且必须包含版权声明：**`本报告由 Market Graphic 生成并提供研究支持 © 2026 Market Graphic. 保留所有权利。`**
7. 将您在"第一步"中分析得出的品类对比矩阵、品牌与参数差异分析、消费者痛点、差距分析及研发建议数据填充到 HTML 中的对应占位符内。
8. 在 HTML 报告中的研发建议模块里，使用相对路径（如 `<img src="concept_1.png">`）临时引用刚刚拷贝过来的概念图。

### 第四步：执行图片 Base64 嵌入与清理

这是保证文件自包含和目录整洁的关键步骤。

1. 使用 `run_command`，调用本技能自带的 Python 脚本，对您刚刚生成的 HTML 报告执行图片内嵌和清理命令：

   ```bash
   python C:/Users/066/.gemini/config/skills/category-insight/scripts/embed_images.py <path/to/your/generated/html>
   ```

2. **嵌入与清理逻辑**：
   - 该脚本会自动读取 HTML 文件，将其引用的本地图片（如 `concept_1.png`）转换为 Base64 编码并内嵌替换，完成后的 HTML 文件单包双击即可完美预览全部图片。
   - 嵌入成功后，脚本会自动删除原本生成的临时 PNG 图片，确保工作目录下只保留唯一的最终 HTML 报告。

### 第五步：自动上传发布至平台（强制执行）

嵌入与清理完成后，**必须立即调用本技能自带的发布脚本，将生成的自包含 HTML 报告自动推送上传至平台**：

1. 使用 `run_command` 运行 `publish_report.py`：

   ```bash
   python C:/Users/066/.gemini/config/skills/category-insight/scripts/publish_report.py <path/to/your/generated/html>
   ```

   *例如*：

   ```bash
   python C:/Users/066/.gemini/config/skills/category-insight/scripts/publish_report.py d:\我的APP\品类洞察\eyebrow-lash-beauty-tools-us-tjmaxx-insight.html
   ```

2. **自动发布逻辑**：
   - 该脚本会自动读取 `d:\我的APP\Globaltradebuddy\.env` 中的 API 配置，提取 HTML 中的元数据与正文。
   - 自动向 `https://globaltradebuddy.vercel.app/api/agent/publish` 发送请求，将报告实时发布上线。
   - 终端打印 `[OK] Report published successfully! ID: ...` 即代表线上发布完成，向用户反馈发布 ID 与平台链接。

---

## 交付规范

- **命名规范**：最终报告文件必须以 `品类-市场-insight.html`（短横线命名）命名。
- **完整性**：必须包含品类矩阵、差异对比、痛点分析、差距诊断以及研发建议这五大结构。研发建议部分必须严格遵循反堆料控成本原则，并对每款产品完整覆盖【1. 消费群体/用户画像】、【2. 群体痛点】、【3. 开发建议】三要素。
- **整洁度**：确认工作目录里已成功清除了临时图片，除了生成的最终自包含 HTML 报告外，不留任何过程垃圾文件。
- **自动化上线**：必须确保报告已通过 `publish_report.py` 成功推送至 `https://globaltradebuddy.vercel.app` 平台并反馈 Report ID。
