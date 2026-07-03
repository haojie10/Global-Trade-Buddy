# 背景流光可视化控制面板设计规格说明书 (2026-06-29)

本规格说明书定义了首页背景流光（Ambient Glow）可视化调控面板的设计与实现，使用户能够在前台直接实时调节流光参数，以确定最佳的视觉对比度与 VI 色彩融合效果。

## 1. 设计目标

1. **可视化调节**：在首页提供一个精致小巧的悬浮面板，提供以下四个关键参数的滑块/下拉选择：
   - **不透明度 (Opacity)**：控制流光的色彩浓淡。
   - **模糊度 (Blur)**：控制流光的边缘扩散程度。
   - **混合模式 (Blend Mode)**：调控流光与暖乳白背景的化学叠加反应。
   - **光源大小 (Scale)**：调控流光的照射范围。
2. **极简 VI 风格**：面板采用暖米沙色背景、精致细边框、碳灰色细体字，彻底去除所有 Emoji 字符。支持一键展开/折叠以防遮挡主页内容。
3. **纯 CSS 变量驱动**：将 React 参数状态以 CSS 变量的形式注入到外层容器上，依靠 CSS 的自定义属性（Custom Properties）进行重绘渲染，保证极致的前端滑动流畅度。

---

## 2. 详细实现设计

### 2.1 CSS 变量引入 (`styles/globals.css`)
在 `.ambient-light` 样式类中接入 CSS 变量，当外部未传入变量时降级为当前设定的默认值：
- 模糊度：`filter: blur(var(--ambient-blur, 120px));`
- 不透明度：`opacity: var(--ambient-opacity, 0.12);`
- 混合模式：`mix-blend-mode: var(--ambient-blend-mode, multiply);`

为避免与流光平移飘移（`ambient-drift`）动画的 `transform` 属性产生冲突，不采用 `scale()` 变换，而是通过 `calc()` 直接控制各光源节点的宽高度：
- 光源 1：`width: calc(500px * var(--ambient-scale, 1)); height: calc(500px * var(--ambient-scale, 1));`
- 光源 2：`width: calc(600px * var(--ambient-scale, 1)); height: calc(600px * var(--ambient-scale, 1));`
- 光源 3：`width: calc(400px * var(--ambient-scale, 1)); height: calc(400px * var(--ambient-scale, 1));`

### 2.2 React 状态管理与注入 (`pages/index.tsx`)
在 `HomePage` 组件中定义如下状态：
```tsx
const [ambientOpacity, setAmbientOpacity] = useState(0.12);
const [ambientBlur, setAmbientBlur] = useState(120);
const [ambientBlendMode, setAmbientBlendMode] = useState('multiply');
const [ambientScale, setAmbientScale] = useState(1.0);
const [isGlowPanelExpanded, setIsGlowPanelExpanded] = useState(false);
```

将流光光源外层容器的样式绑定更新：
```tsx
<div className="ambient-glow-container" style={{
  '--ambient-opacity': ambientOpacity,
  '--ambient-blur': `${ambientBlur}px`,
  '--ambient-blend-mode': ambientBlendMode,
  '--ambient-scale': ambientScale,
} as React.CSSProperties}>
```

### 2.3 调控面板 UI 设计 (`pages/index.tsx`)
面板采用 `position: fixed` 固定在页面右下角（高于底部，低于主内容层，`zIndex: 9999`）。
- **折叠状态**：呈现为一个精致的小圆形按钮，文字为“调”。
- **展开状态**：呈现为一个卡片式面板（宽 240px），提供：
  - **不透明度滑块**：范围 `0.05` 至 `0.60`，步长 `0.01`。
  - **模糊度滑块**：范围 `50px` 至 `200px`，步长 `5px`。
  - **光源大小滑块**：范围 `0.5x` 至 `2.0x`，步长 `0.1`。
  - **混合模式下拉菜单**：包含 `normal` (推荐，可呈现透亮光晕)、`multiply` (现有)、`screen`、`overlay`。
  - **控制按钮组**：一键“重置”为系统默认参数，一键“收起”面板。

---

## 3. 自我审查 (Specs Review)

- **性能损耗**：由于使用的是 CSS 自定义属性更新（CSS Variables），滑动时不会引起 React 对页面内容组件（如报告列表等）进行大范围 DOM 重排（Reflow），只会触发 GPU 参与的光源 Canvas 混合图层重绘（Repaint），性能极高。
- **作用域**：该调试面板仅局限于首页 `pages/index.tsx` 内使用，完全不破坏其它的报告详情、网图页。
