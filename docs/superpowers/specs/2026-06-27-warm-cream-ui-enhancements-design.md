# Warm Cream 视觉质感精细化增强设计规范

本规范旨在通过精细的 UI 增强手段，打破扁平单调感，为 Globaltradebuddy 项目现有的 **Warm Cream** 配色注入空间层级感、物理呼吸感与排版高级感。

## 视觉增强核心模块

### 1. 温暖渐变背景 (Soft Gradients)
- **目标**：废除纯平单调背景，通过微弱的暖光晕和渐变，形成光影流动的温暖氛围。
- **改动位置**：`styles/globals.css` 中的 `body` 样式。
- **具体设计**：
  ```css
  body {
    background: 
      radial-gradient(circle at 10% 10%, rgba(255, 100, 30, 0.015) 0%, transparent 40%),
      radial-gradient(circle at 90% 90%, rgba(255, 100, 30, 0.01) 0%, transparent 40%),
      linear-gradient(135deg, #fdfbf7 0%, #f5f0eb 100%) !important;
  }
  ```

### 2. 悬浮毛玻璃图层 (Glassmorphism UI)
- **目标**：对页面中所有 sticky 头部导航栏、控制面板实施毛玻璃穿透效果，实现前/后景的图层分离。
- **改动位置**：
  - `pages/index.tsx` 的 `<header>` 元素样式。
  - `pages/my-graph.tsx` 的侧边控制面板（Sliders/Color Pickers 面板）样式。
- **具体设计**：
  - 背景使用含透明度的辅助色：`background: "rgba(246, 243, 236, 0.75)"` 或 `background: "rgba(253, 251, 247, 0.75)"`。
  - 属性注入：`backdropFilter: "blur(20px)"`, `WebkitBackdropFilter: "blur(20px)"`。

### 3. 橘色发光微影 (Vibrant Accent Glow)
- **目标**：为交互元素（如高亮卡片边框、重点按钮）添加软橘色发光投影，提供高品质交互兴奋点。
- **改动位置**：
  - `styles/globals.css` 中的 `.sand-btn:hover`, `.water-drop-btn:hover`。
  - `components/ReportList.tsx` 中各研报卡片的 hover 状态。
  - `pages/reports/[id].tsx` 解锁按钮的 hover 状态。
- **具体设计**：
  - 悬停发光微影：`box-shadow: 0 0 15px rgba(255, 100, 30, 0.12), 0 6px 16px rgba(160, 109, 68, 0.06)`。

### 4. 非线性物理微动效 (Hover Float Animations)
- **目标**：使用阻尼弹簧曲线，使交互元素悬停时获得极其自然、轻盈的浮起效果。
- **改动位置**：
  - `styles/globals.css` 中的过渡动效定义。
  - 更新各页面卡片及按钮的 `transition` 为：`all 0.4s cubic-bezier(0.16, 1, 0.3, 1)`。
- **具体设计**：
  - 卡片悬停：`transform: translateY(-4px)`。

### 5. 精英报刊级排版 (Editorial Typography & Kerning)
- **目标**：全局载入专业字体栈，打磨大标题字间距，建立高雅的主副标题字重对比。
- **改动位置**：
  - `pages/_document.tsx` (或者 `pages/_app.tsx` 如果没有 document) 中注入 Google Fonts。
  - `styles/globals.css` 中重写字体映射。
- **具体设计**：
  - 引入字体：`Outfit` (无衬线字重 300, 400, 500, 600) 与 `Playfair Display` (衬线字重 400, 600)。
  - 全局默认字体设为 `'Outfit', -apple-system, BlinkMacSystemFont, sans-serif`。
  - 特色大标题、引言和研报正文标题在合适位置混搭使用 `'Playfair Display', Georgia, serif`，并打磨紧缩字间距 `letter-spacing: -0.02em`。

---

## 涉及文件清单

### [MODIFY] [globals.css](file:///Users/jason/Documents/Antigravity/Project/Globaltradebuddy/styles/globals.css)
- 添加 `Outfit` 和 `Playfair Display` 字体定义导入。
- 重置 `body` 背景为 135deg 双 radial 混合渐变。
- 定义全局缓动动效及 hover 发光类。

### [MODIFY] [index.tsx](file:///Users/jason/Documents/Antigravity/Project/Globaltradebuddy/pages/index.tsx)
- 优化头部导航栏为毛玻璃悬浮效果。
- 对大标题应用精细紧缩字距与精英字体字重。

### [MODIFY] [my-graph.tsx](file:///Users/jason/Documents/Antigravity/Project/Globaltradebuddy/pages/my-graph.tsx)
- 优化右侧滑动面板与图谱样式控制抽屉，使用高雅毛玻璃背景层。
- 对控制滑块和取色器应用软发光和 Scheme B 橘色强调轨。

### [MODIFY] [[id].tsx](file:///Users/jason/Documents/Antigravity/Project/Globaltradebuddy/pages/reports/%5Bid%5D.tsx)
- 研报详情页的面包屑与解锁卡片支持发光、毛玻璃及物理微浮动效。

### [MODIFY] [ReportList.tsx](file:///Users/jason/Documents/Antigravity/Project/Globaltradebuddy/components/ReportList.tsx)
- 优化卡片悬浮曲线和轻微发光外框。

---

## 验证与测试标准
- 运行 `npx tsc --noEmit` 保证 TypeScript 零报错。
- 运行 `npx vitest run --fileParallelism=false` 确保所有 81 个单元测试全数通过，无任何界面逻辑 regression。
