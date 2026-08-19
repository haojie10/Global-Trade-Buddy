import React, { useEffect, useRef } from 'react';

/**
 * 第 1 幕：360° 商业生态穿透罗盘 (纯视觉示意图)
 */
export function EcosystemRadar() {
  return (
    <div style={{
      position: 'relative',
      width: '100%',
      maxWidth: '480px',
      aspectRatio: '1 / 1',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      margin: '0 auto'
    }}>
      {/* 罗盘底盘与动态轨道 */}
      <svg
        viewBox="0 0 400 400"
        style={{
          position: 'absolute',
          inset: 0,
          width: '100%',
          height: '100%',
          overflow: 'visible'
        }}
      >
        <defs>
          <radialGradient id="radarGlow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#ff641e" stopOpacity="0.14" />
            <stop offset="65%" stopColor="#ff641e" stopOpacity="0.02" />
            <stop offset="100%" stopColor="#ff641e" stopOpacity="0" />
          </radialGradient>
          <linearGradient id="orbitGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#ff641e" stopOpacity="0.5" />
            <stop offset="100%" stopColor="#121212" stopOpacity="0.08" />
          </linearGradient>
        </defs>

        {/* 动态雷达扫描渐变区 */}
        <circle cx="200" cy="200" r="185" fill="url(#radarGlow)" />

        {/* 同心圆轨道 */}
        <circle cx="200" cy="200" r="175" fill="none" stroke="rgba(18, 18, 18, 0.05)" strokeWidth="1" strokeDasharray="3 3" />
        <circle cx="200" cy="200" r="125" fill="none" stroke="rgba(18, 18, 18, 0.08)" strokeWidth="1" />
        <circle cx="200" cy="200" r="70" fill="none" stroke="rgba(255, 100, 30, 0.25)" strokeWidth="1.5" strokeDasharray="5 3" />

        {/* 极坐标网格刻度射线 */}
        <line x1="200" y1="20" x2="200" y2="380" stroke="rgba(18, 18, 18, 0.05)" strokeWidth="1" />
        <line x1="20" y1="200" x2="380" y2="200" stroke="rgba(18, 18, 18, 0.05)" strokeWidth="1" />
        <line x1="75" y1="75" x2="325" y2="325" stroke="rgba(18, 18, 18, 0.03)" strokeWidth="1" strokeDasharray="2 2" />
        <line x1="325" y1="75" x2="75" y2="325" stroke="rgba(18, 18, 18, 0.03)" strokeWidth="1" strokeDasharray="2 2" />

        {/* 动态引力连线 */}
        <line x1="200" y1="200" x2="200" y2="60" stroke="url(#orbitGrad)" strokeWidth="1.5" strokeDasharray="4 2" />
        <line x1="200" y1="200" x2="335" y2="200" stroke="url(#orbitGrad)" strokeWidth="1.5" strokeDasharray="4 2" />
        <line x1="200" y1="200" x2="200" y2="340" stroke="url(#orbitGrad)" strokeWidth="1.5" strokeDasharray="4 2" />
        <line x1="200" y1="200" x2="65" y2="200" stroke="url(#orbitGrad)" strokeWidth="1.5" strokeDasharray="4 2" />

        {/* 环形刻度微点 */}
        {[0, 45, 90, 135, 180, 225, 270, 315].map((deg) => {
          const rad = (deg * Math.PI) / 180;
          const cx = 200 + Math.cos(rad) * 125;
          const cy = 200 + Math.sin(rad) * 125;
          return <circle key={deg} cx={cx} cy={cy} r="2" fill="rgba(18, 18, 18, 0.2)" />;
        })}
      </svg>

      {/* 中心核心：目标客户 */}
      <div style={{
        position: 'relative',
        zIndex: 3,
        background: '#ffffff',
        border: '2px solid #ff641e',
        borderRadius: '50%',
        width: '94px',
        height: '94px',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        boxShadow: '0 14px 32px rgba(255, 100, 30, 0.22), 0 2px 8px rgba(0,0,0,0.04)',
        textAlign: 'center'
      }}>
        <div style={{
          width: '7px',
          height: '7px',
          borderRadius: '50%',
          background: '#ff641e',
          marginBottom: '4px',
          boxShadow: '0 0 6px #ff641e'
        }} />
        <span style={{ fontSize: '0.82rem', fontWeight: 700, color: '#121212' }}>
          目标客户
        </span>
        <span style={{ fontSize: '0.62rem', color: '#ff641e', fontWeight: 600, letterSpacing: '0.5px' }}>
          360° CORE
        </span>
      </div>

      {/* 节点 1：上游供应链 (Top) */}
      <div style={{
        position: 'absolute',
        top: '8%',
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 2,
        background: '#ffffff',
        border: '1px solid rgba(18, 18, 18, 0.08)',
        borderRadius: '16px',
        padding: '6px 14px',
        display: 'flex',
        alignItems: 'center',
        gap: '6px',
        boxShadow: '0 6px 16px rgba(0, 0, 0, 0.05)'
      }}>
        <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#121212' }} />
        <span style={{ fontSize: '0.78rem', fontWeight: 600, color: '#121212' }}>上游供应链</span>
      </div>

      {/* 节点 2：下游买家渠道 (Right) */}
      <div style={{
        position: 'absolute',
        right: '4%',
        top: '50%',
        transform: 'translateY(-50%)',
        zIndex: 2,
        background: '#ffffff',
        border: '1px solid rgba(18, 18, 18, 0.08)',
        borderRadius: '16px',
        padding: '6px 14px',
        display: 'flex',
        alignItems: 'center',
        gap: '6px',
        boxShadow: '0 6px 16px rgba(0, 0, 0, 0.05)'
      }}>
        <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#121212' }} />
        <span style={{ fontSize: '0.78rem', fontWeight: 600, color: '#121212' }}>下游买家与渠道</span>
      </div>

      {/* 节点 3：核心竞争对手 (Left) */}
      <div style={{
        position: 'absolute',
        left: '4%',
        top: '50%',
        transform: 'translateY(-50%)',
        zIndex: 2,
        background: '#ffffff',
        border: '1px solid rgba(18, 18, 18, 0.08)',
        borderRadius: '16px',
        padding: '6px 14px',
        display: 'flex',
        alignItems: 'center',
        gap: '6px',
        boxShadow: '0 6px 16px rgba(0, 0, 0, 0.05)'
      }}>
        <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#121212' }} />
        <span style={{ fontSize: '0.78rem', fontWeight: 600, color: '#121212' }}>核心竞争格局</span>
      </div>

      {/* 节点 4：市场空白商机 (Bottom) */}
      <div style={{
        position: 'absolute',
        bottom: '8%',
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 2,
        background: '#ffffff',
        border: '1.5px solid rgba(255, 100, 30, 0.4)',
        borderRadius: '16px',
        padding: '6px 14px',
        display: 'flex',
        alignItems: 'center',
        gap: '6px',
        boxShadow: '0 6px 20px rgba(255, 100, 30, 0.12)'
      }}>
        <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#ff641e' }} />
        <span style={{ fontSize: '0.78rem', fontWeight: 600, color: '#ff641e' }}>市场空白商机</span>
      </div>
    </div>
  );
}

