# 三视频滚动叙事 (Scrollytelling) 实现计划

> **面向 AI 代理的工作者：** 必需子技能：使用 superpowers:subagent-driven-development（推荐）或 superpowers:executing-plans 逐任务实现此计划。步骤使用复选框（`- [ ]`）语法来跟踪进度。

**目标：** 在 `pages/story-demo.tsx` 中实现高效的、零重绘的三视频无缝重叠淡入淡出与固定视口文案过渡滚动叙事系统。

**架构：** 使用一个 `position: fixed` 的全屏容器放置重叠的 3 个 `<video>` 标签，利用 `requestAnimationFrame` 驱动的原生 JS 滚动渲染循环来直接操作视频和四幕文案 DOM 的 `opacity`、`transform` 及 `currentTime` 属性，从而彻底释放 CPU 解码压力。

**技术栈：** Next.js, React, TypeScript, TailwindCSS, HTML5 Video API, RequestAnimationFrame.

---

### 任务 1：重构 `pages/story-demo.tsx` 背景视频与文案布局

**文件：**
- 修改：`pages/story-demo.tsx`

- [ ] **步骤 1：重构 DOM 结构与 Refs 绑定**
  重构 `pages/story-demo.tsx` 的 HTML 返回体：
  1. 使用绝对定位叠放三个 `<video>` (指向 `/intro_bg.mp4`、`/main_bg.mp4`、`/outro_bg.mp4`)。
  2. 使用 `position: fixed` 将四幕文案各自的容器固定在视口中。
  3. 为所有的视频和文案容器绑定 `useRef`。
  
  ```tsx
  // 绑定 Ref
  const introRef = useRef<HTMLVideoElement>(null);
  const mainRef = useRef<HTMLVideoElement>(null);
  const outroRef = useRef<HTMLVideoElement>(null);
  
  const sec1Ref = useRef<HTMLDivElement>(null);
  const sec2Ref = useRef<HTMLDivElement>(null);
  const sec3Ref = useRef<HTMLDivElement>(null);
  const sec4Ref = useRef<HTMLDivElement>(null);
  ```

