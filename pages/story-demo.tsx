import React, { useState, useEffect, useRef } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import MGLogo from '../components/MGLogo';

export default function VideoScrubDemo() {
  const introRef = useRef<HTMLVideoElement>(null);
  const mainRef = useRef<HTMLVideoElement>(null);
  const outroRef = useRef<HTMLVideoElement>(null);

  const sec1Ref = useRef<HTMLDivElement>(null);
  const sec2Ref = useRef<HTMLDivElement>(null);
  const sec3Ref = useRef<HTMLDivElement>(null);
  const sec4Ref = useRef<HTMLDivElement>(null);
  
  const [scrollYState, setScrollYState] = useState(0);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [progressPercent, setProgressPercent] = useState(0);

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
      // 1. Lerp 进度百分比，获得流畅的过渡动画
      currentRenderPercent += (targetPercent - currentRenderPercent) * 0.08;
      
      const scrollPercent = Math.max(0, Math.min(1, currentRenderPercent));
      setProgressPercent(scrollPercent);

      let introOpacity = 0;
      let mainOpacity = 0;
      let outroOpacity = 0;

      const mainDuration = mainVideo ? mainVideo.duration || 12 : 12;

      // 2. 视频层淡入淡出及播放/暂停控制逻辑 (CPU 释放优化)
      if (scrollPercent <= 0) {
        introOpacity = 1;
        if (introVideo && introVideo.paused) {
          introVideo.play().catch(() => {});
        }
        if (mainVideo && !mainVideo.paused) mainVideo.pause();
        if (outroVideo && !outroVideo.paused) outroVideo.pause();
      } else if (scrollPercent > 0 && scrollPercent < 0.98) {
        // 前 5% 从 intro 过渡到 main
        if (scrollPercent < 0.05) {
          const ratio = scrollPercent / 0.05;
          introOpacity = 1 - ratio;
          mainOpacity = ratio;
          
          if (introVideo && introVideo.paused) introVideo.play().catch(() => {});
          if (mainVideo && !mainVideo.paused) mainVideo.pause();
          if (outroVideo && !outroVideo.paused) outroVideo.pause();
        } 
        // 后 5% 从 main 过渡到 outro
        else if (scrollPercent > 0.93) {
          const ratio = (scrollPercent - 0.93) / 0.05;
          mainOpacity = 1 - ratio;
          outroOpacity = ratio;
          
          if (introVideo && !introVideo.paused) introVideo.pause();
          if (mainVideo && !mainVideo.paused) mainVideo.pause();
          if (outroVideo && outroVideo.paused) outroVideo.play().catch(() => {});
        } 
        // 中间主体只显示 main，并暂停其他视频释放 CPU
        else {
          mainOpacity = 1;
          if (introVideo && !introVideo.paused) introVideo.pause();
          if (outroVideo && !outroVideo.paused) outroVideo.pause();
        }

        // 对 main 视频执行 currentTime 追随 (Lerp 缓动 seek)
        if (mainVideo && mainVideo.readyState >= 2) {
          const mainPercent = (scrollPercent - 0.05) / 0.88; // 归一化到 0-1
          const targetTime = Math.max(0, Math.min(mainDuration - 0.05, mainPercent * mainDuration));
          currentRenderTime += (targetTime - currentRenderTime) * 0.08;
          mainVideo.currentTime = currentRenderTime;
        }
      } else {
        // 彻底触底
        outroOpacity = 1;
        if (outroVideo && outroVideo.paused) {
          outroVideo.play().catch(() => {});
        }
        if (introVideo && !introVideo.paused) introVideo.pause();
        if (mainVideo && !mainVideo.paused) mainVideo.pause();
      }

      // 通过原生 DOM 属性修改 opacity 避免 React 重绘
      if (introVideo) introVideo.style.opacity = introOpacity.toString();
      if (mainVideo) mainVideo.style.opacity = mainOpacity.toString();
      if (outroVideo) outroVideo.style.opacity = outroOpacity.toString();

      // 3. 文案层淡入淡出及位移控制逻辑
      const updateSection = (sec: HTMLDivElement | null, start: number, active: number, end: number, isLast = false) => {
        if (!sec) return;
        let opacity = 0;
        let translateY = 20; // 初始向下偏移 20px

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
        sec.style.display = opacity === 0 ? 'none' : 'flex';
      };

      // 划分四幕文案的滚动活跃区间
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
      setScrollYState(window.scrollY);
    };

    const handleVideoError = () => {
      setErrorMessage("视频加载失败，请确保 public 目录下有 intro_bg.mp4、main_bg.mp4 和 outro_bg.mp4。");
    };

    if (introVideo) introVideo.addEventListener('error', handleVideoError);
    if (mainVideo) mainVideo.addEventListener('error', handleVideoError);
    if (outroVideo) outroVideo.addEventListener('error', handleVideoError);

    window.addEventListener('scroll', handleScroll, { passive: true });
    animationFrameId = requestAnimationFrame(renderLoop);

    return () => {
      if (introVideo) introVideo.removeEventListener('error', handleVideoError);
      if (mainVideo) mainVideo.removeEventListener('error', handleVideoError);
      if (outroVideo) outroVideo.removeEventListener('error', handleVideoError);
      window.removeEventListener('scroll', handleScroll);
      cancelAnimationFrame(animationFrameId);
    };
  }, []);

  const isScrolled = scrollYState > 50;

  return (
    <div style={{
      background: '#090808',
      color: '#ffffff',
      minHeight: '450vh', // 给足滚动行程
      fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, sans-serif',
      position: 'relative'
    }}>
      <Head>
        <title>Market Graphic - 三视频无缝滚动叙事</title>
      </Head>

      {/* 1. 底图层: 视口固定播放器 */}
      <div style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100vw',
        height: '100vh',
        zIndex: 1,
        pointerEvents: 'none',
        overflow: 'hidden'
      }}>
        {/* 覆盖一层暗色及磨砂渐变，让文案更容易看清 */}
        <div style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'radial-gradient(circle at center, rgba(9, 8, 8, 0.4) 0%, rgba(9, 8, 8, 0.9) 80%)',
          zIndex: 4,
          pointerEvents: 'none'
        }} />

        {/* 呼吸流光粒子视频 (首屏) */}
        <video
          ref={introRef}
          src="/intro_bg.mp4"
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            display: 'block',
            opacity: 1,
            transition: 'none'
          }}
          muted
          loop
          playsInline
          preload="auto"
        />

        {/* 数据网络交互视频 (主体滚动) */}
        <video
          ref={mainRef}
          src="/main_bg.mp4"
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            display: 'block',
            opacity: 0,
            transition: 'none'
          }}
          muted
          playsInline
          preload="auto"
        />

        {/* 商业大脑自转视频 (触底) */}
        <video
          ref={outroRef}
          src="/outro_bg.mp4"
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            display: 'block',
            opacity: 0,
            transition: 'none'
          }}
          muted
          loop
          playsInline
          preload="auto"
        />
      </div>

      {/* 2. 置顶导航栏 */}
      <header style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        zIndex: 1000,
        transition: 'all 0.4s',
        background: isScrolled ? 'rgba(9, 8, 8, 0.7)' : 'transparent',
        backdropFilter: isScrolled ? 'blur(20px)' : 'none',
        WebkitBackdropFilter: isScrolled ? 'blur(20px)' : 'none',
        borderBottom: isScrolled ? '1px solid rgba(255, 255, 255, 0.1)' : '1px solid transparent'
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
            <span style={{ color: '#ff641e', fontWeight: 500, cursor: 'pointer' }}>每日资讯</span>
            <span style={{ color: '#ffffff', cursor: 'pointer' }}>报告大厅</span>
            <span style={{ color: '#ffffff', cursor: 'pointer' }}>个人图谱</span>
            <div style={{ width: '1px', height: '16px', background: 'rgba(255,255,255,0.2)' }} />
            <span style={{ color: 'rgba(255,255,255,0.6)' }}>额度: 15 次</span>
            <span style={{ fontWeight: 500, color: '#ffffff' }}>杰克 ▾</span>
          </div>
        </div>
      </header>

      {/* 3. 固定视口沉浸式文案层 */}
      <div style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100vw',
        height: '100vh',
        zIndex: 10,
        pointerEvents: 'none',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center'
      }}>
        <div style={{ pointerEvents: 'auto', width: '100%', height: '100%', position: 'relative' }}>
          
          {/* 🎬 第1幕: 痛点引入 */}
          <div ref={sec1Ref} style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '0 20px',
            textAlign: 'center',
            opacity: 1,
            transform: 'translateY(0px)',
            transition: 'none'
          }}>
            <div style={{ maxWidth: '850px' }}>
              <span style={{
                color: '#ff641e',
                fontSize: '0.9rem',
                letterSpacing: '4px',
                textTransform: 'uppercase',
                fontWeight: 600,
                display: 'block',
                marginBottom: '16px'
              }}>
                The Pain & Gap
              </span>
              <h1 style={{
                fontSize: '3.6rem',
                fontWeight: 400,
                lineHeight: 1.25,
                margin: '0 0 24px 0',
                letterSpacing: '-0.02em',
                color: '#ffffff'
              }}>
                海外找客户、看品类、听新闻，<br />
                <span style={{ color: '#ff641e' }}>为什么你总是慢人一步？</span>
              </h1>
              <p style={{
                fontSize: '1.25rem',
                color: 'rgba(255,255,255,0.7)',
                lineHeight: 1.7,
                maxWidth: '680px',
                margin: '0 auto',
                fontWeight: 300
              }}>
                在出海大潮中，传统的调研被割裂在孤立的新闻、摸不透的客户底细和散落的头条中。割裂的信息只是噪音，决策慢一步，商机便差之千里。
              </p>
              <div style={{ marginTop: '48px', fontSize: '0.95rem', color: '#ff641e', fontWeight: 500 }}>
                向下滚动，拉动视频进度条 ▾
              </div>
            </div>
          </div>

          {/* 🎬 第2幕: 三大关键能力 */}
          <div ref={sec2Ref} style={{
            position: 'absolute',
            inset: 0,
            display: 'none',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '0 40px',
            opacity: 0,
            transform: 'translateY(20px)',
            transition: 'none'
          }}>
            <div style={{ textAlign: 'center', marginBottom: '48px' }}>
              <span style={{ color: '#ff641e', fontSize: '0.85rem', letterSpacing: '3px', textTransform: 'uppercase', fontWeight: 600 }}>
                Three Core Columns
              </span>
              <h2 style={{ fontSize: '2.8rem', margin: '8px 0 0 0', fontWeight: 400, color: '#ffffff' }}>
                深度情报穿透力
              </h2>
            </div>

            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
              gap: '24px',
              maxWidth: '1200px',
              width: '100%'
            }}>
              {/* 卡片 1 */}
              <div style={{ background: 'rgba(255, 255, 255, 0.06)', border: '1px solid rgba(255, 255, 255, 0.1)', padding: '28px', borderRadius: '16px', backdropFilter: 'blur(10px)' }}>
                <div style={{ fontSize: '2rem', marginBottom: '12px' }}>📡</div>
                <h3 style={{ fontSize: '1.25rem', color: '#ffffff', margin: '0 0 8px 0' }}>每日行业资讯 ——「动态雷达」</h3>
                <p style={{ color: 'rgba(255, 255, 255, 0.6)', fontSize: '0.9rem', lineHeight: 1.5, margin: 0, fontWeight: 300 }}>
                  紧盯产品创新、高管变更、渠道扩张/缩小、投资扩大/收缩，以及终端用户最真实的痛点反馈。让每一次阅读都直接转化为业务预警。
                </p>
              </div>
              {/* 卡片 2 */}
              <div style={{ background: 'rgba(255, 255, 255, 0.06)', border: '1px solid rgba(255, 255, 255, 0.1)', padding: '28px', borderRadius: '16px', backdropFilter: 'blur(10px)' }}>
                <div style={{ fontSize: '2rem', marginBottom: '12px' }}>🎯</div>
                <h3 style={{ fontSize: '1.25rem', color: '#ffffff', margin: '0 0 8px 0' }}>公司 360° 洞察 ——「交易穿透」</h3>
                <p style={{ color: 'rgba(255, 255, 255, 0.6)', fontSize: '0.9rem', lineHeight: 1.5, margin: 0, fontWeight: 300 }}>
                  透视零售模式（面向个人用户）或经销模式（面向企业用户）底牌，一键穿透其财务状况、组织架构和核心采购逻辑。
                </p>
              </div>
              {/* 卡片 3 */}
              <div style={{ background: 'rgba(255, 255, 255, 0.06)', border: '1px solid rgba(255, 255, 255, 0.1)', padding: '28px', borderRadius: '16px', backdropFilter: 'blur(10px)' }}>
                <div style={{ fontSize: '2rem', marginBottom: '12px' }}>🗺️</div>
                <h3 style={{ fontSize: '1.25rem', color: '#ffffff', margin: '0 0 8px 0' }}>品类现状剖析 ——「空白发现」</h3>
                <p style={{ color: 'rgba(255, 255, 255, 0.6)', fontSize: '0.9rem', lineHeight: 1.5, margin: 0, fontWeight: 300 }}>
                  深度解构品类市场现状，看清渗透率与竞争格局，指导产品团队和研发团队避开红海，直击那些未被满足的市场空白点。
                </p>
              </div>
            </div>
          </div>

          {/* 🎬 第3幕: 核心组网 */}
          <div ref={sec3Ref} style={{
            position: 'absolute',
            inset: 0,
            display: 'none',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '0 20px',
            opacity: 0,
            transform: 'translateY(20px)',
            transition: 'none'
          }}>
            <div style={{
              background: 'rgba(9, 8, 8, 0.85)',
              border: '1px solid rgba(255, 255, 255, 0.15)',
              padding: '48px',
              borderRadius: '24px',
              maxWidth: '680px',
              textAlign: 'center',
              backdropFilter: 'blur(15px)',
              boxShadow: '0 30px 60px rgba(0,0,0,0.5)'
            }}>
              <span style={{ color: '#ff641e', fontSize: '0.8rem', letterSpacing: '2px', fontWeight: 600, textTransform: 'uppercase' }}>
                Personal Knowledge Graph
              </span>
              <h3 style={{ fontSize: '2.2rem', color: '#ffffff', margin: '16px 0 16px 0', fontWeight: 400 }}>
                这是与您业务共同进化的<br />
                <span style={{ color: '#ff641e' }}>「私人专属商业大脑」</span>
              </h3>
              <p style={{ fontSize: '1.05rem', color: 'rgba(255,255,255,0.7)', lineHeight: 1.7, margin: 0, fontWeight: 300 }}>
                在 MARKET GRAPHIC，资讯、公司和品类绝非孤立存在。每一条你关注的产品动态、每一篇留留下来的笔记，都会自动交织、结网生长，绘制出完全契合您业务习惯的个性化商业版图。
              </p>
            </div>
          </div>

          {/* 🎬 第4幕: 团队协同与裂变行动 */}
          <div ref={sec4Ref} style={{
            position: 'absolute',
            inset: 0,
            display: 'none',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '0 20px',
            opacity: 0,
            transform: 'translateY(20px)',
            transition: 'none'
          }}>
            <div style={{
              background: 'linear-gradient(135deg, rgba(255, 100, 30, 0.15) 0%, rgba(0, 0, 0, 0.8) 100%)',
              border: '1px solid rgba(255, 100, 30, 0.25)',
              padding: '56px 40px',
              borderRadius: '32px',
              maxWidth: '900px',
              textAlign: 'center',
              backdropFilter: 'blur(15px)',
              boxShadow: '0 30px 60px rgba(255, 100, 30, 0.05)'
            }}>
              <h3 style={{ fontSize: '2.4rem', fontWeight: 400, color: '#ffffff', marginBottom: '16px' }}>
                一份图谱，打破团队信息墙
              </h3>
              <p style={{ color: 'rgba(255,255,255,0.7)', maxWidth: '640px', margin: '0 auto 36px auto', lineHeight: 1.6, fontWeight: 300 }}>
                销售沉淀的公司线索，关联研发关注的品类痛点，协助决策层总揽全局。现在邀请同行加入，你们将共同获取 **5 次** 深度品类现状剖析额度，共同探索全新商机。
              </p>
              <div style={{ display: 'flex', gap: '16px', justifyContent: 'center' }}>
                <Link href="/" style={{
                  background: '#ff641e',
                  color: '#ffffff',
                  padding: '16px 36px',
                  borderRadius: '30px',
                  textDecoration: 'none',
                  fontWeight: 500,
                  boxShadow: '0 10px 30px rgba(255, 100, 30, 0.3)'
                }}>
                  立即注册，开始绘图 ➔
                </Link>
              </div>
            </div>
          </div>

        </div>
      </div>

      {/* 4. 底部状态栏及 AI 视频提示 */}
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
        fontSize: '0.85rem',
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        border: '1px solid rgba(255,255,255,0.1)'
      }}>
        <span style={{ color: '#ff641e' }}>●</span>
        <span><b>视频时间线滚动模式</b></span>
        <span style={{ color: 'rgba(255,255,255,0.3)' }}>|</span>
        <span style={{ color: 'rgba(255,255,255,0.7)' }}>
          {errorMessage ? errorMessage : `滚动进度: ${(progressPercent * 100).toFixed(0)}%`}
        </span>
        <span style={{ color: 'rgba(255,255,255,0.3)' }}>|</span>
        <Link href="/" style={{ color: '#ff641e', textDecoration: 'none', fontWeight: 500 }}>
          返回原版主页 ➔
        </Link>
      </div>

      {/* 在线测试提示浮窗 */}
      <div style={{
        position: 'fixed',
        bottom: '24px',
        right: '24px',
        maxWidth: '300px',
        background: 'rgba(255,255,255,0.05)',
        border: '1px solid rgba(255,255,255,0.1)',
        backdropFilter: 'blur(10px)',
        padding: '16px',
        borderRadius: '12px',
        fontSize: '0.8rem',
        color: 'rgba(255,255,255,0.8)',
        zIndex: 100
      }}>
        💡 <b>AI 三视频无缝过渡说明</b>：<br />
        已自动匹配压缩版 <code>intro_bg.mp4</code>、<code>main_bg.mp4</code>、<code>outro_bg.mp4</code>。随滚动条下移，粒子背景视频淡出，自动开始数据网络帧级别 Scrub，触底时自转大脑无限循环！
      </div>
    </div>
  );
}
