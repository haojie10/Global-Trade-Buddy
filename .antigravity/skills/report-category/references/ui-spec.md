# 市场图谱 App 视觉体验与 UI 规范

生成的所有 HTML 报告必须严格遵循以下 UI 规范，确保报告可直接上传至市场图谱 App 使用。

---

## 一、核心色彩体系（70-20-10 原则）

| CSS 变量名 | 色值 | 视觉权重 | 业务定位与设计意图 |
|------------|------|----------|-------------------|
| `--bg-main` | `#fdfbf7` | 70% | 主背景色：护眼极柔和暖乳白，作为报告网页的底色，传达高端纸张质感 |
| `--bg-sub` | `#f6f3ec` | 20% | 结构辅助色：无框容器承载色、输入框背景及二级卡片底色 |
| `--color-accent` | `#ff641e` | 10% | 焦点强调色：极富活力的暖阳橘（橘红），仅用于关键指标数据、高亮文字 |
| `--color-text` | `#3c3935` | - | 主要文字色：柔和石墨深灰，用于标题、段落正文 |
| `--color-muted` | `#7a756f` | - | 次要描述色：烟灰灰色，用于标注、表单 Label、辅助性提示文字 |

### 图谱关系与图例专用色

- **客户洞察 / 竞争 / 供销关系** 标识色：`#ff641e`（橘红色）
- **品类分析 / 经营 / 涉及关系** 标识色：`#7a756f`（烟灰色）

---

## 二、字体与排版规范

**字体系列：**
```css
font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
```

**字重分配：**
- 大标题：`font-size: 1.25rem; font-weight: 400`（细体）或 500
- 正文/小标题：`font-size: 0.85rem` 至 `0.95rem; font-weight: 400`
- 按钮与交互文字：`font-weight: 300` 或 500

**信息脱敏原则：** 报告中的 ID、密钥、编码等敏感/技术字符串必须隐藏或脱敏（如仅截取前 8 位加 `...` 呈现）。

---

## 三、结构、圆角与阴影

- **大板块/主卡片圆角：** `22px`
- **子容器/二级卡片圆角：** `14px ~ 16px`
- **标签/徽章圆角：** `12px`
- **细边框：** `border: 1px solid rgba(160, 109, 68, 0.08)` 或 `1px solid rgba(15, 23, 42, 0.06)`
- **默认阴影：** `box-shadow: 0 4px 12px rgba(160, 109, 68, 0.03);`
- **浮动卡片阴影：** `box-shadow: 0 6px 20px rgba(160, 109, 68, 0.02);`
- **悬停阴影：** `box-shadow: 0 6px 16px rgba(160, 109, 68, 0.08);`

---

## 四、标签组件与多色纯净化

所有关联实体标签（关联公司、相关品类、涉及渠道）不得使用彩色胶囊标签，必须使用以下轻沙配色：

```css
.report-tag {
  background: rgba(160, 109, 68, 0.05);
  color: #3c3935;
  border: 1px solid rgba(160, 109, 68, 0.15);
  padding: 4px 10px;
  border-radius: 12px;
  font-size: 0.75rem;
  font-weight: 500;
  display: inline-block;
}
```

---

## 五、无 Emoji 净化规则

- **坚决禁用 Emoji：** 无论标题、按钮、警告提示还是正文开头，禁止出现任何 Emoji 图标。
- **矢量图标替代：** 如需点缀图标，必须使用单色极细线条 SVG 矢量图形（推荐 Feather Icons 风格，`stroke-width="1.1"` 或 `1.5`，颜色随文字或焦点色变化）。

---

## 六、按钮交互规范

按钮不使用深重纯色填充，利用背景色反差实现呼吸感：

```css
.sand-btn {
  background: #f6f3ec;
  border: none;
  border-radius: 22px;
  color: #ff641e;
  padding: 10px 24px;
  font-weight: 300;
  box-shadow: 0 4px 12px rgba(160, 109, 68, 0.03);
  transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1);
  cursor: pointer;
  font-size: 0.85rem;
}
.sand-btn:hover {
  background: #fdfbf7;
  box-shadow: 0 6px 16px rgba(160, 109, 68, 0.08);
  transform: translateY(-1px);
}
```

---

## 七、概念产品图展示规范

研发建议卡片中的 AI 生成概念产品图，必须使用以下容器与图片样式，在"完整展示产品"与"饱满填充画面"之间取得平衡：

```css
.image-wrapper {
  position: relative;
  width: 100%;
  height: 280px;
  background: #1a1a1a;
  overflow: hidden;
}
.image-wrapper img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  object-position: center 30%;
  transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1);
}
```

| 属性 | 值 | 说明 |
|------|-----|------|
| 容器高度 | `280px` | 比紧凑模式多 60px 展示空间，避免产品主体被过度裁剪 |
| `object-fit` | `cover` | 填满容器不产生黑边，保持卡片视觉饱满 |
| `object-position` | `center 30%` | 焦点略偏上，优先展示镜子上半部分的设计细节 |

---

## 八、品牌标识与页脚官网链接规范

所有生成的 HTML 报告必须在以下两个位置完整展示 Market Graphic 品牌 Logo 与官方网址：

1. **头部标题区域右上角 (Header)**：
   - 包含 `Powered by` 说明文字紧随官方品牌 Logo 图标（以 Base64 内嵌），保持排版轻量紧凑，无需重复堆叠文字。
2. **报告底部 (Footer)**：
   - 底部不放置 Logo，保持极简纯粹；在最下方居中附带官方主站超链接：`<a href="https://marketgraphic.cn" target="_blank">www.marketgraphic.cn</a>`，样式采用品牌橘色 `#ff641e`。
