# 背景流光可视化调控面板实现计划

> **对于 Agent 工作者：** 必需的子技能：推荐使用 `sp-subagent-driven-development` 或 `sp-executing-plans` 来逐个任务实现此计划。步骤使用复选框 (`- [ ]`) 语法以便追踪。

**目标:** 在首页集成流光背景控制面板，使用户可以在前台实时调节不透明度、模糊值、混合模式与比例。
**架构:** 
- 修改 `styles/globals.css` 将背景光源的模糊度、透明度、混合模式与光源大小绑定到 CSS 变量。
- 修改 `pages/index.tsx` 新增调控状态，并注入 CSS 变量；在页面右下角渲染一个可折叠的暖沙色调控控制面板。
**技术栈:** Next.js + React + CSS Variables

---

## 任务 1：升级 styles/globals.css 支持流光 CSS 变量

- [ ] **步骤 1：重构 `.ambient-light` 与光源宽高的 CSS 样式**
  修改 `styles/globals.css` 中第 183-218 行的流光参数，使其支持 React 传入的自定义 CSS 自定义属性（CSS Variables），同时在未传入时优雅降级为当前设定的默认值。
  ```css
  /* 修改前 */
  .ambient-light {
    position: absolute;
    border-radius: 50%;
    filter: blur(120px);
    opacity: var(--ambient-opacity, 0.12);
    mix-blend-mode: multiply;
    pointer-events: none;
  }

  .ambient-light-1 {
    background: radial-gradient(circle, var(--color-accent) 0%, rgba(255, 100, 30, 0) 70%);
    width: 500px;
    height: 500px;
    top: -100px;
    left: -100px;
    animation: ambient-drift 28s ease-in-out infinite alternate;
  }

  .ambient-light-2 {
    background: radial-gradient(circle, #e2bb97 0%, rgba(226, 187, 151, 0) 70%);
    width: 600px;
    height: 600px;
    bottom: -200px;
    right: -100px;
    animation: ambient-drift-reverse 32s ease-in-out infinite alternate;
  }

  .ambient-light-3 {
    background: radial-gradient(circle, var(--color-accent) 0%, rgba(255, 100, 30, 0) 70%);
    width: 400px;
    height: 400px;
    top: 40%;
    right: 15%;
    opacity: calc(var(--ambient-opacity, 0.12) * 0.5);
    animation: ambient-drift 24s ease-in-out infinite alternate-reverse;
  }

  /* 修改后 */
  .ambient-light {
    position: absolute;
    border-radius: 50%;
    filter: blur(var(--ambient-blur, 120px));
    opacity: var(--ambient-opacity, 0.12);
    mix-blend-mode: var(--ambient-blend-mode, multiply);
    pointer-events: none;
  }

  .ambient-light-1 {
    background: radial-gradient(circle, var(--color-accent) 0%, rgba(255, 100, 30, 0) 70%);
    width: calc(500px * var(--ambient-scale, 1));
    height: calc(500px * var(--ambient-scale, 1));
    top: -100px;
    left: -100px;
    animation: ambient-drift 28s ease-in-out infinite alternate;
  }

  .ambient-light-2 {
    background: radial-gradient(circle, #e2bb97 0%, rgba(226, 187, 151, 0) 70%);
    width: calc(600px * var(--ambient-scale, 1));
    height: calc(600px * var(--ambient-scale, 1));
    bottom: -200px;
    right: -100px;
    animation: ambient-drift-reverse 32s ease-in-out infinite alternate;
  }

  .ambient-light-3 {
    background: radial-gradient(circle, var(--color-accent) 0%, rgba(255, 100, 30, 0) 70%);
    width: calc(400px * var(--ambient-scale, 1));
    height: calc(400px * var(--ambient-scale, 1));
    top: 40%;
    right: 15%;
    opacity: calc(var(--ambient-opacity, 0.12) * 0.5);
    animation: ambient-drift 24s ease-in-out infinite alternate-reverse;
  }
  ```

---

## 任务 2：重构 pages/index.tsx 引入 React 状态与调控组件

- [ ] **步骤 1：引入流光调控 React 状态**
  在 `pages/index.tsx` 的 `HomePage` 组件头部（第 22 行之后）加入状态声明：
  ```tsx
  const [ambientOpacity, setAmbientOpacity] = useState(0.12);
  const [ambientBlur, setAmbientBlur] = useState(120);
  const [ambientBlendMode, setAmbientBlendMode] = useState('multiply');
  const [ambientScale, setAmbientScale] = useState(1.0);
  const [isGlowPanelExpanded, setIsGlowPanelExpanded] = useState(false);
  ```

- [ ] **步骤 2：将 CSS 变量注入光源容器中**
  修改 `pages/index.tsx` 约第 117-122 行的光源容器，增加动态 `style` 绑定。
  ```tsx
  // 修改前
  <div className="ambient-glow-container">
    <div className="ambient-light ambient-light-1" />
    <div className="ambient-light ambient-light-2" />
    <div className="ambient-light ambient-light-3" />
  </div>

  // 修改后
  <div className="ambient-glow-container" style={{
    '--ambient-opacity': ambientOpacity,
    '--ambient-blur': `${ambientBlur}px`,
    '--ambient-blend-mode': ambientBlendMode,
    '--ambient-scale': ambientScale
  } as React.CSSProperties}>
    <div className="ambient-light ambient-light-1" />
    <div className="ambient-light ambient-light-2" />
    <div className="ambient-light ambient-light-3" />
  </div>
  ```

