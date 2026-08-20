import { GetServerSideProps } from 'next';
import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import pool from '../lib/db';
import { resolveSsrAuth } from '../lib/ssr-auth';
import dynamic from 'next/dynamic';
import { PlatformReport } from '../components/ReportList';
import AuthModal from '../components/AuthModal';
import Navbar from '../components/Navbar';
import { EcosystemRadar, FeatureCards, KnowledgeNetwork, ActionPanel } from '../components/HomeVisuals';

const AdminPanel = dynamic(() => import('../components/AdminPanel'), { ssr: false });

interface HomeProps {
  allReports: PlatformReport[];
  userId: string;
  userRole: string;
  freeQuota: number;
  nickname?: string;
  latestArticles: any[];
}

export default function HomePage({ allReports, userId, userRole, freeQuota, nickname, latestArticles = [] }: HomeProps) {
  const [quota, setQuota] = useState(freeQuota);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [copied, setCopied] = useState(false);

  const router = useRouter();

  // 4 幕 DOM 容器引用
  const sec1Ref = useRef<HTMLDivElement>(null);
  const sec2Ref = useRef<HTMLDivElement>(null);
  const sec3Ref = useRef<HTMLDivElement>(null);
  const sec4Ref = useRef<HTMLDivElement>(null);

  // 第 2 幕内部活跃卡片索引 (0, 1, 2)
  const [featureActiveIndex, setFeatureActiveIndex] = useState(0);
  const [currentStep, setCurrentStep] = useState(1);

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
            alert('恭喜！接受邀请注册成功，你与邀请人均已获赠 3 次报告解锁额度！');
            setQuota(prev => prev + 3);
          }
          localStorage.removeItem('gtb_referrer_id');
        })
        .catch(err => {
          console.error('[ERROR] 自动绑定邀请关系失败:', err);
          localStorage.removeItem('gtb_referrer_id');
        });
    }
  }, [userId]);

  // 3. 滚动与 rAF 帧循环逻辑 (纯原生 DOM 驱动，极致流畅)
  useEffect(() => {
    const sec1 = sec1Ref.current;
    const sec2 = sec2Ref.current;
    const sec3 = sec3Ref.current;
    const sec4 = sec4Ref.current;

    let targetPercent = 0;
    let currentRenderPercent = 0;
    let animationFrameId: number;

    const renderLoop = () => {
      // Lerp 平滑阻尼插值
      currentRenderPercent += (targetPercent - currentRenderPercent) * 0.2;
      const scrollPercent = Math.max(0, Math.min(1, currentRenderPercent));

      // 计算当前所处的全局 Step (1 ~ 4)
      if (scrollPercent < 0.22) {
        setCurrentStep(1);
      } else if (scrollPercent < 0.58) {
        setCurrentStep(2);
        // 计算第 2 幕内部 3 个子项的切换进度
        const sec2Progress = (scrollPercent - 0.22) / 0.36;
        if (sec2Progress < 0.35) {
          setFeatureActiveIndex(0);
        } else if (sec2Progress < 0.7) {
          setFeatureActiveIndex(1);
        } else {
          setFeatureActiveIndex(2);
        }
      } else if (scrollPercent < 0.82) {
        setCurrentStep(3);
      } else {
        setCurrentStep(4);
      }

      // 文案与视图的淡入淡出及位移
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
        let translateY = 24;

        if (scrollPercent >= start && scrollPercent <= end) {
          if (scrollPercent < activeStart) {
            // 淡入段
            const ratio = (scrollPercent - start) / Math.max(0.01, activeStart - start);
            opacity = ratio;
            translateY = 24 * (1 - ratio);
          } else if (scrollPercent >= activeStart && scrollPercent <= activeEnd) {
            // 停留段 (100% 可见)
            opacity = 1;
            translateY = 0;
          } else {
            // 淡出段
            if (isLast) {
              opacity = 1;
              translateY = 0;
            } else {
              const ratio = (scrollPercent - activeEnd) / Math.max(0.01, end - activeEnd);
              opacity = 1 - ratio;
              translateY = -24 * ratio;
            }
          }
        } else if (scrollPercent > end && !isLast) {
          opacity = 0;
          translateY = -24;
        }

        sec.style.opacity = opacity.toString();
        sec.style.transform = `translateY(${translateY}px)`;
        sec.style.display = opacity <= 0.001 ? 'none' : 'flex';
        sec.style.pointerEvents = opacity > 0.3 ? 'auto' : 'none';
      };

      // 划分四幕文案的滚动活跃区间
      updateSection(sec1, 0.0, 0.0, 0.16, 0.22);
      updateSection(sec2, 0.22, 0.26, 0.54, 0.58);
      updateSection(sec3, 0.58, 0.62, 0.78, 0.82);
      updateSection(sec4, 0.82, 0.86, 1.0, 1.0, true);

      animationFrameId = requestAnimationFrame(renderLoop);
    };

    const handleScroll = () => {
      const scrollY = window.scrollY || window.pageYOffset || document.documentElement.scrollTop || 0;
      const maxScroll = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
      targetPercent = Math.min(1, Math.max(0, scrollY / maxScroll));
    };

    handleScroll();
    window.addEventListener('scroll', handleScroll, { passive: true });
    animationFrameId = requestAnimationFrame(renderLoop);

    return () => {
      window.removeEventListener('scroll', handleScroll);
      cancelAnimationFrame(animationFrameId);
    };
  }, []);

  // 快速滚动至指定幕
  const scrollToStep = (stepNumber: number) => {
    const maxScroll = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
    const targetMap: { [key: number]: number } = {
      1: 0,
      2: maxScroll * 0.32,
      3: maxScroll * 0.68,
      4: maxScroll
    };
    window.scrollTo({
      top: targetMap[stepNumber] || 0,
      behavior: 'smooth'
    });
  };

  const handleCopyInvite = () => {
    if (typeof window === 'undefined') return;
    const link = `${window.location.origin}/?invite=${userId}`;
    navigator.clipboard.writeText(link)
      .then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      })
      .catch(() => alert('复制失败，请手动选择输入框内容进行复制。'));
  };

  // 第二幕 3 项能力列表文案
  const featureList = [
    {
      title: '每周的行业资讯',
      desc: '紧盯产品创新、高管变更、渠道扩张/缩小、投资扩大/收缩，以及终端用户最真实的痛点反馈。让每一次阅读都直接转化为业务预警。'
    },
    {
      title: '客户360°洞察',
      desc: '深入了解客户背景，发展历史，所属行业，发展潜力，一键穿透其财务状况、组织架构和核心采购逻辑，并为你提供专业的合作建议。'
    },
    {
      title: '品类360°洞察',
      desc: '深度解析产品在市场上的表现，分析现有的产品结构，价格带，识别用户痛点，洞悉市场空白点，并为你提供直观的产品开发及推广建议。'
    }
  ];

  return (
    <div style={{
      background: 'transparent',
      color: 'var(--color-text)',
      minHeight: '400vh',
      position: 'relative'
    }}>
      <Head>
        <title>Market Graphic (外贸智友) - 俯瞰全球市场结构 · AI 深度出海调研平台</title>
        <meta name="description" content="Market Graphic（外贸智友）是 AI 驱动的深度外贸商业情报与品类调研平台，提供海外买家 360° 供应链穿透洞察、重点品类准入标准分析及每日全球外贸动态，助力中国制造企业精准出海决策。" />
        <meta name="keywords" content="Market Graphic, 外贸智友, 外贸调研, 出海情报, 海外买家分析, 品类洞察, 供应链穿透, 跨境电商, AI 商业智能, GlobalTradeBuddy" />
        <meta name="author" content="外贸智友 Market Graphic" />
        <meta name="robots" content="index, follow" />
        <meta name="baidu-site-verification" content="codeva-f5tW4LkOnX" />
        <meta name="google-site-verification" content="Zc_oto1WeXeyLsH7pP1F0HelY1dWT0EUPMIEHZcbtEY" />
        <link rel="canonical" href="https://marketgraphic.cn" />
        {/* Open Graph */}
        <meta property="og:type" content="website" />
        <meta property="og:title" content="Market Graphic (外贸智友) - 俯瞰全球市场结构 · AI 深度出海调研平台" />
        <meta property="og:description" content="AI 驱动的深度外贸调研平台，海外买家 360° 供应链穿透洞察、重点品类准入分析与实时行业动态。" />
        <meta property="og:image" content="https://marketgraphic.cn/images/discover_focus_panorama.jpg" />
        <meta property="og:url" content="https://marketgraphic.cn" />
        <meta property="og:site_name" content="Market Graphic (外贸智友)" />
        {/* Twitter Card */}
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content="Market Graphic (外贸智友) - 俯瞰全球市场结构" />
        <meta name="twitter:description" content="AI 驱动的深度外贸调研平台，海外买家 360° 供应链穿透洞察与品类准入分析。" />
        <meta name="twitter:image" content="https://marketgraphic.cn/images/discover_focus_panorama.jpg" />

        {/* 结构化数据 (JSON-LD) */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              '@context': 'https://schema.org',
              '@graph': [
                {
                  '@type': 'WebSite',
                  '@id': 'https://marketgraphic.cn/#website',
                  'url': 'https://marketgraphic.cn',
                  'name': 'Market Graphic',
                  'alternateName': ['外贸智友', 'GlobalTradeBuddy', 'MarketGraphic'],
                  'description': 'AI 驱动的全球出海商业情报与品类调研平台',
                  'publisher': {
                    '@id': 'https://marketgraphic.cn/#organization'
                  },
                  'potentialAction': {
                    '@type': 'SearchAction',
                    'target': 'https://marketgraphic.cn/reports?q={search_term_string}',
                    'query-input': 'required name=search_term_string'
                  }
                },
                {
                  '@type': 'Organization',
                  '@id': 'https://marketgraphic.cn/#organization',
                  'name': 'Market Graphic (外贸智友)',
                  'alternateName': ['外贸智友', 'GlobalTradeBuddy'],
                  'url': 'https://marketgraphic.cn',
                  'logo': {
                    '@type': 'ImageObject',
                    'url': 'https://marketgraphic.cn/images/mg_logo.png'
                  }
                }
              ]
            })
          }}
        />
      </Head>

      {/* 注入全局响应式与移动端专属样式 */}
      <style jsx global>{`
        .home-screen-wrapper {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 48px;
          width: 100%;
          height: 100%;
        }
        .home-screen-left {
          flex: 1 1 500px;
          max-width: 620px;
        }
        .home-screen-right {
          flex: 1 1 450px;
          display: flex;
          justify-content: center;
          align-items: center;
        }

        /* 移动端与平板端响应式适配 (< 900px) */
        @media (max-width: 900px) {
          .home-viewport-padding {
            padding: 70px 16px 20px 16px !important;
          }
          .home-screen-wrapper {
            flex-direction: column !important;
            justify-content: center !important;
            gap: 18px !important;
            text-align: center !important;
          }
          .home-screen-left {
            flex: 0 1 auto !important;
            max-width: 100% !important;
          }
          .home-screen-left h1,
          .home-screen-left h2 {
            font-size: 1.35rem !important;
            margin-bottom: 8px !important;
            line-height: 1.3 !important;
          }
          .home-screen-left p {
            font-size: 0.84rem !important;
            line-height: 1.5 !important;
            margin-bottom: 8px !important;
          }
          .home-screen-right {
            flex: 0 1 auto !important;
            max-width: 280px !important;
            max-height: 280px !important;
            transform: scale(0.78);
            transform-origin: center center;
          }
          .home-step-indicator {
            right: 8px !important;
            transform: translateY(-50%) scale(0.85) !important;
          }
          .home-sec2-list {
            display: none !important; /* 移动端在第二幕隐藏复杂列表，保留主标题与示意图联动 */
          }
        }
      `}</style>

      {/* 1. 全局柔和环境流光 (同报告大厅一致) */}
      <div className="ambient-glow-container">
        <div className="ambient-light ambient-light-1" />
      </div>

      {/* 2. 顶部导航栏 */}
      <Navbar
        userId={userId}
        userRole={userRole}
        quota={quota}
        nickname={nickname}
        onShowAuthModal={() => setShowAuthModal(true)}
        onShowUploadModal={() => setShowUploadModal(true)}
      />

      {/* 3. 页面右侧悬浮步骤指示器 */}
      <div className="home-step-indicator" style={{
        position: 'fixed',
        right: '24px',
        top: '50%',
        transform: 'translateY(-50%)',
        zIndex: 40,
        display: 'flex',
        flexDirection: 'column',
        gap: '12px'
      }}>
        {[1, 2, 3, 4].map((step) => {
          const isActive = currentStep === step;
          return (
            <button
              key={step}
              onClick={() => scrollToStep(step)}
              title={`跳转至第 ${step} 幕`}
              style={{
                width: isActive ? '10px' : '6px',
                height: isActive ? '28px' : '6px',
                borderRadius: '10px',
                background: isActive ? '#ff641e' : 'rgba(18, 18, 18, 0.2)',
                border: 'none',
                cursor: 'pointer',
                transition: 'all 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
                padding: 0
              }}
            />
          );
        })}
      </div>

      {/* 4. 固定视口沉浸式 4 幕叙事层 */}
      <div className="home-viewport-padding" style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100vw',
        height: '100vh',
        zIndex: 10,
        pointerEvents: 'none',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '80px 24px 40px 24px',
        boxSizing: 'border-box'
      }}>
        <div style={{
          width: '100%',
          maxWidth: '1280px',
          height: '100%',
          position: 'relative',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center'
        }}>

          {/* 第 1 幕：痛点与 360° 全景视野 */}
          <div ref={sec1Ref} className="home-screen-wrapper" style={{
            position: 'absolute',
            inset: 0,
            opacity: 1,
            transform: 'translateY(0px)'
          }}>
            {/* 左侧文案 */}
            <div className="home-screen-left">
              <span style={{
                color: '#ff641e',
                fontSize: '0.85rem',
                letterSpacing: '3px',
                textTransform: 'uppercase',
                fontWeight: 600,
                display: 'block',
                marginBottom: '10px'
              }}>
                The 360° Panorama
              </span>
              <h1 style={{
                fontSize: 'clamp(1.5rem, 4vw, 2.8rem)',
                fontWeight: 600,
                lineHeight: 1.28,
                margin: '0 0 16px 0',
                color: 'var(--color-text)'
              }}>
                想快人一步了解你的客户吗？
              </h1>
              <p style={{
                fontSize: '0.98rem',
                color: '#555555',
                lineHeight: 1.7,
                margin: '0 0 16px 0',
                fontWeight: 400
              }}>
                传统的调研被割裂在孤立的新闻、摸不透的客户底细和散落的头条中。割裂的信息只是噪音，决策慢一步，商机便差之千里。
              </p>
              <p style={{
                fontSize: '0.98rem',
                color: '#222222',
                lineHeight: 1.7,
                margin: 0,
                fontWeight: 500
              }}>
                <span style={{ color: '#ff641e', fontWeight: 600 }}>Market Graphic</span> 为你提供 360° 的视角，穿透客户在市场中的位置，上游是谁，下游是谁，竞争者是谁，环环相扣，逐步揭示市场网络，让你站在更高的视野俯瞰你所深耕的行业。
              </p>

              <div style={{
                marginTop: '24px',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                fontSize: '0.82rem',
                color: '#ff641e',
                fontWeight: 500,
                background: 'rgba(255, 100, 30, 0.08)',
                padding: '5px 14px',
                borderRadius: '20px'
              }}>
                向下滚动，探索平台能力
              </div>
            </div>

            {/* 右侧纯视觉示意图 */}
            <div className="home-screen-right">
              <EcosystemRadar />
            </div>
          </div>

          {/* 第 2 幕：三大核心能力 (固定标题 + 随滚动向上滑动的示意看板) */}
          <div ref={sec2Ref} className="home-screen-wrapper" style={{
            position: 'absolute',
            inset: 0,
            display: 'none',
            opacity: 0,
            transform: 'translateY(24px)'
          }}>
            {/* 左侧固定标题与步骤引导 */}
            <div className="home-screen-left" style={{ maxWidth: '520px' }}>
              <span style={{
                color: '#ff641e',
                fontSize: '0.85rem',
                letterSpacing: '3px',
                textTransform: 'uppercase',
                fontWeight: 600,
                display: 'block',
                marginBottom: '10px'
              }}>
                Core Capabilities
              </span>
              <h2 style={{
                fontSize: 'clamp(1.6rem, 4.5vw, 2.8rem)',
                fontWeight: 600,
                lineHeight: 1.25,
                margin: '0 0 20px 0',
                color: 'var(--color-text)'
              }}>
                Market Graphic 为你带来：
              </h2>

              {/* 3 个能力的阶段说明列表 (根据滚动位置高亮) */}
              <div className="home-sec2-list" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {featureList.map((item, idx) => {
                  const isCurrent = featureActiveIndex === idx;
                  return (
                    <div
                      key={idx}
                      style={{
                        padding: '12px 16px',
                        borderRadius: '14px',
                        background: isCurrent ? '#ffffff' : 'transparent',
                        border: isCurrent ? '1px solid rgba(255, 100, 30, 0.3)' : '1px solid transparent',
                        boxShadow: isCurrent ? '0 8px 24px rgba(255, 100, 30, 0.08)' : 'none',
                        transition: 'all 0.3s ease'
                      }}
                    >
                      <div style={{
                        fontSize: '1rem',
                        fontWeight: 600,
                        color: isCurrent ? '#ff641e' : '#666'
                      }}>
                        {idx + 1}. {item.title}
                      </div>
                      <div style={{
                        fontSize: '0.84rem',
                        color: isCurrent ? '#444' : '#888',
                        lineHeight: 1.55,
                        marginTop: '4px'
                      }}>
                        {item.desc}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* 右侧纯图表示意看板 (随滚动向上滑动) */}
            <div className="home-screen-right">
              <FeatureCards activeIndex={featureActiveIndex} />
            </div>
          </div>

          {/* 第 3 幕：打造私人专属知识库 (Obsidian 知识图谱动态示意) */}
          <div ref={sec3Ref} className="home-screen-wrapper" style={{
            position: 'absolute',
            inset: 0,
            display: 'none',
            opacity: 0,
            transform: 'translateY(24px)'
          }}>
            {/* 左侧文案 */}
            <div className="home-screen-left" style={{ maxWidth: '600px' }}>
              <span style={{
                color: '#ff641e',
                fontSize: '0.85rem',
                letterSpacing: '3px',
                textTransform: 'uppercase',
                fontWeight: 600,
                display: 'block',
                marginBottom: '10px'
              }}>
                Personal Knowledge Graph
              </span>
              <h2 style={{
                fontSize: 'clamp(1.6rem, 4.5vw, 2.8rem)',
                fontWeight: 600,
                lineHeight: 1.25,
                margin: '0 0 18px 0',
                color: 'var(--color-text)'
              }}>
                打造你自己的<br />
                <span style={{ color: '#ff641e' }}>私人专属知识库</span>
              </h2>
              <p style={{
                fontSize: '0.98rem',
                color: '#555555',
                lineHeight: 1.7,
                margin: '0 0 16px 0',
                fontWeight: 400
              }}>
                在 <strong style={{ color: '#121212' }}>MARKET GRAPHIC</strong>，客户360°洞察和品类360°洞察绝非孤立存在。
              </p>
              <p style={{
                fontSize: '0.98rem',
                color: '#222222',
                lineHeight: 1.7,
                margin: 0,
                fontWeight: 500
              }}>
                每一条你关注的产品动态、每一篇留下的笔记，都会自动交织、结网生长，绘制出完全契合您业务习惯的个性化商业版图。
              </p>
            </div>

            {/* 右侧 Obsidian 动态知识图谱示意 */}
            <div className="home-screen-right">
              <KnowledgeNetwork />
            </div>
          </div>

          {/* 第 4 幕：开启知识之旅与裂变行动 */}
          <div ref={sec4Ref} style={{
            position: 'absolute',
            inset: 0,
            display: 'none',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '0 16px',
            opacity: 0,
            transform: 'translateY(24px)'
          }}>
            <ActionPanel
              userId={userId}
              copied={copied}
              onCopy={handleCopyInvite}
              onShowAuthModal={() => setShowAuthModal(true)}
            />
          </div>

        </div>
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
  let dbClient: any = null;

  try {
    dbClient = await pool.connect();
    const auth = await resolveSsrAuth(context, dbClient);
    const userId = auth.userId;
    const userRole = auth.userRole;
    const freeQuota = auth.freeQuota;
    const nickname = auth.nickname;

    let allReports: PlatformReport[] = [];

    // 并发拉取报告列表与最新资讯
    const reportsPromise = (async () => {
      if (userId) {
        if (userRole === 'admin') {
          const reportsRes = await dbClient.query(`
            SELECT r.id, r.title, r.category, r.market_region, r.summary,
                   EXISTS(SELECT 1 FROM favorites f WHERE f.user_id = $1 AND f.report_id = r.id) as is_favorited
            FROM reports r
            ORDER BY r.created_at DESC
          `, [userId]);

          return reportsRes.rows.map((row: any) => ({
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

          return reportsRes.rows.map((row: any) => ({
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
        return reportsRes.rows.map((row: any) => ({
          id: row.id,
          title: row.title,
          category: row.category,
          market_region: row.market_region,
          summary: row.summary,
          isUnlocked: false,
          isFavorited: false
        }));
      }
    })();

    const latestArticlesPromise = dbClient.query(`
      SELECT n.id, n.title, n.summary, n.published_at,
             i.name as industry,
             c.region as region,
             c.name as country
      FROM news n
      LEFT JOIN news_industries ni ON n.id = ni.news_id
      LEFT JOIN industries i ON ni.industry_id = i.id
      LEFT JOIN news_countries nc ON n.id = nc.news_id
      LEFT JOIN countries c ON nc.country_id = c.id
      WHERE n.status = 'published'
      ORDER BY n.published_at DESC LIMIT 6
    `);

    const [allReportsData, latestArticlesRes] = await Promise.all([
      reportsPromise,
      latestArticlesPromise
    ]);

    const latestArticles = latestArticlesRes.rows.map((row: any) => ({
      ...row,
      published_at: row.published_at ? row.published_at.toISOString() : null
    }));

    context.res.setHeader('Cache-Control', 'no-cache, no-store, max-age=0, must-revalidate');
    context.res.setHeader('Vary', 'Cookie');

    return {
      props: {
        allReports: allReportsData,
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
