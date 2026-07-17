import React, { useState, useEffect, useRef } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import MGLogo from '../components/MGLogo';

// 3D 倾斜卡片组件 (带虚拟光源反光)
interface TiltCardProps {
  title: string;
  tag: string;
  desc: string;
  icon: string;
}

function TiltCard({ title, tag, desc, icon }: TiltCardProps) {
  const cardRef = useRef<HTMLDivElement>(null);
  const [coords, setCoords] = useState({ x: 0, y: 0 });
  const [isHovered, setIsHovered] = useState(false);

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!cardRef.current) return;
    const card = cardRef.current;
    const rect = card.getBoundingClientRect();
    
    // 计算鼠标相对卡片中心的百分比偏移 (-0.5 到 0.5)
    const x = (e.clientX - rect.left) / rect.width - 0.5;
    const y = (e.clientY - rect.top) / rect.height - 0.5;
    
    setCoords({ x, y });
  };

  const handleMouseLeave = () => {
    setIsHovered(false);
    setCoords({ x: 0, y: 0 });
  };

  const cardStyle: React.CSSProperties = {
    background: 'rgba(255, 255, 255, 0.45)',
    backdropFilter: 'blur(20px)',
    WebkitBackdropFilter: 'blur(20px)',
    border: '1px solid rgba(18, 18, 18, 0.05)',
    padding: '32px',
    borderRadius: '24px',
    position: 'relative',
    transition: 'transform 0.5s cubic-bezier(0.16, 1, 0.3, 1), box-shadow 0.5s cubic-bezier(0.16, 1, 0.3, 1)',
    transformStyle: 'preserve-3d',
    transform: isHovered 
      ? `perspective(1000px) rotateX(${-coords.y * 30}deg) rotateY(${coords.x * 30}deg) translateZ(20px)` 
      : 'perspective(1000px) rotateX(0deg) rotateY(0deg) translateZ(0px)',
    boxShadow: isHovered 
      ? '0 30px 60px rgba(160, 109, 68, 0.12), 0 0 0 1px rgba(255, 100, 30, 0.1)' 
      : '0 10px 40px rgba(160, 109, 68, 0.02)',
    cursor: 'pointer',
    overflow: 'hidden'
  };

  // 虚拟光源光斑样式
  const glowStyle: React.CSSProperties = {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    background: `radial-gradient(circle 200px at ${(coords.x + 0.5) * 100}% ${(coords.y + 0.5) * 100}%, rgba(255, 100, 30, 0.12) 0%, transparent 80%)`,
    pointerEvents: 'none',
    opacity: isHovered ? 1 : 0,
    transition: 'opacity 0.5s ease'
  };

  return (
    <div 
      ref={cardRef}
      style={cardStyle}
      onMouseMove={handleMouseMove}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={handleMouseLeave}
    >
      <div style={glowStyle} />
      <div style={{ transform: 'translateZ(30px)', transformStyle: 'preserve-3d' }}>
        <div style={{ fontSize: '2.5rem', marginBottom: '16px' }}>{icon}</div>
        <span style={{ 
          fontSize: '0.75rem', 
          color: 'var(--color-accent)', 
          fontWeight: 600, 
          letterSpacing: '1px', 
          textTransform: 'uppercase' 
        }}>
          {tag}
        </span>
        <h3 style={{ fontSize: '1.4rem', margin: '8px 0 12px 0', color: 'var(--color-text)', fontWeight: 500 }}>
          {title}
        </h3>
        <p style={{ 
          fontSize: '0.95rem', 
          color: 'var(--color-muted)', 
          lineHeight: 1.6, 
          margin: 0, 
          fontWeight: 300 
        }}>
          {desc}
        </p>
      </div>
    </div>
  );
}