- [ ] **步骤 3：在页面底部渲染控制器面板**
  在 `pages/index.tsx` 的最后一个返回容器 `</div>` 之前（约最后一行前），渲染悬浮调试面板，样式遵循 VI 且无 Emoji。
  ```tsx
  {/* 流光调试面板 (仅用于调整对比度，风格对齐系统VI，无Emoji) */}
  <div style={{
    position: 'fixed',
    bottom: '24px',
    right: '24px',
    zIndex: 9999,
    fontFamily: 'system-ui, -apple-system, sans-serif'
  }}>
    {!isGlowPanelExpanded ? (
      <button
        onClick={() => setIsGlowPanelExpanded(true)}
        className="sand-btn"
        style={{
          width: '42px',
          height: '42px',
          borderRadius: '50%',
          padding: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: '0 8px 24px rgba(160, 109, 68, 0.12)',
          border: '1px solid rgba(160, 109, 68, 0.15)'
        }}
        title="展开流光控制器"
      >
        调
      </button>
    ) : (
      <div style={{
        width: '260px',
        background: 'rgba(253, 251, 247, 0.96)',
        backdropFilter: 'blur(16px)',
        border: '1px solid rgba(160, 109, 68, 0.15)',
        borderRadius: '16px',
        padding: '16px',
        boxShadow: '0 12px 36px rgba(160, 109, 68, 0.08)',
        display: 'flex',
        flexDirection: 'column',
        gap: '12px'
      }}>
        <div style={{ display: 'flex', justifycontent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(160, 109, 68, 0.08)', paddingBottom: '8px' }}>
          <span style={{ fontSize: '0.8rem', fontWeight: 500, color: 'var(--color-text)' }}>背景流光调节</span>
          <button 
            onClick={() => setIsGlowPanelExpanded(false)}
            style={{ background: 'none', border: 'none', color: 'var(--color-muted)', cursor: 'pointer', fontSize: '0.75rem', padding: 0 }}
          >
            收起
          </button>
        </div>

        {/* 不透明度 */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          <div style={{ display: 'flex', justifycontent: 'space-between', fontSize: '0.7rem', color: 'var(--color-muted)' }}>
            <span>不透明度 (Opacity)</span>
            <span>{ambientOpacity.toFixed(2)}</span>
          </div>
          <input 
            type="range" 
            min="0.05" 
            max="0.60" 
            step="0.01" 
            value={ambientOpacity} 
            onChange={e => setAmbientOpacity(parseFloat(e.target.value))}
            style={{ accentColor: 'var(--color-accent)', cursor: 'pointer', width: '100%' }}
          />
        </div>

        {/* 模糊度 */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          <div style={{ display: 'flex', justifycontent: 'space-between', fontSize: '0.7rem', color: 'var(--color-muted)' }}>
            <span>模糊度 (Blur)</span>
            <span>{ambientBlur}px</span>
          </div>
          <input 
            type="range" 
            min="50" 
            max="200" 
            step="5" 
            value={ambientBlur} 
            onChange={e => setAmbientBlur(parseInt(e.target.value))}
            style={{ accentColor: 'var(--color-accent)', cursor: 'pointer', width: '100%' }}
          />
        </div>

        {/* 大小缩放 */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          <div style={{ display: 'flex', justifycontent: 'space-between', fontSize: '0.7rem', color: 'var(--color-muted)' }}>
            <span>光源大小 (Scale)</span>
            <span>{ambientScale.toFixed(1)}x</span>
          </div>
          <input 
            type="range" 
            min="0.5" 
            max="2.0" 
            step="0.1" 
            value={ambientScale} 
            onChange={e => setAmbientScale(parseFloat(e.target.value))}
            style={{ accentColor: 'var(--color-accent)', cursor: 'pointer', width: '100%' }}
          />
        </div>

        {/* 混合模式 */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          <span style={{ fontSize: '0.7rem', color: 'var(--color-muted)' }}>混合模式 (Blend Mode)</span>
          <select 
            value={ambientBlendMode} 
            onChange={e => setAmbientBlendMode(e.target.value)}
            style={{
              padding: '6px',
              borderRadius: '8px',
              border: '1px solid rgba(160, 109, 68, 0.15)',
              background: 'var(--bg-main)',
              color: 'var(--color-text)',
              fontSize: '0.75rem',
              outline: 'none',
              cursor: 'pointer'
            }}
          >
            <option value="normal">normal (推荐: 鲜亮光晕)</option>
            <option value="multiply">multiply (默认: 相乘暗淡)</option>
            <option value="screen">screen (滤色)</option>
            <option value="overlay">overlay (叠加)</option>
          </select>
        </div>

        {/* 重置 */}
        <button
          onClick={() => {
            setAmbientOpacity(0.12);
            setAmbientBlur(120);
            setAmbientBlendMode('multiply');
            setAmbientScale(1.0);
          }}
          className="sand-btn"
          style={{
            width: '100%',
            padding: '8px 0',
            fontSize: '0.75rem',
            border: '1px solid rgba(160, 109, 68, 0.15)'
          }}
        >
          恢复系统默认
        </button>
      </div>
    )}
  </div>
  ```

---

## 4. 验证计划

1. **静态类型验证**
   运行 `npx.cmd tsc --noEmit` 确保没有 TypeScript 语法或导入的错误。
2. **调试功能验证**
   本地启动开发服务器，打开首页，展开右下角“调”控制按钮，拉动滑块（Opacity、Blur、Scale、Blend Mode）看背景流光效果是否产生实时变化，并检验是否有视觉卡顿。