/**
 * 第 2 幕：三大核心能力纯视觉图表看板 (上滑轮播)
 */
export function FeatureCards({ activeIndex }: { activeIndex: number }) {
  const visualCards = [
    // 示意图 1：每周行业资讯 —— 动态雷达与预警看板
    {
      id: 0,
      title: '实时动态雷达看板',
      tag: '动态预警',
      content: (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {/* 波形与扫描状态 */}
          <div style={{
            background: 'rgba(0, 0, 0, 0.02)',
            border: '1px solid rgba(0, 0, 0, 0.06)',
            borderRadius: '12px',
            padding: '12px 16px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div style={{
                width: '10px',
                height: '10px',
                borderRadius: '50%',
                background: '#ff641e',
                boxShadow: '0 0 8px #ff641e'
              }} />
              <span style={{ fontSize: '0.8rem', fontWeight: 600, color: '#121212' }}>全网情报雷达监控中</span>
            </div>
            <span style={{ fontSize: '0.72rem', color: '#666', fontFamily: 'monospace' }}>24H ACTIVE</span>
          </div>

          {/* 3 条态势监控流 */}
          <div style={{
            background: '#ffffff',
            border: '1px solid rgba(255, 100, 30, 0.25)',
            borderRadius: '10px',
            padding: '12px 14px',
            boxShadow: '0 4px 12px rgba(255, 100, 30, 0.06)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
              <span style={{ fontSize: '0.8rem', fontWeight: 600, color: '#121212' }}>北美头部渠道直采配额扩增</span>
              <span style={{ fontSize: '0.68rem', fontWeight: 600, color: '#ff641e', background: 'rgba(255,100,30,0.1)', padding: '2px 8px', borderRadius: '8px' }}>渠道预警</span>
            </div>
            <div style={{ fontSize: '0.72rem', color: '#888' }}>监测到沃尔玛 / Target 东南亚直采份额同比 +18%</div>
          </div>

          <div style={{
            background: '#ffffff',
            border: '1px solid rgba(0, 0, 0, 0.08)',
            borderRadius: '10px',
            padding: '12px 14px'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
              <span style={{ fontSize: '0.8rem', fontWeight: 600, color: '#121212' }}>欧盟环保包装准入新规生效</span>
              <span style={{ fontSize: '0.68rem', fontWeight: 600, color: '#666', background: 'rgba(0,0,0,0.06)', padding: '2px 8px', borderRadius: '8px' }}>准入法规</span>
            </div>
            <div style={{ fontSize: '0.72rem', color: '#888' }}>塑料降解检测标准收紧，涉及 12 类出口商品</div>
          </div>

          <div style={{
            background: '#ffffff',
            border: '1px solid rgba(0, 0, 0, 0.08)',
            borderRadius: '10px',
            padding: '12px 14px'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
              <span style={{ fontSize: '0.8rem', fontWeight: 600, color: '#121212' }}>核心竞对高管变动与供应链重组</span>
              <span style={{ fontSize: '0.68rem', fontWeight: 600, color: '#666', background: 'rgba(0,0,0,0.06)', padding: '2px 8px', borderRadius: '8px' }}>人事动向</span>
            </div>
            <div style={{ fontSize: '0.72rem', color: '#888' }}>亚太区采购总监履新，开启新一轮供应商招募</div>
          </div>
        </div>
      )
    },

    // 示意图 2：客户 360° 洞察 —— 买家画像与决策链穿透
    {
      id: 1,
      title: '买家 360° 穿透画像',
      tag: '买家穿透',
      content: (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          {/* 财务与规模指标 */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 1fr)',
            gap: '10px',
            textAlign: 'center'
          }}>
            <div style={{ background: 'rgba(0,0,0,0.02)', border: '1px solid rgba(0,0,0,0.06)', borderRadius: '10px', padding: '10px 4px' }}>
              <div style={{ fontSize: '0.68rem', color: '#888', marginBottom: '2px' }}>财务健康度</div>
              <div style={{ fontSize: '0.92rem', fontWeight: 700, color: '#121212' }}>AA+ 优良</div>
            </div>
            <div style={{ background: 'rgba(0,0,0,0.02)', border: '1px solid rgba(0,0,0,0.06)', borderRadius: '10px', padding: '10px 4px' }}>
              <div style={{ fontSize: '0.68rem', color: '#888', marginBottom: '2px' }}>年采购规模</div>
              <div style={{ fontSize: '0.92rem', fontWeight: 700, color: '#ff641e' }}>$2.4B</div>
            </div>
            <div style={{ background: 'rgba(0,0,0,0.02)', border: '1px solid rgba(0,0,0,0.06)', borderRadius: '10px', padding: '10px 4px' }}>
              <div style={{ fontSize: '0.68rem', color: '#888', marginBottom: '2px' }}>合作匹配度</div>
              <div style={{ fontSize: '0.92rem', fontWeight: 700, color: '#10b981' }}>94% 契合</div>
            </div>
          </div>

          {/* 决策链组织架构穿透图 */}
          <div style={{
            background: '#ffffff',
            border: '1px solid rgba(0,0,0,0.08)',
            borderRadius: '12px',
            padding: '14px',
            display: 'flex',
            flexDirection: 'column',
            gap: '8px'
          }}>
            <div style={{ fontSize: '0.72rem', fontWeight: 600, color: '#888', letterSpacing: '0.5px' }}>
              核心采购决策链拓扑
            </div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
              <div style={{ flex: 1, background: 'rgba(0,0,0,0.04)', borderRadius: '8px', padding: '8px', textAlign: 'center' }}>
                <div style={{ fontSize: '0.75rem', fontWeight: 600, color: '#121212' }}>VP 决策层</div>
                <div style={{ fontSize: '0.65rem', color: '#888' }}>预算终审</div>
              </div>
              <span style={{ color: '#ff641e', fontWeight: 700 }}>➔</span>
              <div style={{ flex: 1, background: 'rgba(255,100,30,0.08)', border: '1px solid rgba(255,100,30,0.2)', borderRadius: '8px', padding: '8px', textAlign: 'center' }}>
                <div style={{ fontSize: '0.75rem', fontWeight: 600, color: '#ff641e' }}>品类总监</div>
                <div style={{ fontSize: '0.65rem', color: '#ff641e' }}>选品立项</div>
              </div>
              <span style={{ color: '#ff641e', fontWeight: 700 }}>➔</span>
              <div style={{ flex: 1, background: 'rgba(0,0,0,0.04)', borderRadius: '8px', padding: '8px', textAlign: 'center' }}>
                <div style={{ fontSize: '0.75rem', fontWeight: 600, color: '#121212' }}>采购经理</div>
                <div style={{ fontSize: '0.65rem', color: '#888' }}>验厂核价</div>
              </div>
            </div>
          </div>
        </div>
      )
    },

    // 示意图 3：品类 360° 洞察 —— 价格带分布与空白蓝海发现
    {
      id: 2,
      title: '品类价格带与空白矩阵',
      tag: '空白发现',
      content: (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          {/* 价格带分布图 */}
          <div style={{
            background: '#ffffff',
            border: '1px solid rgba(0,0,0,0.08)',
            borderRadius: '12px',
            padding: '14px'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px', fontSize: '0.75rem' }}>
              <span style={{ color: '#666' }}>市场主流区间 ($15 - $35)</span>
              <span style={{ color: '#ff641e', fontWeight: 600 }}>高溢价蓝海空白 ($45 - $60)</span>
            </div>

            {/* 条形分布示意 */}
            <div style={{ height: '24px', background: 'rgba(0,0,0,0.05)', borderRadius: '6px', overflow: 'hidden', display: 'flex', position: 'relative' }}>
              <div style={{ width: '55%', background: 'rgba(18, 18, 18, 0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.65rem', color: '#fff' }}>
                红海密集区 (68% 供给)
              </div>
              <div style={{ width: '30%', background: '#ff641e', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.65rem', color: '#fff', fontWeight: 600 }}>
                空白商机点
              </div>
              <div style={{ width: '15%', background: 'rgba(18, 18, 18, 0.1)' }} />
            </div>
          </div>

          {/* 研发升级建议微卡 */}
          <div style={{
            background: 'linear-gradient(135deg, rgba(255,100,30,0.05) 0%, rgba(0,0,0,0.02) 100%)',
            border: '1px solid rgba(255,100,30,0.2)',
            borderRadius: '12px',
            padding: '12px 14px'
          }}>
            <div style={{ fontSize: '0.78rem', fontWeight: 600, color: '#121212', marginBottom: '4px' }}>
              产品研发与准入指引
            </div>
            <div style={{ fontSize: '0.72rem', color: '#666', lineHeight: 1.5 }}>
              主推差异化耐用材质与环保设计，规避 $20 以下低毛利价格战，直取北美中高端客群。
            </div>
          </div>
        </div>
      )
    }
  ];

  return (
    <div style={{
      position: 'relative',
      width: '100%',
      maxWidth: '520px',
      minHeight: '360px',
      margin: '0 auto'
    }}>
      {visualCards.map((card, index) => {
        const offset = index - activeIndex;
        const isActive = index === activeIndex;
        const isPast = index < activeIndex;

        let translateY = offset * 24;
        let scale = 1 - Math.abs(offset) * 0.05;
        let opacity = isActive ? 1 : (isPast ? 0 : 0.3);
        let pointerEvents: 'auto' | 'none' = isActive ? 'auto' : 'none';

        if (isPast) {
          translateY = -60;
          opacity = 0;
        }

        return (
          <div
            key={card.id}
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              background: '#ffffff',
              border: isActive ? '1.5px solid rgba(255, 100, 30, 0.35)' : '1px solid rgba(18, 18, 18, 0.08)',
              borderRadius: '20px',
              padding: '24px 22px',
              boxShadow: isActive
                ? '0 20px 48px rgba(255, 100, 30, 0.1), 0 6px 16px rgba(0,0,0,0.03)'
                : '0 6px 16px rgba(0,0,0,0.02)',
              transform: `translateY(${translateY}px) scale(${scale})`,
              opacity,
              pointerEvents,
              transition: 'all 0.45s cubic-bezier(0.16, 1, 0.3, 1)',
              zIndex: 10 - Math.abs(offset)
            }}
          >
            {/* 卡片顶部标题栏 */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
              <span style={{ fontSize: '1.05rem', fontWeight: 600, color: '#121212' }}>
                {card.title}
              </span>
              <span style={{
                fontSize: '0.7rem',
                fontWeight: 600,
                color: '#ff641e',
                background: 'rgba(255, 100, 30, 0.08)',
                padding: '3px 10px',
                borderRadius: '10px',
                border: '1px solid rgba(255, 100, 30, 0.15)'
              }}>
                {card.tag}
              </span>
            </div>

            {/* 卡片内部纯图表示意内容 */}
            {card.content}
          </div>
        );
      })}
    </div>
  );
}

/**
 * 第 3 幕：类似 Obsidian 知识图谱的动态示意图 (Canvas 物理引力自旋网格)
 */
export function KnowledgeNetwork() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let width = 460;
    let height = 460;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    ctx.scale(dpr, dpr);

    // 定义 Obsidian 风格的节点集群
    const nodes = [
      { id: 'core', label: '商业知识大脑', x: 230, y: 230, r: 16, color: '#ff641e', isCore: true },
      { id: 'c1', label: '客户360°洞察', x: 140, y: 150, r: 9, color: '#121212' },
      { id: 'c2', label: '品类市场大盘', x: 320, y: 160, r: 9, color: '#121212' },
      { id: 'c3', label: '每周行业雷达', x: 150, y: 310, r: 8, color: '#121212' },
      { id: 'c4', label: '私人调研笔记', x: 310, y: 300, r: 8, color: '#ff641e' },
      { id: 'sub1', label: '北美买家线索', x: 80, y: 110, r: 5, color: '#888' },
      { id: 'sub2', label: '采购组织架构', x: 90, y: 190, r: 5, color: '#888' },
      { id: 'sub3', label: '欧洲包装新规', x: 210, y: 90, r: 5, color: '#888' },
      { id: 'sub4', label: '价格带空白分析', x: 380, y: 120, r: 5, color: '#ff641e' },
      { id: 'sub5', label: '沃尔玛直采动态', x: 100, y: 370, r: 5, color: '#888' },
      { id: 'sub6', label: '差异化选品灵感', x: 370, y: 360, r: 5, color: '#ff641e' },
      { id: 'sub7', label: '核心竞对档案', x: 240, y: 380, r: 5, color: '#888' }
    ];

    const links = [
      ['core', 'c1'], ['core', 'c2'], ['core', 'c3'], ['core', 'c4'],
      ['c1', 'sub1'], ['c1', 'sub2'], ['c2', 'sub3'], ['c2', 'sub4'],
      ['c3', 'sub5'], ['c4', 'sub6'], ['core', 'sub7'],
      ['c1', 'c2'], ['c3', 'c4'], ['sub2', 'sub5']
    ];

    let angle = 0;
    let animId = 0;

    const render = () => {
      ctx.clearRect(0, 0, width, height);

      // 微角度平滑自转与轻柔漂浮
      angle += 0.003;
      const centerX = width / 2;
      const centerY = height / 2;

      // 1. 绘制连线与粒子
      links.forEach(([srcId, tgtId]) => {
        const src = nodes.find(n => n.id === srcId)!;
        const tgt = nodes.find(n => n.id === tgtId)!;

        // 计算带微自转的坐标
        const cosA = Math.cos(angle * 0.5);
        const sinA = Math.sin(angle * 0.5);

        const sx = centerX + (src.x - centerX) * cosA - (src.y - centerY) * sinA;
        const sy = centerY + (src.x - centerX) * sinA + (src.y - centerY) * cosA;

        const tx = centerX + (tgt.x - centerX) * cosA - (tgt.y - centerY) * sinA;
        const ty = centerY + (tgt.x - centerX) * sinA + (tgt.y - centerY) * cosA;

        ctx.beginPath();
        ctx.moveTo(sx, sy);
        ctx.lineTo(tx, ty);
        ctx.strokeStyle = (src.color === '#ff641e' || tgt.color === '#ff641e')
          ? 'rgba(255, 100, 30, 0.25)'
          : 'rgba(18, 18, 18, 0.08)';
        ctx.lineWidth = src.isCore ? 1.5 : 1;
        ctx.stroke();
      });

      // 2. 绘制节点与 Obsidian 风格标签
      nodes.forEach((node) => {
        const cosA = Math.cos(angle * 0.5);
        const sinA = Math.sin(angle * 0.5);

        const nx = centerX + (node.x - centerX) * cosA - (node.y - centerY) * sinA;
        const ny = centerY + (node.x - centerX) * sinA + (node.y - centerY) * cosA;

        // 外层微光
        if (node.color === '#ff641e') {
          ctx.beginPath();
          ctx.arc(nx, ny, node.r + 4, 0, Math.PI * 2);
          ctx.fillStyle = 'rgba(255, 100, 30, 0.18)';
          ctx.fill();
        }

        // 实体圆点
        ctx.beginPath();
        ctx.arc(nx, ny, node.r, 0, Math.PI * 2);
        ctx.fillStyle = node.color;
        ctx.fill();

        // 节点标签文字
        ctx.font = node.isCore ? 'bold 11px system-ui' : '9px system-ui';
        ctx.fillStyle = node.isCore ? '#ff641e' : '#444444';
        ctx.textAlign = 'center';
        ctx.fillText(node.label, nx, ny + node.r + 12);
      });

      animId = requestAnimationFrame(render);
    };

    render();

    return () => {
      cancelAnimationFrame(animId);
    };
  }, []);

  return (
    <div style={{
      position: 'relative',
      width: '100%',
      maxWidth: '480px',
      aspectRatio: '1 / 1',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      margin: '0 auto',
      background: 'rgba(255, 255, 255, 0.6)',
      borderRadius: '24px',
      border: '1px solid rgba(18, 18, 18, 0.06)',
      boxShadow: '0 16px 40px rgba(0, 0, 0, 0.03)'
    }}>
      <canvas
        ref={canvasRef}
        style={{
          width: '100%',
          height: '100%',
          display: 'block'
        }}
      />
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