export default function StoryDemoPage() {
  const [scrollY, setScrollY] = useState(0);
  const [windowHeight, setWindowHeight] = useState(800);
  const [lineProgress, setLineProgress] = useState(0);

  // 监听滚动事件
  useEffect(() => {
    const handleScroll = () => {
      setScrollY(window.scrollY);
    };
    const handleResize = () => {
      setWindowHeight(window.innerHeight);
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    window.addEventListener('resize', handleResize);
    handleResize();

    return () => {
      window.removeEventListener('scroll', handleScroll);
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  // 触发第3幕的连线绘制进度
  useEffect(() => {
    // 假设第3幕在滚动到 900px - 1500px 之间
    const start = 900;
    const end = 1500;
    if (scrollY < start) {
      setLineProgress(0);
    } else if (scrollY > end) {
      setLineProgress(1);
    } else {
      setLineProgress((scrollY - start) / (end - start));
    }
  }, [scrollY]);

  // 动态重计算 SVG 连线端点
  useEffect(() => {
    const updatePaths = () => {
      const svg = document.getElementById('svg-canvas');
      const l1 = document.getElementById('line-1');
      const l2 = document.getElementById('line-2');
      const l3 = document.getElementById('line-3');
      if (svg && l1 && l2 && l3) {
        const rect = svg.getBoundingClientRect();
        const cx = rect.width / 2;
        const cy = rect.height / 2;
        l1.setAttribute('d', `M ${cx},${cy} L ${cx - 280},${cy - 160}`);
        l2.setAttribute('d', `M ${cx},${cy} L ${cx + 280},${cy - 140}`);
        l3.setAttribute('d', `M ${cx},${cy} L ${cx + 40},${cy + 220}`);
      }
    };
    updatePaths();
    window.addEventListener('resize', updatePaths);
    return () => window.removeEventListener('resize', updatePaths);
  }, [lineProgress]);

  // 计算视差偏转系数
  const getParallaxY = (speed: number, baseOffset: number = 0) => {
    return (scrollY - baseOffset) * speed;
  };

  // 导航栏透明->磨砂玻璃过渡样式
  const isScrolled = scrollY > 50;

  return (
    <div style={{
      background: '#f8f6f2',
      color: '#0f172a',
      minHeight: '280vh',
      fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      position: 'relative',
      overflowX: 'hidden'
    }}>
      <Head>
        <title>Market Graphic - Interactive Storytelling Demo</title>
      </Head>

      {/* 1. 动态背景流光 (分层视差底色) */}
      <div style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100vw',
        height: '100vh',
        pointerEvents: 'none',
        zIndex: 1,
        overflow: 'hidden'
      }}>
        {/* 光斑 1 */}
        <div style={{
          position: 'absolute',
          top: '-10%',
          left: '20%',
          width: '50vw',
          height: '50vw',
          background: 'radial-gradient(circle, rgba(255, 100, 30, 0.08) 0%, transparent 70%)',
          transform: `translateY(${getParallaxY(-0.15)}px)`,
          filter: 'blur(60px)',
          transition: 'transform 0.1s ease-out'
        }} />
        {/* 光斑 2 */}
        <div style={{
          position: 'absolute',
          bottom: '10%',
          right: '10%',
          width: '45vw',
          height: '45vw',
          background: 'radial-gradient(circle, rgba(160, 109, 68, 0.06) 0%, transparent 75%)',
          transform: `translateY(${getParallaxY(-0.08)}px)`,
          filter: 'blur(80px)',
          transition: 'transform 0.1s ease-out'
        }} />
      </div>

      {/* 2. 统一导航栏 Banner Mockup */}
      <header style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        zIndex: 1000,
        transition: 'all 0.4s cubic-bezier(0.16, 1, 0.3, 1)',
        background: isScrolled ? 'rgba(255, 255, 255, 0.45)' : 'transparent',
        backdropFilter: isScrolled ? 'blur(15px)' : 'none',
        WebkitBackdropFilter: isScrolled ? 'blur(15px)' : 'none',
        borderBottom: isScrolled ? '1px solid rgba(18, 18, 18, 0.05)' : '1px solid transparent'
      }}>
        <div style={{
          maxWidth: '1400px',
          margin: '0 auto',
          padding: '16px 40px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <MGLogo height={48} />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '32px', fontSize: '0.95rem' }}>
            <span style={{ color: 'var(--color-accent)', fontWeight: 500, cursor: 'pointer' }}>每日资讯</span>
            <span style={{ color: 'var(--color-text)', cursor: 'pointer' }}>报告大厅</span>
            <span style={{ color: 'var(--color-text)', cursor: 'pointer' }}>个人图谱</span>
            <div style={{ width: '1px', height: '16px', background: 'rgba(18,18,18,0.1)' }} />
            <span style={{ color: 'var(--color-muted)' }}>额度: 15 次</span>
            <span style={{ fontWeight: 500, color: 'var(--color-text)' }}>杰克 ▾</span>
          </div>
        </div>
      </header>

      {/* 3. 第一幕：痛点引入 (The Pain) */}
      <section style={{
        height: '95vh',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center',
        padding: '0 20px',
        textAlign: 'center',
        position: 'relative',
        zIndex: 10
      }}>
        {/* 视差漂浮小气泡 */}
        <div style={{
          position: 'absolute',
          top: '25%',
          left: '15%',
          padding: '12px 24px',
          background: 'rgba(255, 255, 255, 0.7)',
          border: '1px solid rgba(0,0,0,0.04)',
          borderRadius: '30px',
          fontSize: '0.85rem',
          transform: `translateY(${getParallaxY(-0.3, 0)}px)`,
          opacity: Math.max(0, 1 - scrollY / 400),
          boxShadow: '0 4px 20px rgba(0,0,0,0.01)',
          pointerEvents: 'none'
        }}>
          🔍 竞品又上新品了？
        </div>
        <div style={{
          position: 'absolute',
          bottom: '25%',
          right: '15%',
          padding: '12px 24px',
          background: 'rgba(255, 255, 255, 0.7)',
          border: '1px solid rgba(0,0,0,0.04)',
          borderRadius: '30px',
          fontSize: '0.85rem',
          transform: `translateY(${getParallaxY(-0.4, 0)}px)`,
          opacity: Math.max(0, 1 - scrollY / 400),
          boxShadow: '0 4px 20px rgba(0,0,0,0.01)',
          pointerEvents: 'none'
        }}>
          💡 用户到底在抱怨什么？
        </div>

        <div style={{
          maxWidth: '850px',
          transform: `translateY(${getParallaxY(0.12, 0)}px)`,
          opacity: Math.max(0, 1 - scrollY / 600),
          transition: 'opacity 0.1s ease-out'
        }}>
          <span style={{
            color: 'var(--color-accent)',
            fontSize: '0.9rem',
            letterSpacing: '4px',
            textTransform: 'uppercase',
            fontWeight: 600,
            display: 'block',
            marginBottom: '16px'
          }}>
            The Pain & Gap
          </span>
          <h1 className="font-editorial" style={{
            fontSize: '3.6rem',
            fontWeight: 400,
            lineHeight: 1.2,
            margin: '0 0 24px 0',
            letterSpacing: '-0.02em'
          }}>
            海外找客户、看品类、听新闻，<br />
            <span style={{ color: 'var(--color-accent)' }}>为什么你总是慢人一步？</span>
          </h1>
          <p style={{
            fontSize: '1.25rem',
            color: 'var(--color-muted)',
            lineHeight: 1.7,
            maxWidth: '680px',
            margin: '0 auto',
            fontWeight: 300
          }}>
            在出海大局中，传统的调研被割裂在孤立的报告、摸不透的客户背景和散落的头条中。割裂的信息只是噪音，而真正的商机往往隐藏在“关联”之中。
          </p>
          <div style={{ marginTop: '40px', fontSize: '0.9rem', color: 'var(--color-accent)', fontWeight: 500 }}>
            向下滚动，开启全局视野 ▾
          </div>
        </div>
      </section>

      {/* 4. 第二幕：三大能力 (The Tri-Core Powers) */}
      <section style={{
        minHeight: '100vh',
        padding: '100px 40px',
        maxWidth: '1400px',
        margin: '0 auto',
        position: 'relative',
        zIndex: 10
      }}>
        <div style={{ textAlign: 'center', marginBottom: '64px' }}>
          <span style={{ color: 'var(--color-accent)', fontSize: '0.85rem', letterSpacing: '3px', textTransform: 'uppercase', fontWeight: 600 }}>
            Depth Intel
          </span>
          <h2 className="font-editorial" style={{ fontSize: '2.8rem', margin: '8px 0 0 0', fontWeight: 400 }}>
            三大关键情报穿透力
          </h2>
        </div>

        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))',
          gap: '32px'
        }}>
          <TiltCard
            tag="Daily Insights"
            icon="📡"
            title="每日行业资讯 ——「动态雷达」"
            desc="直击前线。紧盯产品创新、高管变更、渠道扩张/缩小、投资扩大/收缩，以及终端用户最真实的痛点反馈。让阅读直接转化为防御或进攻指令。"
          />
          <TiltCard
            tag="Company 360°"
            icon="🎯"
            title="公司 360° 洞察 ——「交易穿透」"
            desc="透视买手底盘。无论对方是零售模式（面向个人用户）还是经销模式（面向企业客户），一键剖析其财务健康、决策链路与采购逻辑，稳操胜券。"
          />
          <TiltCard
            tag="Category Landscape"
            icon="🗺️"
            title="品类现状剖析 ——「空白发现」"
            desc="解构市场现状，寻找市场空白。深剖特定产品品类的渗透率与竞争层级，指引产品和研发团队避开红海，精准切入未被满足的利基空缺。"
          />
        </div>
      </section>

      {/* 5. 第三幕：核心组网 (Network Engine - SVG 连线生长) */}
      <section style={{
        height: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        position: 'relative',
        zIndex: 10,
        background: '#1a1816', // 暗黑色背景突显发光拓扑连线
        color: '#ffffff'
      }}>
        {/* SVG 连线画布 */}
        <svg style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          pointerEvents: 'none'
        }} id="svg-canvas">
          {/* 连线 1：中心到左上 (资讯) */}
          <path 
            id="line-1"
            d="M 50,50 L 25,25" 
            pathLength="100" 
            stroke="url(#accentGrad)" 
            strokeWidth="2.5" 
            strokeDasharray="100" 
            strokeDashoffset={100 - lineProgress * 100}
            strokeLinecap="round"
          />
          {/* 连线 2：中心到右上 (公司) */}
          <path 
            id="line-2"
            d="M 50,50 L 75,25" 
            pathLength="100" 
            stroke="url(#accentGrad)" 
            strokeWidth="2.5" 
            strokeDasharray="100" 
            strokeDashoffset={100 - lineProgress * 100}
            strokeLinecap="round"
          />
          {/* 连线 3：中心到下 (品类) */}
          <path 
            id="line-3"
            d="M 50,50 L 50,80" 
            pathLength="100" 
            stroke="url(#accentGrad)" 
            strokeWidth="2.5" 
            strokeDasharray="100" 
            strokeDashoffset={100 - lineProgress * 100}
            strokeLinecap="round"
          />

          <defs>
            <linearGradient id="accentGrad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#ff641e" stopOpacity="1" />
              <stop offset="100%" stopColor="#ffa04d" stopOpacity="0.4" />
            </linearGradient>
          </defs>
        </svg>



        <div style={{
          position: 'relative',
          maxWidth: '1200px',
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center'
        }}>
          {/* 中心节点：私人专属大脑 */}
          <div style={{
            width: '180px',
            height: '180px',
            borderRadius: '50%',
            background: 'radial-gradient(circle, #ff641e 0%, #cc4b0e 100%)',
            boxShadow: '0 0 50px rgba(255, 100, 30, 0.4), inset 0 0 20px rgba(255,255,255,0.3)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 20,
            textAlign: 'center',
            padding: '16px',
            transition: 'transform 0.3s ease',
            transform: `scale(${1 + lineProgress * 0.08})`
          }}>
            <span style={{ fontSize: '1.8rem' }}>🧠</span>
            <span style={{ fontSize: '1.05rem', fontWeight: 600, marginTop: '8px' }}>私人专属<br />知识大脑</span>
          </div>

          {/* 关联气泡 1：左上 (每日资讯) */}
          <div style={{
            position: 'absolute',
            top: 'calc(50% - 240px)',
            left: 'calc(50% - 390px)',
            width: '180px',
            height: '100px',
            borderRadius: '20px',
            background: 'rgba(255, 255, 255, 0.08)',
            border: '1px solid rgba(255, 255, 255, 0.15)',
            boxShadow: '0 20px 40px rgba(0,0,0,0.3)',
            backdropFilter: 'blur(10px)',
            zIndex: 15,
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            padding: '16px',
            transform: `translateY(${getParallaxY(-0.1, 1200)}px) scale(${0.8 + lineProgress * 0.2})`,
            opacity: lineProgress,
            transition: 'opacity 0.4s ease, transform 0.4s ease'
          }}>
            <span style={{ fontSize: '1.8rem' }}>📡</span>
            <div style={{ fontSize: '0.85rem', lineHeight: '1.3' }}>
              <b>资讯流</b><br />
              <span style={{ color: 'rgba(255,255,255,0.6)' }}>关联产品创新</span>
            </div>
          </div>

          {/* 关联气泡 2：右上 (公司洞察) */}
          <div style={{
            position: 'absolute',
            top: 'calc(50% - 200px)',
            right: 'calc(50% - 390px)',
            width: '180px',
            height: '100px',
            borderRadius: '20px',
            background: 'rgba(255, 255, 255, 0.08)',
            border: '1px solid rgba(255, 255, 255, 0.15)',
            boxShadow: '0 20px 40px rgba(0,0,0,0.3)',
            backdropFilter: 'blur(10px)',
            zIndex: 15,
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            padding: '16px',
            transform: `translateY(${getParallaxY(-0.15, 1200)}px) scale(${0.8 + lineProgress * 0.2})`,
            opacity: lineProgress,
            transition: 'opacity 0.4s ease, transform 0.4s ease'
          }}>
            <span style={{ fontSize: '1.8rem' }}>🎯</span>
            <div style={{ fontSize: '0.85rem', lineHeight: '1.3' }}>
              <b>公司画像</b><br />
              <span style={{ color: 'rgba(255,255,255,0.6)' }}>直透经销模式</span>
            </div>
          </div>

          {/* 关联气泡 3：下方偏右 (品类现状) */}
          <div style={{
            position: 'absolute',
            bottom: 'calc(50% - 280px)',
            left: 'calc(50% + 140px)',
            width: '180px',
            height: '100px',
            borderRadius: '20px',
            background: 'rgba(255, 255, 255, 0.08)',
            border: '1px solid rgba(255, 255, 255, 0.15)',
            boxShadow: '0 20px 40px rgba(0,0,0,0.3)',
            backdropFilter: 'blur(10px)',
            zIndex: 15,
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            padding: '16px',
            transform: `translateY(${getParallaxY(-0.05, 1200)}px) scale(${0.8 + lineProgress * 0.2})`,
            opacity: lineProgress,
            transition: 'opacity 0.4s ease, transform 0.4s ease'
          }}>
            <span style={{ fontSize: '1.8rem' }}>🗺️</span>
            <div style={{ fontSize: '0.85rem', lineHeight: '1.3' }}>
              <b>品类空白</b><br />
              <span style={{ color: 'rgba(255,255,255,0.6)' }}>探索市场地图</span>
            </div>
          </div>

          {/* 右侧核心说明文案 */}
          <div style={{
            position: 'absolute',
            left: '50px',
            bottom: '80px',
            maxWidth: '440px',
            zIndex: 25,
            background: 'rgba(26, 24, 22, 0.8)',
            padding: '24px',
            borderRadius: '16px',
            backdropFilter: 'blur(10px)'
          }}>
            <span style={{ color: '#ff641e', fontSize: '0.75rem', letterSpacing: '2px', fontWeight: 600, textTransform: 'uppercase' }}>
              Network Engine
            </span>
            <h4 style={{ fontSize: '1.3rem', margin: '8px 0 12px 0', fontWeight: 400 }}>
              情报不该孤立，而应自动交织组网
            </h4>
            <p style={{ fontSize: '0.9rem', color: 'rgba(255,255,255,0.7)', lineHeight: 1.6, margin: 0, fontWeight: 300 }}>
              在您的私域知识图谱中，每一条关于产品创新的新闻、每一份公司背景洞察，以及您随手记录的见解，都会自动结网生长。像私人商业大脑一样，不断进化扩充您的外贸认知版图。
            </p>
          </div>
        </div>
      </section>

      {/* 6. 第四幕：双核补充 (Trust & Collaboration) */}
      <section style={{
        padding: '120px 40px',
        maxWidth: '1200px',
        margin: '0 auto',
        position: 'relative',
        zIndex: 10
      }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(450px, 1fr))', gap: '48px' }}>
          {/* 私人图谱个性化 */}
          <div style={{
            background: 'rgba(255, 255, 255, 0.4)',
            border: '1px solid rgba(18, 18, 18, 0.04)',
            borderRadius: '24px',
            padding: '40px',
            backdropFilter: 'blur(10px)'
          }}>
            <span style={{ fontSize: '2rem' }}>🛡️</span>
            <h3 style={{ fontSize: '1.5rem', fontWeight: 500, margin: '16px 0 12px 0' }}>
              私人定制，完全联合您的商业脉络
            </h3>
            <p style={{ color: 'var(--color-muted)', lineHeight: 1.6, fontWeight: 300, fontSize: '1rem', margin: 0 }}>
              这不是一份千篇一律的公开市场报告。所有的分析、公司关注链条和笔记都可以根据您私人的习惯与关注度来进行深度个性化。在安全的物理隔离环境下，构建您自己受保护的机密商业图谱。
            </p>
          </div>

          {/* 团队协同 */}
          <div style={{
            background: 'rgba(255, 255, 255, 0.4)',
            border: '1px solid rgba(18, 18, 18, 0.04)',
            borderRadius: '24px',
            padding: '40px',
            backdropFilter: 'blur(10px)'
          }}>
            <span style={{ fontSize: '2rem' }}>👥</span>
            <h3 style={{ fontSize: '1.5rem', fontWeight: 500, margin: '16px 0 12px 0' }}>
              打破信息墙，一份图谱实现团队共识
            </h3>
            <p style={{ color: 'var(--color-muted)', lineHeight: 1.6, fontWeight: 300, fontSize: '1rem', margin: 0 }}>
              业务员沉淀的公司背景、研发关注的品类空白、决策层总览的宏观行业大动态，现在全部在同一张网络中流转。一键共享，让全团队在同一个维度上实现快速战术合围与产品迭代。
            </p>
          </div>
        </div>
      </section>

      {/* 7. 第五幕：裂变与行动 (CTA) */}
      <section style={{
        padding: '0 40px 100px 40px',
        maxWidth: '1200px',
        margin: '0 auto',
        position: 'relative',
        zIndex: 10
      }}>
        <div style={{
          background: 'linear-gradient(135deg, rgba(255, 100, 30, 0.05) 0%, rgba(160, 109, 68, 0.02) 100%)',
          border: '1px solid rgba(255, 100, 30, 0.1)',
          padding: '64px 32px',
          borderRadius: '32px',
          textAlign: 'center',
          backdropFilter: 'blur(10px)'
        }}>
          <h2 className="font-editorial" style={{ fontSize: '2.5rem', fontWeight: 400, marginBottom: '16px' }}>
            与同行者一起，构建更具前瞻性的商业大脑
          </h2>
          <p style={{ color: 'var(--color-muted)', maxWidth: '600px', margin: '0 auto 40px auto', lineHeight: 1.6, fontWeight: 300 }}>
            现在每成功邀请一位行业伙伴加入，你们将共同获取 **5 次** 深度品类现状剖析额度，开始构建你们共用的商业网络。
          </p>
          <div style={{ display: 'flex', gap: '16px', justifyContent: 'center' }}>
            <Link href="/" style={{
              background: 'var(--color-accent)',
              color: '#ffffff',
              padding: '16px 36px',
              borderRadius: '30px',
              textDecoration: 'none',
              fontWeight: 500,
              boxShadow: '0 10px 30px rgba(255, 100, 30, 0.2)',
              transition: 'transform 0.2s'
            }}>
              立即注册，开始绘图 ➔
            </Link>
          </div>
        </div>
      </section>

      {/* 8. 演示页面专有：返回指示 */}
      <div style={{
        position: 'fixed',
        bottom: '24px',
        left: '24px',
        zIndex: 100,
        background: '#121212',
        color: '#ffffff',
        padding: '12px 24px',
        borderRadius: '30px',
        boxShadow: '0 10px 30px rgba(0,0,0,0.3)',
        fontSize: '0.9rem',
        display: 'flex',
        alignItems: 'center',
        gap: '8px'
      }}>
        ✨ <b>演示模式</b>
        <span style={{ color: 'rgba(255,255,255,0.5)' }}>|</span>
        <Link href="/" style={{ color: 'var(--color-accent)', textDecoration: 'none', fontWeight: 500 }}>
          返回原版主页 ➔
        </Link>
      </div>
    </div>
  );
}
