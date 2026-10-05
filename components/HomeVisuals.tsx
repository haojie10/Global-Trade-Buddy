import React, { useEffect, useRef } from 'react';

/**
 * 第 1 幕：360° 商业生态「对焦」视图
 * 视觉语言：取景框 ⌜●⌝（呼应 MG Logo）→ 对角线生长 → 四大节点点亮 → 持续脉冲与数据流
 * 动画随 display:none→flex 切换自动重放，无需 JS 驱动。
 */
export function EcosystemRadar() {
  const W = 520;
  const H = 440;
  const cx = 260;
  const cy = 220;
  const f = 36; // 取景框半宽
  const d = 110; // 节点到中心的对角偏移

  const nodes = [
    { key: 'up', dx: -1, dy: -1, zh: '上游', en: 'Suppliers', sub: '原料 · 工厂 · 供应商' },
    { key: 'down', dx: 1, dy: -1, zh: '下游', en: 'Retailers', sub: '零售 · 分销 · 终端' },
    { key: 'comp', dx: -1, dy: 1, zh: '竞争者', en: 'Competitors', sub: '同业 · 替代 · 新进入者' },
    { key: 'chan', dx: 1, dy: 1, zh: '渠道', en: 'Channels', sub: '线上 · 线下 · 跨境' }
  ];

  // 伪世界点阵：按行列生成点，用大陆轮廓椭圆做粗略掩膜（纯装饰）
  const blobs = [
    { x: 120, y: 120, rx: 90, ry: 55 }, // 北美
    { x: 190, y: 300, rx: 40, ry: 70 }, // 南美
    { x: 285, y: 130, rx: 55, ry: 40 }, // 欧洲
    { x: 305, y: 250, rx: 50, ry: 75 }, // 非洲
    { x: 400, y: 150, rx: 100, ry: 65 }, // 亚洲
    { x: 450, y: 320, rx: 40, ry: 28 } // 大洋洲
  ];
  const dots: { x: number; y: number }[] = [];
  for (let y = 40; y < H - 20; y += 14) {
    for (let x = 14; x < W - 10; x += 14) {
      const inside = blobs.some(b => ((x - b.x) / b.rx) ** 2 + ((y - b.y) / b.ry) ** 2 <= 1);
      if (inside) dots.push({ x, y });
    }
  }

  return (
    <div className="gtb-radar" style={{ position: 'relative', width: '100%', maxWidth: `${W}px`, aspectRatio: `${W} / ${H}`, margin: '0 auto' }}>
      <style dangerouslySetInnerHTML={{ __html: `
        .gtb-radar { --o: #ff641e; --o2: #ff8a50; --o3: #c2410c; --ink: #1a1613; }
        @keyframes gtbFocusIn { from { transform: scale(2.3); opacity: 0; filter: blur(8px); } to { transform: scale(1); opacity: 1; filter: blur(0); } }
        @keyframes gtbDraw { to { stroke-dashoffset: 0; } }
        @keyframes gtbPop { from { transform: scale(0); opacity: 0; } to { transform: scale(1); opacity: 1; } }
        @keyframes gtbCardIn { from { opacity: 0; transform: translateY(14px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes gtbRipple { 0% { r: 44; opacity: 0.45; } 100% { r: 230; opacity: 0; } }
        @keyframes gtbCore { 0%, 100% { transform: scale(1); } 50% { transform: scale(1.22); } }
        @keyframes gtbOrbit { to { transform: rotate(360deg); } }
        @keyframes gtbMapIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes gtbFloat { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-4px); } }

        .gtb-radar .map { animation: gtbMapIn 1.2s ease both; }
        .gtb-radar .frame { transform-origin: ${cx}px ${cy}px; animation: gtbFocusIn 1s cubic-bezier(.2,.9,.3,1) .15s both; }
        .gtb-radar .core { transform-origin: ${cx}px ${cy}px; animation: gtbCore 2.2s ease-in-out 1.2s infinite; }
        .gtb-radar .ripple { fill: none; stroke: var(--o); stroke-width: 1.2; animation: gtbRipple 4.2s ease-out infinite; }
        .gtb-radar .spoke { stroke: var(--o); stroke-width: 1.4; stroke-dasharray: 1; stroke-dashoffset: 1; animation: gtbDraw .9s ease-out both; }
        .gtb-radar .node { transform-box: fill-box; transform-origin: center; animation: gtbPop .45s cubic-bezier(.3,1.6,.5,1) both; }
        .gtb-radar .orbit { transform-origin: ${cx}px ${cy}px; animation: gtbOrbit 28s linear infinite; }
        .gtb-radar .card {
          position: relative; width: 150px; padding: 9px 14px; border-radius: 12px;
          background: rgba(255,255,255,.86); backdrop-filter: blur(10px);
          border: 1px solid rgba(255,100,30,.28);
          box-shadow: 0 1px 2px rgba(120,60,20,.06), 0 8px 18px rgba(120,60,20,.08), 0 22px 44px rgba(255,100,30,.10);
          animation: gtbCardIn .7s cubic-bezier(.2,.9,.3,1) both;
        }
        .gtb-radar .card .inner { animation: gtbFloat 6s ease-in-out infinite; }
        .gtb-radar .card i { position: absolute; width: 8px; height: 8px; border: 1.5px solid var(--o); }
        .gtb-radar .card i.tl { top: 4px; left: 4px; border-right: 0; border-bottom: 0; }
        .gtb-radar .card i.tr { top: 4px; right: 4px; border-left: 0; border-bottom: 0; }
        .gtb-radar .card i.bl { bottom: 4px; left: 4px; border-right: 0; border-top: 0; }
        .gtb-radar .card i.br { bottom: 4px; right: 4px; border-left: 0; border-top: 0; }
        .gtb-radar .card b { display: block; font-size: 15px; font-weight: 700; color: var(--ink); letter-spacing: -0.01em; line-height: 1.2; }
        .gtb-radar .card em { display: block; font-style: normal; font-size: 10px; letter-spacing: .14em; text-transform: uppercase; color: var(--o3); font-weight: 600; margin-top: 2px; }
        .gtb-radar .card small { display: block; font-size: 10.5px; color: #8a7d70; margin-top: 4px; white-space: nowrap; }
        @media (max-width: 900px) { .gtb-radar .card { width: 118px; padding: 7px 9px 7px 11px; } .gtb-radar .card small { display: none; } }
        @media (prefers-reduced-motion: reduce) {
          .gtb-radar *, .gtb-radar .card { animation-duration: 0.01ms !important; animation-iteration-count: 1 !important; }
        }
      ` }} />

      <svg viewBox={`0 0 ${W} ${H}`} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', overflow: 'visible' }}>
        <defs>
          <radialGradient id="gtbGlow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#ff641e" stopOpacity="0.30" />
            <stop offset="55%" stopColor="#ff8a50" stopOpacity="0.09" />
            <stop offset="100%" stopColor="#ff641e" stopOpacity="0" />
          </radialGradient>
          <radialGradient id="gtbCoreFill" cx="35%" cy="35%" r="75%">
            <stop offset="0%" stopColor="#ffb089" />
            <stop offset="100%" stopColor="#ff641e" />
          </radialGradient>
          <radialGradient id="gtbMapFade" cx="50%" cy="50%" r="50%">
            <stop offset="55%" stopColor="#fff" stopOpacity="1" />
            <stop offset="100%" stopColor="#fff" stopOpacity="0" />
          </radialGradient>
          <mask id="gtbMapMask">
            <ellipse cx={cx} cy={cy} rx={W / 2} ry={H / 2} fill="url(#gtbMapFade)" />
          </mask>
        </defs>

        {/* 暖色光晕 */}
        <circle cx={cx} cy={cy} r={215} fill="url(#gtbGlow)" />

        {/* 点阵地图 */}
        <g className="map" mask="url(#gtbMapMask)">
          {dots.map((p, i) => (
            <circle key={i} cx={p.x} cy={p.y} r={1.6} fill="#1a1613" fillOpacity={0.16} />
          ))}
        </g>

        {/* 同心参考圈 + 自转轨道 */}
        <circle cx={cx} cy={cy} r={110} fill="none" stroke="rgba(26,22,19,.07)" />
        <circle cx={cx} cy={cy} r={190} fill="none" stroke="rgba(26,22,19,.07)" strokeDasharray="2 6" />
        <g className="orbit">
          <circle cx={cx + 190} cy={cy} r={3.5} fill="#ff641e" />
          <circle cx={cx - 190} cy={cy} r={2.5} fill="#ff8a50" />
        </g>

        {/* 脉冲波纹 */}
        {[0, 1.4, 2.8].map(delay => (
          <circle key={delay} className="ripple" cx={cx} cy={cy} r={44} style={{ animationDelay: `${delay + 1.2}s` }} />
        ))}

        {/* 对角辐射线 + 数据流光点 */}
        {nodes.map((n, i) => {
          const x1 = cx + n.dx * f * 0.95;
          const y1 = cy + n.dy * f * 0.95;
          const x2 = cx + n.dx * d;
          const y2 = cy + n.dy * d;
          const path = `M${x1},${y1} L${x2},${y2}`;
          return (
            <g key={n.key}>
              <path className="spoke" d={path} pathLength={1} style={{ animationDelay: `${0.9 + i * 0.12}s` }} />
              <circle r={2.6} fill="#ff641e">
                <animateMotion dur="2.8s" begin={`${2.4 + i * 0.7}s`} repeatCount="indefinite" path={path} />
                <animate attributeName="opacity" values="0;1;1;0" dur="2.8s" begin={`${2.4 + i * 0.7}s`} repeatCount="indefinite" />
              </circle>
              <circle className="node" cx={x2} cy={y2} r={5.5} fill="#ff641e" style={{ animationDelay: `${1.7 + i * 0.12}s` }} />
              <circle className="node" cx={x2} cy={y2} r={10} fill="none" stroke="#ff641e" strokeOpacity={0.35} style={{ animationDelay: `${1.8 + i * 0.12}s` }} />
            </g>
          );
        })}

        {/* 取景框 ⌜ ⌝（对焦入场） */}
        <g className="frame" fill="none" stroke="#1a1613" strokeWidth={3} strokeLinecap="square">
          <path d={`M${cx - f},${cy - f + 14} V${cy - f} H${cx - f + 14}`} />
          <path d={`M${cx + f},${cy - f + 14} V${cy - f} H${cx + f - 14}`} />
          <path d={`M${cx - f},${cy + f - 14} V${cy + f} H${cx - f + 14}`} />
          <path d={`M${cx + f},${cy + f - 14} V${cy + f} H${cx + f - 14}`} />
        </g>

        {/* 核心点 */}
        <circle cx={cx} cy={cy} r={22} fill="#ff641e" fillOpacity={0.14} />
        <circle className="core" cx={cx} cy={cy} r={12} fill="url(#gtbCoreFill)" />
      </svg>

      {/* 四张信息卡（HTML 层）：外层负责定位（不参与动画），内层负责入场动画，避免 transform 互相覆盖 */}
      {nodes.map((n, i) => {
        const nx = cx + n.dx * d;
        const ny = cy + n.dy * d;
        const gap = 14; // 卡片与节点的间距
        const pos: React.CSSProperties = {
          position: 'absolute',
          left: `${(nx / W) * 100}%`,
          top: `${(ny / H) * 100}%`,
          // 节点落在卡片「朝向中心」的那个角外侧
          transform: `translate(${n.dx < 0 ? `calc(-100% - ${gap}px)` : `${gap}px`}, ${n.dy < 0 ? `calc(-100% - ${gap}px)` : `${gap}px`})`
        };
        return (
          <div key={n.key} style={pos}>
            <div className="card" style={{ animationDelay: `${1.9 + i * 0.15}s`, textAlign: n.dx < 0 ? 'right' : 'left' }}>
              <i className="tl" /><i className="tr" /><i className="bl" /><i className="br" />
              <div className="inner" style={{ animationDelay: `${i * 0.8}s` }}>
                <b>{n.zh}</b>
                <em>{n.en}</em>
                <small>{n.sub}</small>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

/**
 * 第 2 幕：三大核心能力「产品界面缩影」卡片（1:1 画幅上滑轮播）
 * 每张卡片均为可信的产品界面示意（示例数据），激活时依次播放入场动画。
 */
const FC_CSS = `
  .gtb-fc { --o:#ff641e; --o2:#ff8a50; --o3:#c2410c; --ink:#1a1613; --mute:#8a7d70; }
  .gtb-fc .fc-rise, .gtb-fc .fc-slide, .gtb-fc .fc-pop { opacity: 0; }
  .gtb-fc .fc-grow { transform-box: fill-box; transform-origin: bottom; transform: scaleY(0); }
  .gtb-fc .fc-draw { stroke-dasharray: 1; stroke-dashoffset: 1; }
  .gtb-fc .fc-fade { opacity: 0; }
  .gtb-fc .fc-scale { opacity: 0; transform: scale(.2); }

  .gtb-fc .on .fc-rise  { animation: fcRise .6s cubic-bezier(.2,.9,.3,1) var(--d,0s) both; }
  .gtb-fc .on .fc-slide { animation: fcSlide .6s cubic-bezier(.2,.9,.3,1) var(--d,0s) both; }
  .gtb-fc .on .fc-pop   { animation: fcPop .5s cubic-bezier(.3,1.6,.5,1) var(--d,0s) both; }
  .gtb-fc .on .fc-grow  { animation: fcGrow .8s cubic-bezier(.2,.9,.3,1) var(--d,0s) both; }
  .gtb-fc .on .fc-draw  { animation: fcDraw 1.2s ease-out var(--d,0s) both; }
  .gtb-fc .on .fc-fade  { animation: fcFade .8s ease var(--d,0s) both; }
  .gtb-fc .on .fc-scale { animation: fcScale .9s cubic-bezier(.2,.9,.3,1) var(--d,0s) both; transform-box: fill-box; transform-origin: center; }
  .gtb-fc .on .fc-live  { animation: fcLive 1.8s ease-in-out infinite; }
  .gtb-fc .on .fc-dash  { animation: fcDashMove 1.4s linear infinite; }

  @keyframes fcRise  { from { opacity:0; transform: translateY(12px); } to { opacity:1; transform:none; } }
  @keyframes fcSlide { from { opacity:0; transform: translateX(-16px); } to { opacity:1; transform:none; } }
  @keyframes fcPop   { from { opacity:0; transform: scale(.6); } to { opacity:1; transform:scale(1); } }
  @keyframes fcGrow  { to { transform: scaleY(1); } }
  @keyframes fcDraw  { to { stroke-dashoffset: 0; } }
  @keyframes fcFade  { to { opacity: 1; } }
  @keyframes fcScale { to { opacity: 1; transform: scale(1); } }
  @keyframes fcLive  { 0%,100% { opacity: 1; } 50% { opacity: .35; } }
  @keyframes fcDashMove { to { stroke-dashoffset: -14; } }

  .gtb-fc .fc-corner { position:absolute; width:12px; height:12px; border:2px solid var(--o); opacity:.85; }
  .gtb-fc .fc-corner.tl { top:10px; left:10px; border-right:0; border-bottom:0; border-top-left-radius:4px; }
  .gtb-fc .fc-corner.tr { top:10px; right:10px; border-left:0; border-bottom:0; border-top-right-radius:4px; }
  .gtb-fc .fc-corner.bl { bottom:10px; left:10px; border-right:0; border-top:0; border-bottom-left-radius:4px; }
  .gtb-fc .fc-corner.br { bottom:10px; right:10px; border-left:0; border-top:0; border-bottom-right-radius:4px; }

  .gtb-fc .fc-head { display:flex; align-items:center; justify-content:space-between; }
  .gtb-fc .fc-title { display:flex; align-items:center; gap:8px; font-size:.72rem; font-weight:700; letter-spacing:.14em; color:var(--ink); }
  .gtb-fc .fc-dot { width:7px; height:7px; border-radius:50%; background:var(--o); box-shadow:0 0 0 3px rgba(255,100,30,.18); }
  .gtb-fc .fc-tag { font-size:.64rem; color:var(--o3); background:rgba(255,100,30,.09); border:1px solid rgba(255,100,30,.22); padding:2px 9px; border-radius:99px; font-weight:600; }
  .gtb-fc .fc-mono { font-family: ui-monospace,'SF Mono',Menlo,monospace; }
  .gtb-fc .fc-news { display:flex; align-items:center; gap:10px; padding:9px 10px; border-radius:10px; background:rgba(255,255,255,.75); border:1px solid rgba(26,22,19,.07); }
  .gtb-fc .fc-news .region { flex:none; font-size:.62rem; font-weight:700; color:#fff; background:var(--ink); border-radius:5px; padding:3px 6px; letter-spacing:.04em; }
  .gtb-fc .fc-news .txt { flex:1; min-width:0; font-size:.74rem; color:#3a322b; line-height:1.35; }
  .gtb-fc .fc-news .meta { flex:none; text-align:right; }
  .gtb-fc .fc-news .meta b { display:block; font-size:.62rem; color:var(--o3); font-weight:600; }
  .gtb-fc .fc-news .meta span { font-size:.6rem; color:var(--mute); }
  .gtb-fc .fc-chip { font-size:.66rem; padding:3px 10px; border-radius:99px; border:1px solid rgba(26,22,19,.14); color:#5c5148; background:#fff; }
  .gtb-fc .fc-chip.hot { color:#fff; background:linear-gradient(135deg,var(--o2),var(--o)); border-color:transparent; }
  .gtb-fc .fc-chain { display:flex; align-items:center; gap:6px; }
  .gtb-fc .fc-chain .n { flex:1; text-align:center; font-size:.66rem; padding:6px 4px; border-radius:8px; background:rgba(26,22,19,.04); border:1px solid rgba(26,22,19,.08); color:#3a322b; }
  .gtb-fc .fc-chain .n.me { background:rgba(255,100,30,.1); border-color:rgba(255,100,30,.4); color:var(--o3); font-weight:700; }
  .gtb-fc .fc-chain .ar { flex:none; width:14px; height:1px; background:var(--o); position:relative; }
  .gtb-fc .fc-chain .ar::after { content:''; position:absolute; right:-1px; top:-3px; border-left:5px solid var(--o); border-top:3.5px solid transparent; border-bottom:3.5px solid transparent; }
  .gtb-fc .fc-insight { display:flex; justify-content:space-between; align-items:center; gap:8px; background:rgba(255,100,30,.07); border:1px solid rgba(255,100,30,.22); border-radius:10px; padding:8px 12px; font-size:.7rem; }
  @media (prefers-reduced-motion: reduce) {
    .gtb-fc .on * { animation-duration: .01ms !important; animation-iteration-count: 1 !important; animation-delay: 0s !important; }
  }
`;

function FcFrame({ children, active }: { children: React.ReactNode; active: boolean }) {
  return (
    <div className={active ? 'on' : ''} style={{
      position: 'relative', width: '100%', height: '100%', boxSizing: 'border-box',
      padding: '26px 24px 22px', display: 'flex', flexDirection: 'column', gap: '12px'
    }}>
      <i className="fc-corner tl" /><i className="fc-corner tr" /><i className="fc-corner bl" /><i className="fc-corner br" />
      {children}
    </div>
  );
}

/** 卡片 1：每周行业资讯 —— 情报流 */
function NewsCard({ active }: { active: boolean }) {
  const news = [
    { r: 'US', t: '北美连锁加码自有品牌，五金工具品类占比提升', tag: '渠道扩张', time: '2 小时前' },
    { r: 'EU', t: '欧盟收紧包装回收标准，2027 年起全面实施', tag: '合规动态', time: '5 小时前' },
    { r: 'CORP', t: '某头部零售商采购总监换届，品类策略或调整', tag: '高管变更', time: '昨天' },
    { r: 'SEA', t: '东南亚新增门店 120 家，供应商招募启动', tag: '投资扩张', time: '昨天' }
  ];
  return (
    <FcFrame active={active}>
      <div className="fc-head">
        <div className="fc-title"><span className="fc-dot fc-live" />WEEKLY INTELLIGENCE</div>
        <span className="fc-tag">示例数据</span>
      </div>

      <div className="fc-rise" style={{ ['--d' as any]: '.05s', display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: '12px' }}>
        <div>
          <div className="fc-mono" style={{ fontSize: '1.7rem', fontWeight: 700, color: 'var(--ink)', lineHeight: 1 }}>+12</div>
          <div style={{ fontSize: '.66rem', color: 'var(--mute)', marginTop: '4px' }}>本周关键信号</div>
        </div>
        <svg viewBox="0 0 220 56" style={{ flex: 1, height: '56px', overflow: 'visible' }}>
          <defs>
            <linearGradient id="fcArea" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#ff641e" stopOpacity=".28" />
              <stop offset="100%" stopColor="#ff641e" stopOpacity="0" />
            </linearGradient>
          </defs>
          <path className="fc-fade" style={{ ['--d' as any]: '.9s' }} d="M0 46 L28 38 L56 42 L84 26 L112 32 L140 16 L168 22 L196 8 L220 12 V56 H0 Z" fill="url(#fcArea)" />
          <path className="fc-draw" pathLength={1} style={{ ['--d' as any]: '.3s' }} d="M0 46 L28 38 L56 42 L84 26 L112 32 L140 16 L168 22 L196 8 L220 12" fill="none" stroke="#ff641e" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
          <circle className="fc-pop" style={{ ['--d' as any]: '1.4s' }} cx="220" cy="12" r="3.5" fill="#ff641e" />
        </svg>
      </div>

      <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
        {['产品创新', '高管变更', '渠道扩张', '投资动向'].map((c, i) => (
          <span key={c} className={`fc-chip fc-pop ${i === 2 ? 'hot' : ''}`} style={{ ['--d' as any]: `${0.35 + i * 0.08}s` }}>{c}</span>
        ))}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '7px', flex: 1, justifyContent: 'flex-end' }}>
        {news.map((n, i) => (
          <div key={i} className="fc-news fc-slide" style={{ ['--d' as any]: `${0.55 + i * 0.13}s` }}>
            <span className="region">{n.r}</span>
            <span className="txt">{n.t}</span>
            <span className="meta"><b>{n.tag}</b><span>{n.time}</span></span>
          </div>
        ))}
      </div>
    </FcFrame>
  );
}

/** 卡片 2：客户 360° 洞察 —— 企业档案 */
function CustomerCard({ active }: { active: boolean }) {
  const cx = 96, cy = 100, R = 72;
  const axes = ['财务', '渠道', '采购', '供应链', '舆情'];
  const vals = [0.82, 0.62, 0.92, 0.7, 0.5];
  const pt = (i: number, k: number): [number, number] => {
    const a = -Math.PI / 2 + (i * 2 * Math.PI) / axes.length;
    return [cx + Math.cos(a) * R * k, cy + Math.sin(a) * R * k];
  };
  const poly = (k: number[]) => k.map((v, i) => pt(i, v).join(',')).join(' ');
  const bars = [38, 52, 61, 78, 96];
  return (
    <FcFrame active={active}>
      <div className="fc-head">
        <div className="fc-title"><span className="fc-dot fc-live" />BUYER PROFILE</div>
        <span className="fc-tag">示例数据</span>
      </div>

      <div className="fc-rise" style={{ ['--d' as any]: '.05s', display: 'flex', alignItems: 'center', gap: '12px' }}>
        <div style={{ width: 40, height: 40, borderRadius: 12, background: 'linear-gradient(135deg,#ff8a50,#ff641e)', color: '#fff', fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 6px 14px rgba(255,100,30,.3)' }}>S</div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: '.88rem', fontWeight: 700, color: 'var(--ink)' }}>Sample Retail Group</div>
          <div style={{ fontSize: '.66rem', color: 'var(--mute)', marginTop: 2 }}>北美 · 综合零售 · 年营收 $96B</div>
        </div>
        <span className="fc-tag">合作潜力 高</span>
      </div>

      <svg viewBox="0 0 396 200" style={{ width: '100%', flex: 1, minHeight: 0 }}>
        {/* 雷达 */}
        {[1, 0.66, 0.33].map((k, i) => (
          <polygon key={i} points={poly(axes.map(() => k))} fill="none" stroke="rgba(26,22,19,.10)" strokeWidth="1" />
        ))}
        {axes.map((a, i) => {
          const [x, y] = pt(i, 1);
          const [lx, ly] = pt(i, 1.2);
          return (
            <g key={a}>
              <line x1={cx} y1={cy} x2={x} y2={y} stroke="rgba(26,22,19,.08)" />
              <text x={lx} y={ly + 3} textAnchor="middle" fontSize="9.5" fill="#6b5f55">{a}</text>
            </g>
          );
        })}
        <g className="fc-scale" style={{ ['--d' as any]: '.35s' }}>
          <polygon points={poly(vals)} fill="rgba(255,100,30,.20)" stroke="#ff641e" strokeWidth="2" strokeLinejoin="round" />
          {vals.map((v, i) => { const [x, y] = pt(i, v); return <circle key={i} cx={x} cy={y} r="3.2" fill="#fff" stroke="#ff641e" strokeWidth="1.8" />; })}
        </g>

        {/* 营收趋势 */}
        <text x="230" y="18" fontSize="9.5" fill="#6b5f55">近 5 年营收趋势</text>
        {bars.map((h, i) => (
          <g key={i}>
            <rect className="fc-grow" style={{ ['--d' as any]: `${0.5 + i * 0.1}s` }}
              x={230 + i * 31} y={170 - h} width="20" height={h} rx="4"
              fill={i === bars.length - 1 ? '#ff641e' : 'rgba(255,100,30,.28)'} />
            <text x={240 + i * 31} y="186" textAnchor="middle" fontSize="8.5" fill="#8a7d70">{`'${21 + i}`}</text>
          </g>
        ))}
        <path className="fc-draw" pathLength={1} style={{ ['--d' as any]: '1s' }} d="M240 132 L271 118 L302 109 L333 92 L364 74" fill="none" stroke="#1a1613" strokeWidth="1.4" strokeDasharray="1" />
      </svg>

      <div>
        <div style={{ fontSize: '.64rem', color: 'var(--mute)', marginBottom: 6, letterSpacing: '.1em' }}>采购决策链</div>
        <div className="fc-chain fc-rise" style={{ ['--d' as any]: '1.1s' }}>
          <span className="n">CEO</span><span className="ar" />
          <span className="n">采购总监</span><span className="ar" />
          <span className="n">品类经理</span><span className="ar" />
          <span className="n me">你的触达点</span>
        </div>
      </div>
    </FcFrame>
  );
}

/** 卡片 3：品类 360° 洞察 —— 价格带与蓝海 */
function CategoryCard({ active }: { active: boolean }) {
  const dist = [14, 34, 70, 108, 120, 92, 58, 30, 12, 6];
  const bw = 28, gap = 8, x0 = 14, base = 150;
  return (
    <FcFrame active={active}>
      <div className="fc-head">
        <div className="fc-title"><span className="fc-dot fc-live" />PRICE BAND MAP</div>
        <span className="fc-tag">示例数据</span>
      </div>

      <div className="fc-rise" style={{ ['--d' as any]: '.05s', display: 'flex', gap: 18 }}>
        {[['SKU 样本', '1,286'], ['均价', '$26.4'], ['空白带', '$45+']].map(([k, v], i) => (
          <div key={k}>
            <div className="fc-mono" style={{ fontSize: '1.15rem', fontWeight: 700, color: i === 2 ? 'var(--o)' : 'var(--ink)', lineHeight: 1 }}>{v}</div>
            <div style={{ fontSize: '.62rem', color: 'var(--mute)', marginTop: 4 }}>{k}</div>
          </div>
        ))}
      </div>

      <svg viewBox="0 0 396 200" style={{ width: '100%', flex: 1, minHeight: 0, overflow: 'visible' }}>
        <line x1="0" y1={base} x2="396" y2={base} stroke="rgba(26,22,19,.15)" />
        {/* 主流密集带高亮 */}
        <rect className="fc-fade" style={{ ['--d' as any]: '.3s' }} x={x0 + 3 * (bw + gap) - 4} y="18" width={3 * (bw + gap)} height={base - 18} rx="8" fill="rgba(255,100,30,.06)" stroke="rgba(255,100,30,.25)" strokeDasharray="4 3" />
        {dist.map((h, i) => {
          const dense = i >= 3 && i <= 5;
          return (
            <rect key={i} className="fc-grow" style={{ ['--d' as any]: `${0.2 + i * 0.07}s` }}
              x={x0 + i * (bw + gap)} y={base - h} width={bw} height={h} rx="5"
              fill={dense ? '#ff641e' : 'rgba(26,22,19,.14)'} fillOpacity={dense ? 0.9 : 1} />
          );
        })}
        {['$5', '$15', '$25', '$35', '$45', '$55'].map((t, i) => (
          <text key={t} x={x0 + i * 2 * (bw + gap) + bw / 2} y={base + 16} textAnchor="middle" fontSize="9" fill="#8a7d70">{t}</text>
        ))}
        <text x={x0 + 4.5 * (bw + gap)} y="12" textAnchor="middle" fontSize="9.5" fill="#c2410c" fontWeight="600">主流密集带</text>

        {/* 蓝海空白 */}
        <g className="fc-scale" style={{ ['--d' as any]: '1.1s' }}>
          <ellipse className="fc-dash" cx={x0 + 8.5 * (bw + gap)} cy={base - 22} rx="46" ry="36" fill="rgba(255,100,30,.08)" stroke="#ff641e" strokeWidth="1.6" strokeDasharray="5 4" />
        </g>
        <g className="fc-rise" style={{ ['--d' as any]: '1.3s' }}>
          <text x={x0 + 8.5 * (bw + gap)} y={base - 62} textAnchor="middle" fontSize="9.5" fill="#ff641e" fontWeight="700">未被满足的蓝海空白</text>
        </g>
        <path className="fc-draw" pathLength={1} style={{ ['--d' as any]: '1.5s' }} d={`M${x0 + 4.5 * (bw + gap)} ${base - 130} Q ${x0 + 7 * (bw + gap)} ${base - 130} ${x0 + 8.2 * (bw + gap)} ${base - 70}`} fill="none" stroke="#ff641e" strokeWidth="1.4" strokeDasharray="1" />
      </svg>

      <div className="fc-insight fc-rise" style={{ ['--d' as any]: '1.6s' }}>
        <span style={{ color: '#6b5f55' }}>主流密集带 $15 – $35</span>
        <span style={{ color: 'var(--o3)', fontWeight: 700 }}>建议：锁定 $45+ 溢价区间</span>
      </div>
    </FcFrame>
  );
}

export function FeatureCards({ activeIndex }: { activeIndex: number }) {
  const cards = [NewsCard, CustomerCard, CategoryCard];

  return (
    <div className="gtb-fc" style={{
      position: 'relative',
      width: '100%',
      maxWidth: '440px',
      aspectRatio: '1 / 1',
      margin: '0 auto'
    }}>
      <style dangerouslySetInnerHTML={{ __html: FC_CSS }} />
      {/* 卡片背后的暖色光晕 */}
      <div aria-hidden="true" style={{
        position: 'absolute', inset: '-12%', zIndex: 0, pointerEvents: 'none',
        background: 'radial-gradient(circle at 50% 50%, rgba(255,100,30,.16), transparent 62%)'
      }} />
      {cards.map((Card, index) => {
        const offset = index - activeIndex;
        const isActive = index === activeIndex;
        const isPast = index < activeIndex;

        let translateY = offset * 26;
        let scale = 1 - Math.abs(offset) * 0.05;
        let opacity = isActive ? 1 : (isPast ? 0 : 0.28);
        if (isPast) translateY = -70;

        return (
          <div
            key={index}
            style={{
              position: 'absolute',
              inset: 0,
              zIndex: 10 - Math.abs(offset),
              background: 'linear-gradient(160deg, #ffffff 0%, #fffaf5 100%)',
              border: isActive ? '1.5px solid rgba(255,100,30,.45)' : '1px solid rgba(26,22,19,.08)',
              borderRadius: '24px',
              boxShadow: isActive
                ? '0 2px 4px rgba(120,60,20,.05), 0 18px 40px rgba(120,60,20,.10), 0 34px 70px rgba(255,100,30,.14), inset 0 1px 0 #fff'
                : '0 8px 24px rgba(0,0,0,.03)',
              transform: `translateY(${translateY}px) scale(${scale})`,
              opacity,
              pointerEvents: isActive ? 'auto' : 'none',
              transition: 'transform .6s cubic-bezier(.16,1,.3,1), opacity .5s ease, box-shadow .5s ease, border-color .5s ease',
              overflow: 'hidden'
            }}
          >
            <Card active={isActive} />
          </div>
        );
      })}
    </div>
  );
}

/**
 * 第 3 幕：私人知识图谱 —— 生长的图谱（Canvas）
 * 节点依次生长 → 数据脉冲沿边流动 → 周期性「新笔记落入并连接」→ 悬停高亮邻居
 */
export function KnowledgeNetwork() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const SIZE = 460;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = SIZE * dpr;
    canvas.height = SIZE * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    type N = { id: string; label: string; x: number; y: number; r: number; kind: 'core' | 'hub' | 'leaf' | 'note'; born: number; ph: number };
    const mk = (id: string, label: string, x: number, y: number, r: number, kind: N['kind'], born: number): N =>
      ({ id, label, x, y, r, kind, born, ph: Math.random() * Math.PI * 2 });

    const nodes: N[] = [
      mk('core', '商业知识大脑', 230, 230, 15, 'core', 0),
      mk('c1', '客户 360° 洞察', 135, 150, 9, 'hub', 0.5),
      mk('c2', '品类 360° 洞察', 325, 158, 9, 'hub', 0.7),
      mk('c3', '每周行业资讯', 145, 315, 9, 'hub', 0.9),
      mk('c4', '私人调研笔记', 318, 305, 9, 'note', 1.1),
      mk('s1', '北美买家线索', 70, 105, 5, 'leaf', 1.5),
      mk('s2', '采购组织架构', 72, 205, 5, 'leaf', 1.65),
      mk('s3', '欧洲包装新规', 215, 78, 5, 'leaf', 1.8),
      mk('s4', '价格带空白', 392, 112, 5, 'note', 1.95),
      mk('s5', '直采动态', 88, 378, 5, 'leaf', 2.1),
      mk('s6', '差异化选品灵感', 392, 365, 5, 'note', 2.25),
      mk('s7', '核心竞对档案', 232, 392, 5, 'leaf', 2.4)
    ];
    const links: [string, string][] = [
      ['core', 'c1'], ['core', 'c2'], ['core', 'c3'], ['core', 'c4'],
      ['c1', 's1'], ['c1', 's2'], ['c2', 's3'], ['c2', 's4'],
      ['c3', 's5'], ['c4', 's6'], ['core', 's7'],
      ['c1', 'c2'], ['c3', 'c4'], ['s2', 's5']
    ];
    const byId = (id: string) => nodes.find(n => n.id === id)!;
    const neighbors = (id: string) => {
      const set = new Set<string>([id]);
      links.forEach(([a, b]) => { if (a === id) set.add(b); if (b === id) set.add(a); });
      return set;
    };

    // 周期性「新笔记」
    const noteTitles = ['新增：采购访谈纪要', '新增：竞品价格对比', '新增：展会客户线索', '新增：关税政策笔记'];
    let noteIdx = 0;
    let nextNoteAt = 4.2;
    let dropping: { n: N; target: string; start: number } | null = null;

    let hoverId: string | null = null;
    let mx = -999, my = -999;
    const onMove = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      mx = ((e.clientX - rect.left) / rect.width) * SIZE;
      my = ((e.clientY - rect.top) / rect.height) * SIZE;
    };
    const onLeave = () => { mx = -999; my = -999; };
    canvas.addEventListener('mousemove', onMove);
    canvas.addEventListener('mouseleave', onLeave);

    const easeOut = (t: number) => 1 - Math.pow(1 - Math.min(1, Math.max(0, t)), 3);
    const ORANGE = '255,100,30';
    const INK = '26,22,19';

    let t0 = performance.now();
    let wasHidden = false;
    let animId = 0;

    const pos = (n: N, t: number, ang: number) => {
      const cosA = Math.cos(ang), sinA = Math.sin(ang);
      const bx = n.x + (reduce ? 0 : Math.sin(t * 0.8 + n.ph) * 3);
      const by = n.y + (reduce ? 0 : Math.cos(t * 0.7 + n.ph) * 3);
      return {
        x: SIZE / 2 + (bx - SIZE / 2) * cosA - (by - SIZE / 2) * sinA,
        y: SIZE / 2 + (bx - SIZE / 2) * sinA + (by - SIZE / 2) * cosA
      };
    };

    const render = (now: number) => {
      animId = requestAnimationFrame(render);
      // 所在幕不可见时暂停绘制，并在重新可见时重播生长动画
      if (canvas.offsetParent === null) { wasHidden = true; return; }
      if (wasHidden) {
        wasHidden = false; t0 = now; nextNoteAt = 4.2; dropping = null;
        for (let i = nodes.length - 1; i >= 12; i--) nodes.splice(i, 1);
        for (let i = links.length - 1; i >= 14; i--) links.splice(i, 1);
      }
      const t = reduce ? 99 : (now - t0) / 1000;
      const ang = reduce ? 0 : Math.sin(t * 0.25) * 0.07;
      ctx.clearRect(0, 0, SIZE, SIZE);

      // 背景光晕
      const g = ctx.createRadialGradient(230, 230, 10, 230, 230, 230);
      g.addColorStop(0, `rgba(${ORANGE},0.10)`);
      g.addColorStop(1, `rgba(${ORANGE},0)`);
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, SIZE, SIZE);

      // 新笔记投放
      if (!reduce && t > nextNoteAt && !dropping) {
        const targets = ['c1', 'c2', 'c3', 'c4'];
        const target = targets[noteIdx % targets.length];
        const tn = byId(target);
        const a = Math.random() * Math.PI * 2;
        const dist = 62 + Math.random() * 18;
        const n = mk(`dyn${noteIdx}`, noteTitles[noteIdx % noteTitles.length],
          tn.x + Math.cos(a) * dist, tn.y + Math.sin(a) * dist, 5, 'note', t);
        n.x = Math.max(40, Math.min(SIZE - 40, n.x));
        n.y = Math.max(40, Math.min(SIZE - 40, n.y));
        nodes.push(n);
        links.push([target, n.id]);
        dropping = { n, target, start: t };
        noteIdx++;
        nextNoteAt = t + 4.5;
      }
      if (dropping && t - dropping.start > 4) {
        // 淡出并移除动态节点，保持图谱稳定
        const idx = nodes.indexOf(dropping.n);
        if (idx >= 0) nodes.splice(idx, 1);
        const li = links.findIndex(l => l[1] === dropping!.n.id);
        if (li >= 0) links.splice(li, 1);
        dropping = null;
      }

      // 悬停检测
      hoverId = null;
      let best = 22;
      nodes.forEach(n => {
        if (t < n.born) return;
        const p = pos(n, t, ang);
        const d = Math.hypot(p.x - mx, p.y - my);
        if (d < best) { best = d; hoverId = n.id; }
      });
      const hl = hoverId ? neighbors(hoverId) : null;

      // 连线
      links.forEach(([a, b], li) => {
        const A = byId(a), B = byId(b);
        const k = easeOut((t - Math.max(A.born, B.born) - 0.15) / 0.6);
        if (k <= 0) return;
        const pa = pos(A, t, ang), pb = pos(B, t, ang);
        const ex = pa.x + (pb.x - pa.x) * k, ey = pa.y + (pb.y - pa.y) * k;
        const warm = A.kind === 'note' || B.kind === 'note' || A.kind === 'core' || B.kind === 'core';
        const lit = hl ? (hl.has(a) && hl.has(b)) : true;
        ctx.beginPath();
        ctx.moveTo(pa.x, pa.y);
        ctx.lineTo(ex, ey);
        ctx.strokeStyle = lit
          ? (warm ? `rgba(${ORANGE},${hl ? 0.7 : 0.32})` : `rgba(${INK},${hl ? 0.4 : 0.12})`)
          : `rgba(${INK},0.04)`;
        ctx.lineWidth = hl && lit ? 1.8 : 1.1;
        ctx.stroke();

        // 数据脉冲
        if (k >= 1 && !reduce && warm) {
          const pk = ((t * 0.35 + li * 0.37) % 1);
          const px = pa.x + (pb.x - pa.x) * pk, py = pa.y + (pb.y - pa.y) * pk;
          ctx.beginPath();
          ctx.arc(px, py, 1.8, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(${ORANGE},${lit ? 0.9 : 0.2})`;
          ctx.fill();
        }
      });

      // 节点
      nodes.forEach(n => {
        const k = easeOut((t - n.born) / 0.5);
        if (k <= 0) return;
        const p = pos(n, t, ang);
        const isHot = n.kind === 'core' || n.kind === 'note';
        const dim = hl && !hl.has(n.id);
        const r = n.r * (n.kind === 'core' ? 1 + Math.sin(t * 2) * 0.06 : 1) * k * (hoverId === n.id ? 1.25 : 1);
        const alpha = dim ? 0.25 : 1;

        if (isHot) {
          ctx.beginPath();
          ctx.arc(p.x, p.y, r + (n.kind === 'core' ? 9 : 5), 0, Math.PI * 2);
          ctx.fillStyle = `rgba(${ORANGE},${(n.kind === 'core' ? 0.16 : 0.18) * alpha})`;
          ctx.fill();
        }
        ctx.beginPath();
        ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
        if (n.kind === 'core') {
          const cg = ctx.createRadialGradient(p.x - r * 0.3, p.y - r * 0.3, 1, p.x, p.y, r);
          cg.addColorStop(0, '#ffb089'); cg.addColorStop(1, '#ff641e');
          ctx.fillStyle = cg;
        } else {
          ctx.fillStyle = isHot ? `rgba(${ORANGE},${alpha})` : (n.kind === 'hub' ? `rgba(${INK},${0.88 * alpha})` : `rgba(${INK},${0.45 * alpha})`);
        }
        ctx.fill();

        // 标签（带暖白底胶囊，保证可读）
        if (k > 0.6) {
          const fs = n.kind === 'core' ? 11.5 : (n.kind === 'hub' ? 10 : 9);
          ctx.font = `${n.kind === 'core' || n.kind === 'hub' ? '600 ' : ''}${fs}px -apple-system, "PingFang SC", system-ui, sans-serif`;
          const w = ctx.measureText(n.label).width + 10;
          const ly = p.y + n.r + 13;
          ctx.globalAlpha = Math.min(1, (k - 0.6) / 0.4) * (dim ? 0.3 : 1);
          ctx.fillStyle = 'rgba(251,249,246,0.88)';
          ctx.beginPath();
          const rx = p.x - w / 2, rh = fs + 6;
          const rr = 5;
          ctx.moveTo(rx + rr, ly - rh / 2);
          ctx.arcTo(rx + w, ly - rh / 2, rx + w, ly + rh / 2, rr);
          ctx.arcTo(rx + w, ly + rh / 2, rx, ly + rh / 2, rr);
          ctx.arcTo(rx, ly + rh / 2, rx, ly - rh / 2, rr);
          ctx.arcTo(rx, ly - rh / 2, rx + w, ly - rh / 2, rr);
          ctx.fill();
          ctx.fillStyle = n.kind === 'core' ? '#c2410c' : (isHot ? '#c2410c' : '#3a322b');
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(n.label, p.x, ly + 0.5);
          ctx.globalAlpha = 1;
        }
      });
      canvas.style.cursor = hoverId ? 'pointer' : 'default';
    };
    animId = requestAnimationFrame(render);

    return () => {
      cancelAnimationFrame(animId);
      canvas.removeEventListener('mousemove', onMove);
      canvas.removeEventListener('mouseleave', onLeave);
    };
  }, []);

  return (
    <div style={{
      position: 'relative',
      width: '100%',
      maxWidth: '480px',
      aspectRatio: '1 / 1',
      margin: '0 auto'
    }}>
      <canvas ref={canvasRef} style={{ width: '100%', height: '100%', display: 'block' }} />
    </div>
  );
}

/**
 * 第 4 幕：行动与邀请裂变面板 (无 emoji，商务纯净版)
 */
export function ActionPanel({
  userId,
  copied,
  onCopy,
  onShowAuthModal
}: {
  userId: string;
  copied: boolean;
  onCopy: () => void;
  onShowAuthModal: () => void;
}) {
  return (
    <div style={{
      background: '#ffffff',
      border: '1px solid rgba(255, 100, 30, 0.25)',
      borderRadius: '28px',
      padding: '44px 36px',
      maxWidth: '620px',
      width: '100%',
      margin: '0 auto',
      textAlign: 'center',
      boxShadow: '0 24px 60px rgba(255, 100, 30, 0.08), 0 4px 16px rgba(0,0,0,0.03)',
      position: 'relative'
    }}>
      {/* 顶部徽章 */}
      <div style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '6px',
        background: 'rgba(255, 100, 30, 0.08)',
        border: '1px solid rgba(255, 100, 30, 0.2)',
        borderRadius: '20px',
        padding: '6px 16px',
        fontSize: '0.8rem',
        fontWeight: 600,
        color: '#ff641e',
        marginBottom: '20px'
      }}>
        <span>邀请互惠计划</span>
        <span>·</span>
        <span>双方获赠深度报告解锁额度</span>
      </div>

      <h3 style={{
        fontSize: 'clamp(1.6rem, 5vw, 2.2rem)',
        fontWeight: 600,
        color: '#121212',
        margin: '0 0 14px 0'
      }}>
        开启你的知识之旅
      </h3>

      <p style={{
        fontSize: '1rem',
        color: '#666',
        lineHeight: 1.65,
        margin: '0 auto 32px auto',
        maxWidth: '480px',
        fontWeight: 400
      }}>
        邀请更多人加入，双方都将获得更多报告解锁机会。
      </p>

      {/* 操作按钮区 */}
      {userId ? (
        <div>
          <div style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: '10px',
            background: 'rgba(0,0,0,0.03)',
            border: '1px solid rgba(0,0,0,0.08)',
            borderRadius: '30px',
            padding: '6px 8px 6px 18px',
            alignItems: 'center',
            marginBottom: '16px'
          }}>
            <input
              type="text"
              readOnly
              value={`${typeof window !== 'undefined' ? window.location.origin : ''}/?invite=${userId}`}
              style={{
                flex: '1 1 200px',
                border: 'none',
                background: 'transparent',
                outline: 'none',
                fontSize: '0.85rem',
                color: '#444',
                fontFamily: 'monospace'
              }}
            />
            <button
              onClick={onCopy}
              style={{
                background: '#ff641e',
                color: '#ffffff',
                border: 'none',
                borderRadius: '24px',
                padding: '10px 22px',
                fontSize: '0.85rem',
                fontWeight: 600,
                cursor: 'pointer',
                boxShadow: '0 4px 12px rgba(255, 100, 30, 0.25)',
                transition: 'all 0.2s',
                whiteSpace: 'nowrap'
              }}
            >
              {copied ? '已复制专属链接' : '复制专属链接'}
            </button>
          </div>

          <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
            <a
              href="/reports"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                color: '#121212',
                fontSize: '0.9rem',
                fontWeight: 600,
                textDecoration: 'none',
                padding: '10px 20px',
                borderRadius: '20px',
                background: 'rgba(0,0,0,0.04)',
                transition: 'all 0.2s'
              }}
            >
              进入报告大厅
            </a>
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', alignItems: 'center' }}>
          <button
            onClick={onShowAuthModal}
            style={{
              background: '#ff641e',
              color: '#ffffff',
              border: 'none',
              borderRadius: '30px',
              padding: '14px 38px',
              fontSize: '1rem',
              fontWeight: 600,
              cursor: 'pointer',
              boxShadow: '0 10px 24px rgba(255, 100, 30, 0.3)',
              transition: 'all 0.2s'
            }}
          >
            免费注册 / 登录体验
          </button>
          <a
            href="/reports"
            style={{
              color: '#666',
              fontSize: '0.85rem',
              textDecoration: 'none',
              fontWeight: 500,
              padding: '6px 12px'
            }}
          >
            或先浏览报告大厅
          </a>
        </div>
      )}
    </div>
  );
}
