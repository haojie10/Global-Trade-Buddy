import React, { useState, useEffect, useRef } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import MGLogo from '../components/MGLogo';

export default function VideoScrubDemo() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  
  const [scrollY, setScrollY] = useState(0);
  const [videoReady, setVideoReady] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // 12秒视频时长，通常 AI 生成 10-15 秒最合适
  const [videoDuration, setVideoDuration] = useState(12); 

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    // 当元数据加载完获取精确时长
    const onLoadedMetadata = () => {
      setVideoDuration(video.duration || 12);
      setVideoReady(true);
    };

    const onError = () => {
      setErrorMessage("在线测试视频加载超时，您也可以直接将您的 AI 视频命名为 story_bg.mp4 放入 public 文件夹中进行测试。");
    };

    video.addEventListener('loadedmetadata', onLoadedMetadata);
    video.addEventListener('error', onError);

    // 缓动循环 (Lerp)，让视频播放平滑逼近滚动点
    let animationFrameId: number;
    let targetTime = 0;
    let currentRenderTime = 0;

    const renderLoop = () => {
      if (video && video.readyState >= 2) {
        // 0.08 的阻尼系数，产生类似于苹果官网的延迟滚动动画质感
        currentRenderTime += (targetTime - currentRenderTime) * 0.08;
        
        // 限制在合理范围内
        const duration = video.duration || 12;
        const boundedTime = Math.max(0, Math.min(duration - 0.05, currentRenderTime));
        
        video.currentTime = boundedTime;
      }
      animationFrameId = requestAnimationFrame(renderLoop);
    };

    const handleScroll = () => {
      const scrollHeight = document.documentElement.scrollHeight;
      const clientHeight = window.innerHeight;
      const maxScroll = scrollHeight - clientHeight;
      if (maxScroll <= 0) return;

      const scrollPercent = window.scrollY / maxScroll;
      const duration = video.duration || 12;
      targetTime = scrollPercent * duration;

      setScrollY(window.scrollY);
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    animationFrameId = requestAnimationFrame(renderLoop);

    // 默认加载检查
    if (video.readyState >= 1) {
      onLoadedMetadata();
    }

    return () => {
      video.removeEventListener('loadedmetadata', onLoadedMetadata);
      video.removeEventListener('error', onError);
      window.removeEventListener('scroll', handleScroll);
      cancelAnimationFrame(animationFrameId);
    };
  }, []);

  // 根据滚动计算对应幕数的文案卡片透明度 (分段淡入淡出)
  const getSceneOpacity = (sceneStart: number, sceneActive: number, sceneEnd: number) => {
    if (scrollY < sceneStart) return 0;
    if (scrollY > sceneEnd) return 0;
    if (scrollY >= sceneStart && scrollY < sceneActive) {
      return (scrollY - sceneStart) / (sceneActive - sceneStart); // 淡入
    }
    return 1 - (scrollY - sceneActive) / (sceneEnd - sceneActive); // 淡出
  };

  const isScrolled = scrollY > 50;

  return (
    <div ref={containerRef} style={{
      background: '#090808',
      color: '#ffffff',
      minHeight: '400vh', // 给足滚动距离
      fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, sans-serif',
      position: 'relative'
    }}>
      <Head>
        <title>Market Graphic - Video Scroll Scrubbing Demo</title>
      </Head>

      {/* 1. 核心底图: 视口固定播放器 */}
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
          zIndex: 2,
          pointerEvents: 'none'
        }} />

        <video
          ref={videoRef}
          src="https://assets.mixkit.co/videos/preview/mixkit-abstract-laser-lights-background-31998-large.mp4"
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            display: 'block'
          }}
          muted
          playsInline
          preload="auto"
        />
      </div>

      {/* 2. 贴顶置顶导航栏 (和主站一致) */}
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

      {/* 3. 上层滚动叙事卡片区 (卡片浮在固定视频之上，随滚动渐入渐出) */}
      <div style={{ position: 'relative', zIndex: 10 }}>

        {/* 🎬 第1幕: 痛点引入 (滚动范围 0px - 800px) */}
        <section style={{
          height: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '0 20px',
          textAlign: 'center',
          opacity: getSceneOpacity(0, 200, 600),
          transform: `translateY(${-scrollY * 0.2}px)`, // 视差平移
          transition: 'opacity 0.1s ease-out'
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
        </section>

        {/* 🎬 第2幕: 三大关键能力 (滚动范围 800px - 1800px) */}
        <section style={{
          height: '100vh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '0 40px',
          opacity: getSceneOpacity(600, 1100, 1600),
          transition: 'opacity 0.1s ease-out'
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
        </section>

        {/* 🎬 第3幕: 核心组网 (滚动范围 1800px - 2800px) */}
        <section style={{
          height: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '0 20px',
          opacity: getSceneOpacity(1600, 2100, 2600),
          transition: 'opacity 0.1s ease-out'
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
              在 MARKET GRAPHIC，资讯、公司和品类绝非孤立存在。每一条你关注的产品动态、每一篇留下的笔记，都会自动交织、结网生长，绘制出完全契合您业务习惯的个性化商业版图。
            </p>
          </div>
        </section>

        {/* 🎬 第4幕: 团队协同与裂变行动 (滚动范围 2800px - 结束) */}
        <section style={{
          height: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '0 20px',
          opacity: getSceneOpacity(2600, 3100, 4000),
          transition: 'opacity 0.1s ease-out'
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
        </section>

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
          {errorMessage ? "当前使用占位视频" : `视频载入成功: ${(scrollY / (4000 - 800) * 100).toFixed(0)}%`}
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
        💡 <b>AI 视频替换指南</b>：<br />
        当前使用的是在线流光视频占位。您在本地只需将您生成的 AI 视频（建议 MP4，12秒左右）重命名为 <code>story_bg.mp4</code> 放入项目 <code>public/</code> 目录，并在本文件代码中把 video 的 <code>src</code> 改为 <code>"/story_bg.mp4"</code>，即可秒变专属大片！
      </div>
    </div>
  );
}
