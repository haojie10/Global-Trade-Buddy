# 🤝 MARKET GRAPHIC - 三视频滚动叙事 (Scrollytelling) 设计规格说明书

本设计文档旨在重新定义主页的视频滚动叙事方式，使用“三视频无缝过渡” + “固定视口沉浸式文案”方案，替换单视频进度绑定，提升视觉冲击力与产品表现力，并实现极致性能。

---

## 1. 核心需求与背景

- **目标**：在页面滚动过程中，使用三个独立的背景视频进行淡入淡出过渡，并在固定视口中展现四幕沉浸式产品介绍文案。
- **背景视频定义**：
  1. `intro_bg.mp4`：首屏静止/呼吸粒子流光视频（循环播放）。
  2. `main_bg.mp4`：随着滚动调整进度的核心数据结网视频（绑定滚动进度 seek 播放）。
  3. `outro_bg.mp4`：触底后展示的商业大脑平稳自转视频（循环播放）。
- **性能红线**：禁止因为滚动引发 React 的 Re-render。由于存在高频率的属性（`opacity`、`currentTime`、`transform`）修改，全部更新必须通过 `requestAnimationFrame` 直接写入 DOM。

---

## 2. 详细设计方案

### 2.1 CSS 布局结构 (DOM Layout)
- **大滚动层 (Scroll Container)**: 页面高度设置为 `min-height: 450vh`，从而产生可滚动区间。
- **固定背景视口 (Fixed Background Viewport)**:
  - 一个 `position: fixed` 的容器，高度宽度 `100vw/100vh`，在最底层 (`z-index: 1`)。
  - 容器内叠放三个 `<video>` 标签，初始设置 `opacity: 0`，并且绝对重叠，`object-fit: cover`。
  - 视频引用 `useRef`：`introRef`, `mainRef`, `outroRef`。
- **固定文案层 (Fixed Copy Overlay)**:
  - 一个 `position: fixed` 的文案容器，处于中层 (`z-index: 10`)。
  - 文案容器中包含四幕文案各自的 DOM 节点（或者用一个容器，直接用 JS 修改其内部子元素的 opacity 和 translate 等）。
  - 为了极高性能，我们通过 `useRef` 获取这四幕文案各自的 DOM，从而不依赖 React state。

### 2.2 滚动进度与缓动数据流 (Lerp & Mapping)
在 `useEffect` 中启动 `requestAnimationFrame`（简称 rAF）渲染循环，利用 Lerp 插值公式计算平滑的滚动进度：
`currentRenderPercent += (targetPercent - currentRenderPercent) * 0.08`

对于 `currentRenderPercent` (0.0 到 1.0) 映射规则如下：

#### A. 视频淡入淡出及状态控制
- **首屏阶段** (`currentRenderPercent === 0`)：
  - `intro` 视频可见（`opacity = 1`）并循环播放。`main` 和 `outro` 视频不可见（`opacity = 0`）并暂停播放。
- **首屏过渡** (`0 < currentRenderPercent < 0.05`)：
  - `intro` 视频渐隐（`opacity = 1 -> 0`）。
  - `main` 视频渐显（`opacity = 0 -> 1`）。
- **滚动主体** (`0.05 <= currentRenderPercent <= 0.93`)：
  - `main` 视频独占（`opacity = 1`），`intro` 与 `outro` 均 `opacity = 0` 并暂停。
  - `main` 视频的播放进度追随滚动进度：
    `mainVideo.currentTime = mainDuration * ((currentRenderPercent - 0.05) / 0.88)`。
- **收尾过渡** (`0.93 < currentRenderPercent < 0.98`)：
  - `main` 视频渐隐（`opacity = 1 -> 0`）。
  - `outro` 视频渐显（`opacity = 0 -> 1`）。
- **彻底触底** (`currentRenderPercent >= 0.98`)：
  - `outro` 视频可见（`opacity = 1`）并循环播放。`intro` 和 `main` 视频不可见（`opacity = 0`）并暂停播放。

#### B. 文案淡入淡出区间映射
- **第一幕（痛点）**：在 `0.0` ~ `0.2` 区间淡入淡出（最高点在 `0.1`）。
- **第二幕（能力）**：在 `0.25` ~ `0.55` 区间淡入淡出（最高点在 `0.4`）。
- **第三幕（图谱）**：在 `0.6` ~ `0.8` 区间淡入淡出（最高点在 `0.7`）。
- **第四幕（协同）**：在 `0.85` ~ `1.0` 渐显（最高点在 `1.0`）。

---

## 3. CPU 性能优化 (Performance Redlines)

1. **视频播放暂停管控**：
   - 只要视频的 `opacity === 0`，立刻调用 `.pause()`，释放 GPU 与 CPU 解码资源。
   - 只有在 `opacity > 0` 时，才调用 `.play()` 或更新进度。
2. **免重绘设计**：
   - 使用 `useRef` 直接操作原生 DOM 的 `style.opacity` 与 `style.transform`。
   - 移除原 `scrollY` 等频繁触发重新渲染的 React state。
3. **静音自动播放支持**：
   - 对所有的 `<video>` 设置 `muted` 与 `playsInline` 属性。
   - 对 `.play()` 的 Promise 进行 `.catch(() => {})` 捕获以防控制台报拒绝播放错误。

---

## 4. 验证与测试方法

### 4.1 单元测试与构建测试
- **构建检查**：执行 `npm run build` 确保无 TypeScript 或构建异常。
- **页面测试**：针对 `pages/story-demo.tsx` 的生命周期、事件绑定和 DOM 挂载逻辑编写测试。

### 4.2 手动验证清单
1. 滚动到首屏：验证 `intro_bg.mp4` 处于自动循环播放状态，其他视频均处于暂停状态。
2. 缓慢滚动：验证 `intro_bg.mp4` 与 `main_bg.mp4` 的 opacity 是否随进度平滑重叠渐变，没有突兀闪动。
3. 持续滚动：验证 `main_bg.mp4` 的 `currentTime` 能随滚动惯性平滑追随，文案淡入淡出伴随轻微的上移视差。
4. 滚动至底部：验证 `outro_bg.mp4` 顺利播放自转，同时 `main_bg.mp4` 自动暂停。
5. 检查控制台：确保无未捕获的 `DOMException` 错误。
