# Globaltradebuddy UI 视觉重构规格说明 (方案 B 暖乳白)

本规格说明定义了将网页 UI 重构为高级、温润纸张风格的设计规范和实施路径。去除所有冗余的 Emoji 表情符号，去掉所有实体边框线，换用 1px 极细线条 SVG 图标，极大改善长时间使用的眼部疲劳。

## 1. 631 配色与排版系统规范

界面完全基于 CSS 变量进行定制，利用黄金比例建立清新的层次。

### 1.1 CSS 变量配置
我们将以下变量声明在 `styles/globals.css` 的 `:root` 中：

```css
:root {
  --bg-main: #fdfbf7;      /* 主背景色 (70%): 护眼暖乳白 */
  --bg-sub: #f6f3ec;       /* 结构辅助色 (20%): 无框承载色 */
  --color-accent: #ff641e; /* 焦点强调色 (10%): 极富活力的暖阳橘 */
  --color-text: #3c3935;   /* 主要文字: 柔和石墨深灰 */
  --color-muted: #7a756f;  /* 次要文字: 烟灰次要描述 */
  
  --btn-font-weight: 300;      /* 按钮与交互文字字重: 极细 Light */
  --btn-letter-spacing: 0px;   /* 按钮字间距 */
  --border-radius: 22px;       /* 柔和高级的圆角大小 */
}
```

### 1.2 页面背景质感
- 移除原本冷灰蓝的星云渐变背景。
- 背景采用纯净无暇的暖乳白纸张底色（`#fdfbf7`），不添加多余的杂质与冷光，确保版面视觉处于极致素净的状态。

---

## 2. 界面设计规范与去边框策略

### 2.1 无边框 (Border-free) 原则
- **去除实体线条**：删除全站所有的 `1px solid rgba(15, 23, 42, 0.08)` 或类似的边框。
- **结构分割方式**：
  1. 使用比背景微深的结构辅助底色（`#f6f3ec`）填充区域（如导航栏背景、卡片背景、输入框底色）；
  2. 配合极淡的边缘弥散柔影：
     `box-shadow: 0 10px 40px rgba(160, 109, 68, 0.02)`，来建立无物理边界的空间感。

### 2.2 按钮与输入框调优
- **按钮**：去掉边框。默认状态背景使用 `--bg-sub` 或 `--color-accent`，字重设为 `300` 细体。Hover 时提供轻微的色深过渡或微影交互反馈。
- **输入框与 Select**：背景采用 `--bg-sub`，去掉 1px border，圆角统一为 `12px` 确保跟整体排版契合，聚焦（Focus）时利用微弱的强调色阴影（如 `box-shadow: 0 0 0 2px var(--color-accent)22`）提供焦点反馈。

---

## 3. 图标与文字规范 (去 Emoji 与 SVG 纤细化)

### 3.1 彻底剥离 Emoji
删除页面中所有的 Emoji（如 🌐, 🕸️, 👑, 👥, 🔑, 🚪, 👤, 🔐, 🪙, 📊, 🔍, ✨, ✅, 🔒, 📭 等），仅保留纯粹高级的文字排版，配合功能性极细 SVG 图标。

### 3.2 1px 细线条 SVG 图标规范
所有起指引、装饰作用的图标，均统一替换为 1px（部分可为 1.1px / 1.2px 以保易读）描边的极细 SVG 矢量线性图标。
- **地球仪 (🌐)**：`<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.1" stroke-linecap="round" stroke-linejoin="round">...</svg>`
- **知识拓扑 (🕸️)**：带有圆点和极细连接线的网图。
- **结汇金币 (🪙)**：极细双线钱币 SVG。
- **报告折线 (📊)**：极细折线与坐标轴 SVG。
- **海关检索 (🔍)**：1px 极细放大镜 SVG。
- **管理员 (👑)**：1px 细线皇冠 SVG。
- **上传 (📤)**：1px 细线上穿箭头 SVG。
- **额度/锁 (🔓 / 🔒)**：1px 细线锁头 SVG。
- **退出 (🚪)**：1px 细线退出门 SVG。
- **用户 (👤)**：1px 细线人像 SVG。

---

## 4. 重构文件与代码范围

我们将对以下核心文件进行渐进式重构：

1. **[globals.css](file:///Users/jason/Documents/Antigravity/Project/Globaltradebuddy/styles/globals.css)**
   - 声明全局 HSL / Hex 变量系统。
   - 移除旧的行星浮动动画样式或将其重写为适配暖调的极简动画。
   - 重构 `.water-drop-btn`（改名为 `.sand-btn`）和 `.floating-card`，消除边框线，调整字重和阴影。

2. **[index.tsx](file:///Users/jason/Documents/Antigravity/Project/Globaltradebuddy/pages/index.tsx)**
   - 替换星云渐变背景。
   - 清除 Hero 区悬浮卡片、小提示、导航栏、登录弹窗内的全部 Emoji。
   - 绘制并嵌入对应功能的 1px SVG 线条图标。
   - 移除行内 style 中的所有 `border` 属性，将其替换为基于变量的背景与柔和阴影组合。
   - 更新登录弹窗的毛玻璃背景色调，使其完美契合暖白色。

3. **[ReportList.tsx](file:///Users/jason/Documents/Antigravity/Project/Globaltradebuddy/components/ReportList.tsx)**
   - 去除筛选栏输入框、下拉框的边框与 emoji。
   - 重构报告卡片：去边框、调整圆角（22px）、鼠标悬浮（Hover）时去掉边框高亮变蓝的逻辑，改用背景淡色变化与优雅深影过渡。
   - 去除“已解锁”及“未解锁”卡片状态中的 emoji，改用极细线矢量状态图。

4. **[my-graph.tsx](file:///Users/jason/Documents/Antigravity/Project/Globaltradebuddy/pages/my-graph.tsx)**
   - 同步修改背景色和导航栏样式。

---

## 5. 验证与回归方案

1. **本地环境验证**：
   - 运行 `npm run dev` 启动开发服务器。
   - 进入 `http://localhost:3000` 仔细校对各个层级与组件的文字、按钮、圆角。
2. **细节自检清单**：
   - [ ] 页面背景是否已完全变成 `#fdfbf7` 的暖乳白，星云渐变是否被彻底清除？
   - [ ] 全站页面中是否还有遗留的 Emoji？（尤其是分类、筛选、解锁状态）
   - [ ] 所有的实体框线是否已经全部被无框微影或辅助色背景取代？
   - [ ] 按钮上的字体是否变成了优雅的极细体，字距是否合理？
   - [ ] SVG 描边是否统一为 1px ~ 1.2px 极细质感？