- [ ] **步骤 2：重写 `useEffect` 滚动渲染循环逻辑**
  使用 `requestAnimationFrame` 实现平滑滚动追踪和精确的区间映射，剔除 React 渲染逻辑：
  
  ```tsx
  useEffect(() => {
    const introVideo = introRef.current;
    const mainVideo = mainRef.current;
    const outroVideo = outroRef.current;
    
    const sec1 = sec1Ref.current;
    const sec2 = sec2Ref.current;
    const sec3 = sec3Ref.current;
    const sec4 = sec4Ref.current;
  
    let targetPercent = 0;
    let currentRenderPercent = 0;
    let currentRenderTime = 0;
    let animationFrameId: number;
  
    const renderLoop = () => {
      // 1. Lerp 滚动百分比
      currentRenderPercent += (targetPercent - currentRenderPercent) * 0.08;
      
      const scrollPercent = currentRenderPercent;
  
      // 2. 视频淡入淡出及播放/暂停控制逻辑
      let introOpacity = 0;
      let mainOpacity = 0;
      let outroOpacity = 0;
  
      const mainDuration = mainVideo ? mainVideo.duration || 12 : 12;
  
      if (scrollPercent <= 0) {
        introOpacity = 1;
        if (introVideo && introVideo.paused) introVideo.play().catch(() => {});
        if (mainVideo && !mainVideo.paused) mainVideo.pause();
        if (outroVideo && !outroVideo.paused) outroVideo.pause();
      } else if (scrollPercent > 0 && scrollPercent < 0.98) {
        // 前 5% 从 intro 过渡到 main
        if (scrollPercent < 0.05) {
          const ratio = scrollPercent / 0.05;
          introOpacity = 1 - ratio;
          mainOpacity = ratio;
          if (introVideo && introVideo.paused) introVideo.play().catch(() => {});
          if (mainVideo && mainVideo.paused) mainVideo.play().catch(() => {});
        } 
        // 后 5% 从 main 过渡到 outro
        else if (scrollPercent > 0.93) {
          const ratio = (scrollPercent - 0.93) / 0.05;
          mainOpacity = 1 - ratio;
          outroOpacity = ratio;
          if (mainVideo && mainVideo.paused) mainVideo.play().catch(() => {});
          if (outroVideo && outroVideo.paused) outroVideo.play().catch(() => {});
        } 
        // 中间主体阶段只显示 main
        else {
          mainOpacity = 1;
          if (introVideo && !introVideo.paused) introVideo.pause();
          if (outroVideo && !outroVideo.paused) outroVideo.pause();
        }
  
        // 对 main 视频执行 currentTime 追随
        if (mainVideo && mainVideo.readyState >= 2) {
          const mainPercent = (scrollPercent - 0.05) / 0.88; // 归一化
          const targetTime = Math.max(0, Math.min(mainDuration - 0.05, mainPercent * mainDuration));
          currentRenderTime += (targetTime - currentRenderTime) * 0.08;
          mainVideo.currentTime = currentRenderTime;
        }
      } else {
        // 彻底触底，播放 outro
        outroOpacity = 1;
        if (outroVideo && outroVideo.paused) outroVideo.play().catch(() => {});
        if (introVideo && !introVideo.paused) introVideo.pause();
        if (mainVideo && !mainVideo.paused) mainVideo.pause();
      }
  
      // 应用视频 Opacity (原生修改)
      if (introVideo) introVideo.style.opacity = introOpacity.toString();
      if (mainVideo) mainVideo.style.opacity = mainOpacity.toString();
      if (outroVideo) outroVideo.style.opacity = outroOpacity.toString();
  
      // 3. 文案淡入淡出及位移控制逻辑
      const updateSection = (sec: HTMLDivElement | null, start: number, active: number, end: number, isLast = false) => {
        if (!sec) return;
        let opacity = 0;
        let translateY = 20; // 初始向下位移 20px
  
        if (scrollPercent >= start && scrollPercent <= end) {
          if (scrollPercent < active) {
            // 淡入段
            const ratio = (scrollPercent - start) / (active - start);
            opacity = ratio;
            translateY = 20 * (1 - ratio);
          } else {
            // 淡出段
            if (isLast) {
              opacity = 1;
              translateY = 0;
            } else {
              const ratio = (scrollPercent - active) / (end - active);
              opacity = 1 - ratio;
              translateY = -20 * ratio; // 向上飘出
            }
          }
        } else if (scrollPercent > end && !isLast) {
          opacity = 0;
          translateY = -20;
        }
  
        sec.style.opacity = opacity.toString();
        sec.style.transform = `translateY(${translateY}px)`;
        sec.style.display = opacity === 0 ? 'none' : 'block';
      };
  
      // 分配四幕的滚动百分比区间
      updateSection(sec1, 0.0, 0.08, 0.20);
      updateSection(sec2, 0.22, 0.38, 0.55);
      updateSection(sec3, 0.58, 0.70, 0.82);
      updateSection(sec4, 0.85, 0.95, 1.00, true);
  
      animationFrameId = requestAnimationFrame(renderLoop);
    };
  
    const handleScroll = () => {
      const scrollHeight = document.documentElement.scrollHeight;
      const clientHeight = window.innerHeight;
      const maxScroll = scrollHeight - clientHeight;
      if (maxScroll <= 0) return;
      targetPercent = window.scrollY / maxScroll;
    };
  
    window.addEventListener('scroll', handleScroll, { passive: true });
    animationFrameId = requestAnimationFrame(renderLoop);
  
    return () => {
      window.removeEventListener('scroll', handleScroll);
      cancelAnimationFrame(animationFrameId);
    };
  }, []);
  ```

---

### 任务 2：执行 TypeScript 编译与构建验证

- [ ] **步骤 1：本地编译检查**
  运行：`npx tsc --noEmit` (使用 BypassSandbox = true)
  预期：无 TypeScript 类型报错。

- [ ] **步骤 2：本地 Next 构建检查**
  运行：`npm run build` (使用 BypassSandbox = true)
  预期：打包成功，输出正常。
