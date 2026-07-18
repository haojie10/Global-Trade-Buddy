import { GetServerSideProps } from 'next';
import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import pool from '../lib/db';
import { parseCookies } from '../lib/cookies';
import { getUserGraph, GraphNode, GraphLink } from './api/user/graph';
import Link from 'next/link';
import dynamic from 'next/dynamic';
const AdminPanel = dynamic(() => import('../components/AdminPanel'), { ssr: false });
import ReportList, { PlatformReport } from '../components/ReportList';
import AuthModal from '../components/AuthModal';
import Navbar from '../components/Navbar';
import MGLogo from '../components/MGLogo';

interface HomeProps {
  graphData: {
    nodes: GraphNode[];
    links: GraphLink[];
  };
  allReports: PlatformReport[];
  userId: string;
  userRole: string;
  freeQuota: number;
  nickname?: string;
  latestArticles: any[];
}

export default function HomePage({ graphData, allReports, userId, userRole, freeQuota, nickname, latestArticles = [] }: HomeProps) {
  const [quota, setQuota] = useState(freeQuota);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [showUploadModal, setShowUploadModal] = useState(false);

  const router = useRouter();

  // 视频与文案 DOM Refs
  const introRef = useRef<HTMLVideoElement>(null);
  const mainRef = useRef<HTMLVideoElement>(null);
  const outroRef = useRef<HTMLVideoElement>(null);

  const sec1Ref = useRef<HTMLDivElement>(null);
  const sec2Ref = useRef<HTMLDivElement>(null);
  const sec3Ref = useRef<HTMLDivElement>(null);
  const sec4Ref = useRef<HTMLDivElement>(null);

  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [progressPercent, setProgressPercent] = useState(0);

  // 1. 生命周期：捕获 URL 中的邀请人 ID 并缓存到本地
  useEffect(() => {
    if (router.isReady && router.query.invite) {
      const inviteId = router.query.invite as string;
      if (inviteId && inviteId !== userId) {
        localStorage.setItem('gtb_referrer_id', inviteId);
      }
    }
  }, [router.isReady, router.query.invite, userId]);

  // 2. 生命周期：当用户成功登录且本地有邀请缓存时，自动绑定并兑换额度
  useEffect(() => {
    const referrerId = localStorage.getItem('gtb_referrer_id');
    if (userId && referrerId && referrerId !== userId) {
      fetch('/api/user/invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ referrerId }),
      })
        .then(res => res.json())
        .then(data => {
          if (data.success) {
            alert('🎁 恭喜！接受邀请注册成功，你与邀请人均已获赠 1 次报告解锁额度！');
            setQuota(prev => prev + 1);
          }
          localStorage.removeItem('gtb_referrer_id');
        })
        .catch(err => {
          console.error('[ERROR] 自动绑定邀请关系失败:', err);
          localStorage.removeItem('gtb_referrer_id');
        });
    }
  }, [userId]);

  // 3. 滚动与 rAF 帧循环逻辑
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
      // Lerp 滚动进度以实现缓动阻尼感
      currentRenderPercent += (targetPercent - currentRenderPercent) * 0.08;
      const scrollPercent = Math.max(0, Math.min(1, currentRenderPercent));
      setProgressPercent(scrollPercent);

      let introOpacity = 0;
      let mainOpacity = 0;
      let outroOpacity = 0;

      const mainDuration = mainVideo ? mainVideo.duration || 12 : 12;

      // 视频淡入淡出及 CPU 解码资源释放优化
      if (scrollPercent <= 0) {
        introOpacity = 1;
        if (introVideo && introVideo.paused) introVideo.play().catch(() => {});
        if (mainVideo && !mainVideo.paused) mainVideo.pause();
        if (outroVideo && !outroVideo.paused) outroVideo.pause();
      } else if (scrollPercent > 0 && scrollPercent < 0.98) {
        // 前 5% 粒子淡出，数据聚合淡入
        if (scrollPercent < 0.05) {
          const ratio = scrollPercent / 0.05;
          introOpacity = 1 - ratio;
          mainOpacity = ratio;
          
          if (introVideo && introVideo.paused) introVideo.play().catch(() => {});
          if (mainVideo && !mainVideo.paused) mainVideo.pause();
          if (outroVideo && !outroVideo.paused) outroVideo.pause();
        } 
        // 后 5% 数据淡出，自转大脑淡入
        else if (scrollPercent > 0.93) {
          const ratio = (scrollPercent - 0.93) / 0.05;
          mainOpacity = 1 - ratio;
          outroOpacity = ratio;
          
          if (introVideo && !introVideo.paused) introVideo.pause();
          if (mainVideo && !mainVideo.paused) mainVideo.pause();
          if (outroVideo && outroVideo.paused) outroVideo.play().catch(() => {});
        } 
        // 中间完全显示 main 视频，暂停其他视频释放资源
        else {
          mainOpacity = 1;
          if (introVideo && !introVideo.paused) introVideo.pause();
          if (outroVideo && !outroVideo.paused) outroVideo.pause();
        }

        // main 视频进度 seek 追随
        if (mainVideo && mainVideo.readyState >= 2) {
          const mainPercent = (scrollPercent - 0.05) / 0.88;
          const targetTime = Math.max(0, Math.min(mainDuration - 0.05, mainPercent * mainDuration));
          currentRenderTime += (targetTime - currentRenderTime) * 0.08;
          mainVideo.currentTime = currentRenderTime;
        }
      } else {
        // 彻底触底
        outroOpacity = 1;
        if (outroVideo && outroVideo.paused) outroVideo.play().catch(() => {});
        if (introVideo && !introVideo.paused) introVideo.pause();
        if (mainVideo && !mainVideo.paused) mainVideo.pause();
      }

      // 原生 DOM Opacity 修改，完全避开 React 重绘
      if (introVideo) introVideo.style.opacity = introOpacity.toString();
      if (mainVideo) mainVideo.style.opacity = mainOpacity.toString();
      if (outroVideo) outroVideo.style.opacity = outroOpacity.toString();

      // 文案浮现/渐隐及视差变换 (引入 activeStart -> activeEnd 的停留平原，加长停留时间)
      const updateSection = (
        sec: HTMLDivElement | null, 
        start: number, 
        activeStart: number, 
        activeEnd: number, 
        end: number, 
        isLast = false
      ) => {
        if (!sec) return;
        let opacity = 0;
        let translateY = 20;

        if (scrollPercent >= start && scrollPercent <= end) {
          if (scrollPercent < activeStart) {
            // 淡入段
            const ratio = (scrollPercent - start) / (activeStart - start);
            opacity = ratio;
            translateY = 20 * (1 - ratio);
          } else if (scrollPercent >= activeStart && scrollPercent <= activeEnd) {
            // 停留段 (保持 100% 可见)
            opacity = 1;
            translateY = 0;
          } else {
            // 淡出段
            if (isLast) {
              opacity = 1;
              translateY = 0;
            } else {
              const ratio = (scrollPercent - activeEnd) / (end - activeEnd);
              opacity = 1 - ratio;
              translateY = -20 * ratio;
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

      // 划分四幕文案的滚动百分比活跃区间 (设置平滑过渡和长停留区域)
      updateSection(sec1, 0.0, 0.0, 0.15, 0.23);
      updateSection(sec2, 0.23, 0.30, 0.52, 0.60);
      updateSection(sec3, 0.60, 0.67, 0.82, 0.88);
      updateSection(sec4, 0.88, 0.94, 1.0, 1.0, true);

      animationFrameId = requestAnimationFrame(renderLoop);
    };

    const handleScroll = () => {
      const scrollHeight = document.documentElement.scrollHeight;
      const clientHeight = window.innerHeight;
      const maxScroll = scrollHeight - clientHeight;
      if (maxScroll <= 0) return;
      targetPercent = window.scrollY / maxScroll;
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

  return (
    <div style={{
      background: '#090808',
      color: '#ffffff',
      '--color-text': '#ffffff', // 强制子代组件继承暗色模式文字
      '--color-muted': 'rgba(255, 255, 255, 0.6)',
      minHeight: '450vh', // 给足滚动行程
      fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, sans-serif',
      position: 'relative'
    } as React.CSSProperties}>
      <Head>
        <title>Market Graphic - 俯瞰全球市场结构</title>
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

      {/* 2. 动态导航栏 */}
      <Navbar
        userId={userId}
        userRole={userRole}
        quota={quota}
        nickname={nickname}
        onShowAuthModal={() => setShowAuthModal(true)}
        onShowUploadModal={() => setShowUploadModal(true)}
        dark={true} // 启用暗色配置磨砂
      />

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
                在 MARKET GRAPHIC，资讯、公司和品类绝非孤立存在。每一条你关注的产品动态、每一篇留下的笔记，都会自动交织、结网生长，绘制出完全契合您业务习惯的个性化商业版图。
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
              
              {/* 融合动态分享与注册逻辑的裂变面板 */}
              <div style={{ width: '100%', maxWidth: '520px', margin: '0 auto' }}>
                {userId ? (
                  <div style={{ display: 'flex', gap: '10px' }}>
                    <input
                      type="text"
                      readOnly
                      value={`${typeof window !== 'undefined' ? window.location.origin : ''}/?invite=${userId}`}
                      style={{
                        flex: 1,
                        background: 'rgba(255, 255, 255, 0.1)',
                        border: '1px solid rgba(255, 255, 255, 0.2)',
                        borderRadius: '30px',
                        padding: '12px 24px',
                        fontSize: '0.85rem',
                        color: '#ffffff',
                        outline: 'none'
                      }}
                    />
                    <button
                      onClick={() => {
                        const link = `${window.location.origin}/?invite=${userId}`;
                        navigator.clipboard.writeText(link)
                          .then(() => alert('🎉 专属邀请链接已复制到剪贴板！快发给同行好友吧。'))
                          .catch(() => alert('复制失败，请手动选择输入框内容进行复制。'));
                      }}
                      style={{
                        background: '#ff641e',
                        border: 'none',
                        borderRadius: '30px',
                        color: '#ffffff',
                        padding: '12px 28px',
                        fontSize: '0.85rem',
                        fontWeight: 500,
                        cursor: 'pointer',
                        boxShadow: '0 4px 12px rgba(255, 100, 30, 0.2)',
                        transition: 'all 0.2s'
                      }}
                      onMouseOver={(e) => e.currentTarget.style.transform = 'translateY(-1px)'}
                      onMouseOut={(e) => e.currentTarget.style.transform = 'translateY(0)'}
                    >
                      复制链接
                    </button>
                  </div>
                ) : (
                  <div style={{ display: 'flex', gap: '16px', justifyContent: 'center' }}>
                    <button
                      onClick={() => setShowAuthModal(true)}
                      style={{
                        background: '#ff641e',
                        color: '#ffffff',
                        padding: '16px 36px',
                        borderRadius: '30px',
                        border: 'none',
                        fontSize: '0.95rem',
                        textDecoration: 'none',
                        fontWeight: 500,
                        cursor: 'pointer',
                        boxShadow: '0 10px 30px rgba(255, 100, 30, 0.3)',
                        transition: 'all 0.2s'
                      }}
                      onMouseOver={(e) => e.currentTarget.style.transform = 'translateY(-2px)'}
                      onMouseOut={(e) => e.currentTarget.style.transform = 'translateY(0)'}
                    >
                      免费注册体验 ➔
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>

        </div>
      </div>

      {/* 4. 底部状态栏 */}
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
      </div>

      {/* 5. 登录/注册弹窗 & 上传管理后台 */}
      <AuthModal 
        isOpen={showAuthModal} 
        onClose={() => setShowAuthModal(false)} 
      />

      <AdminPanel 
        isOpen={showUploadModal} 
        onClose={() => setShowUploadModal(false)} 
        onUploadSuccess={() => window.location.reload()} 
      />
    </div>
  );
}

// SSR 加载主页基础数据与会话验证
export const getServerSideProps: GetServerSideProps = async (context) => {
  const cookies = parseCookies(context.req.headers.cookie);
  const cookieUserId = cookies.user_id;
  
  let dbClient: any = null;

  try {
    dbClient = await pool.connect();
    let userId: string | null = null;
    let userRole = 'guest';
    let freeQuota = 0;
    let nickname = '';

    if (cookieUserId) {
      const userRes = await dbClient.query('SELECT id, role, free_quota, nickname FROM users WHERE id = $1', [cookieUserId]);
      if (userRes.rows.length > 0) {
        userId = userRes.rows[0].id;
        userRole = userRes.rows[0].role;
        freeQuota = userRes.rows[0].free_quota;
        nickname = userRes.rows[0].nickname || '';
      }
    }

    let graphData: any = { nodes: [], links: [] };
    let allReports: any[] = [];

    if (userId) {
      if (userRole === 'admin') {
        const reportsRes = await dbClient.query(`
          SELECT r.id, r.title, r.category, r.market_region, r.summary,
                 EXISTS(SELECT 1 FROM favorites f WHERE f.user_id = $1 AND f.report_id = r.id) as is_favorited
          FROM reports r
          ORDER BY r.created_at DESC
        `, [userId]);
        
        allReports = reportsRes.rows.map((row: any) => ({
          id: row.id,
          title: row.title,
          category: row.category,
          market_region: row.market_region,
          summary: row.summary,
          isUnlocked: true,
          isFavorited: row.is_favorited
        }));
      } else {
        const reportsRes = await dbClient.query(`
          SELECT r.id, r.title, r.category, r.market_region, r.summary,
                 EXISTS(SELECT 1 FROM unlocks u WHERE u.user_id = $1 AND u.report_id = r.id) as is_unlocked,
                 EXISTS(SELECT 1 FROM favorites f WHERE f.user_id = $1 AND f.report_id = r.id) as is_favorited
          FROM reports r
          ORDER BY r.created_at DESC
          LIMIT 30
        `, [userId]);
        
        allReports = reportsRes.rows.map((row: any) => ({
          id: row.id,
          title: row.title,
          category: row.category,
          market_region: row.market_region,
          summary: row.summary,
          isUnlocked: row.is_unlocked,
          isFavorited: row.is_favorited
        }));
      }
    } else {
      const reportsRes = await dbClient.query(`
        SELECT id, title, category, market_region, summary FROM reports ORDER BY created_at DESC LIMIT 30
      `);
      allReports = reportsRes.rows.map((row: any) => ({
        id: row.id,
        title: row.title,
        category: row.category,
        market_region: row.market_region,
        summary: row.summary,
        isUnlocked: false,
        isFavorited: false
      }));
    }

    // 获取最新 6 条资讯数据
    const latestArticlesRes = await dbClient.query(
      `SELECT n.id, n.title, n.summary, n.published_at,
              (SELECT name FROM industries JOIN news_industries ON industries.id = news_industries.industry_id WHERE news_id = n.id LIMIT 1) as industry,
              (SELECT region FROM countries JOIN news_countries ON countries.id = news_countries.country_id WHERE news_id = n.id LIMIT 1) as region,
              (SELECT name FROM countries JOIN news_countries ON countries.id = news_countries.country_id WHERE news_id = n.id LIMIT 1) as country
       FROM news n
       WHERE n.status = 'published'
       ORDER BY n.published_at DESC LIMIT 6`
    );
    const latestArticles = latestArticlesRes.rows.map((row: any) => ({
      ...row,
      published_at: row.published_at ? row.published_at.toISOString() : null
    }));

    context.res.setHeader('Cache-Control', 'no-store, must-revalidate');

    return {
      props: {
        graphData,
        allReports,
        userId: userId || '',
        userRole,
        freeQuota,
        nickname,
        latestArticles
      }
    };
  } catch (err) {
    console.error('SSR 加载主页失败，原因:', err);
    return {
      props: {
        graphData: { nodes: [], links: [] },
        allReports: [],
        userId: '',
        userRole: 'guest',
        freeQuota: 0,
        nickname: '',
        latestArticles: []
      }
    };
  } finally {
    if (dbClient) {
      dbClient.release();
    }
  }
};
