# 🤝 MARKET GRAPHIC - MACBOOK 开发交接文档 (Handoff Brief)

  

本文件用于引导 Mac 端的开发智能体 (Agent)，使其能够无缝继承当前的开发状态，并直接开始“三段式 AI 视频背景滚动叙事”的核心开发工作。

  

---

  

## 📌 当前状态与已对齐的目标 (Current Status & Goal)

  

1. **项目技术栈**：Next.js + React + TypeScript + TailwindCSS。

2. **核心任务**：重新定义主页的视频滚动叙事 (Scrollytelling) 方式。由原先的单视频滚动，升级为**“三视频无缝过渡” + “固定视口沉浸式文案”**方案。

3. **视频存放状态**：

* 用户为了防止 GitHub 仓库因大文件膨胀，**没有**将 25MB 的原始大视频提交到 Git。

* 原始视频已保存在云盘中，用户回家后会在 MacBook 上进行本地压缩，再存入项目。

  

---

  

## 🚀 Mac 端第一步：下载并压制视频 (Mac Local Tasks)

  

在 Mac 上打开终端，执行以下步骤，以获得兼顾“高清晰度”与“极小体积”的网页背景视频：

  

```bash

# 1. 一键安装 FFmpeg

brew install ffmpeg

  

# 2. 进入 Mac 本地的项目 public 文件夹 (请替换为您 Mac 上的实际路径)

cd path/to/your/Globaltradebuddy/public

  

# 3. 压制云盘中下载好的 3 段原始视频 (去除音轨，CRF 24 视觉无损，统一小写)

ffmpeg -i Intro-loop.mp4 -an -vcodec libx264 -crf 24 -pix_fmt yuv420p -preset veryslow intro_bg.mp4

ffmpeg -i main.mp4 -an -vcodec libx264 -crf 24 -pix_fmt yuv420p -preset veryslow main_bg.mp4

ffmpeg -i Outro-loop.mp4 -an -vcodec libx264 -crf 24 -pix_fmt yuv420p -preset veryslow outro_bg.mp4

```

  

*压制完成后，仅保留 `intro_bg.mp4`、`main_bg.mp4`、`outro_bg.mp4` 三个文件在 `public/` 目录下。*

  

---

  

## 🛠️ 下一步开发任务 (Next Coding Task for Agent)

  

请直接在 Mac 本地修改或升级 [pages/story-demo.tsx](file:///d:/%E6%88%91%E7%9A%84APP/Globaltradebuddy/pages/story-demo.tsx)（后续需要迁移替代首页 `pages/index.tsx`）。

  

### 实现要求：

1. **Fixed 视口文案**：使用 `position: fixed` 让叙事文案在屏幕中固定，随滚动进度分配 opacity 渐隐渐现，实现完全沉浸式体验。

2. **三视频重叠与淡入淡出**：

* `intro_bg.mp4` (0% 滚动，首屏呼吸粒子循环)

* `main_bg.mp4` (滚动中，数据结网聚合，通过 Lerp 阻尼算法 seek `currentTime`)

* `outro_bg.mp4` (滚动到底 >=98%，商业大脑平稳自转循环)

* 通过 CSS `opacity` + `transition: opacity 0.5s` 进行无缝过渡。

3. **CPU 性能优化（关键）**：

* 为了防止三个视频同时加载/播放导致硬件卡顿，必须在视频不可见（`opacity = 0`）时，手动调用 `.pause()` 暂停其播放，仅在可见时调用 `.play()`。

* 使用 `useRef` 直接修改 DOM style 的 `opacity` 和 `currentTime`，**切勿**触发 React 的重绘 (re-render) 机制。

  

### 核心 React 控制逻辑参考代码：

```tsx

const renderLoop = () => {

const introVideo = introRef.current;

const mainVideo = mainRef.current;

const outroVideo = outroRef.current;

  

// 滚动进度百分比 (0 到 1)

const scrollPercent = targetPercent;

currentRenderTime += (targetTime - currentRenderTime) * 0.08; // Lerp 缓动

  

let introOpacity = 0;

let mainOpacity = 0;

let outroOpacity = 0;

  

if (scrollPercent === 0) {

introOpacity = 1;

if (introVideo && introVideo.paused) introVideo.play().catch(() => {});

if (outroVideo && !outroVideo.paused) outroVideo.pause();

} else if (scrollPercent > 0 && scrollPercent < 0.98) {

if (scrollPercent < 0.05) { // 前5%过渡

const ratio = scrollPercent / 0.05;

introOpacity = 1 - ratio;

mainOpacity = ratio;

} else if (scrollPercent > 0.93) { // 后5%过渡

const ratio = (scrollPercent - 0.93) / 0.05;

mainOpacity = 1 - ratio;

outroOpacity = ratio;

} else {

mainOpacity = 1;

}

  

if (introVideo && !introVideo.paused) introVideo.pause();

if (outroVideo && !outroVideo.paused) outroVideo.pause();

if (mainVideo && mainVideo.readyState >= 2) {

mainVideo.currentTime = currentRenderTime;

}

} else { // 彻底触底

outroOpacity = 1;

if (outroVideo && outroVideo.paused) outroVideo.play().catch(() => {});

if (introVideo && !introVideo.paused) introVideo.pause();

}

  

// 修改 DOM 以保持极致性能

if (introVideo) introVideo.style.opacity = introOpacity.toString();

if (mainVideo) mainVideo.style.opacity = mainOpacity.toString();

if (outroVideo) outroVideo.style.opacity = outroOpacity.toString();

  

animationFrameId = requestAnimationFrame(renderLoop);

};

```