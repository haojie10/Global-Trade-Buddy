import { GetServerSideProps } from 'next';
import Head from 'next/head';
import React, { useState } from 'react';
import pool from '../../lib/db';
import { resolveSsrAuth } from '../../lib/ssr-auth';
import { getReportDetail } from '../api/user/report-detail';
import { localizeReportHtml } from '../../lib/localize-report-assets';
import WatermarkContainer from '../../components/WatermarkContainer';
import Link from 'next/link';
import Navbar from '../../components/Navbar';
import AuthModal from '../../components/AuthModal';

interface RelatedReport {
  id: string;
  title: string;
  category: string;
  market_region: string;
}

interface ReportDetailProps {
  report: {
    id: string;
    title: string;
    category: string;
    market_region: string;
    summary: string;
    isUnlocked: boolean;
    content_html: string | null;
  };
  previewData?: {
    toc: string[];
    excerpt: string;
  };
  related: RelatedReport[];
  canonicalUrl?: string;
  siteUrl?: string;
  userId: string;
  userRole: string;
  freeQuota: number;
  initialIsFavorite: boolean;
  initialNoteContent: string;
  nickname?: string;
}

export default function ReportDetailPage({
  report, 
  previewData = { toc: [], excerpt: '' },
  related, 
  canonicalUrl,
  siteUrl,
  userId, 
  userRole, 
  freeQuota,
  initialIsFavorite,
  initialNoteContent,
  nickname
}: ReportDetailProps) {
  const [unlocked, setUnlocked] = useState(report.isUnlocked);
  const [content, setContent] = useState(report.content_html);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [quota, setQuota] = useState(freeQuota);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [previewImgUrl, setPreviewImgUrl] = useState<string | null>(null);

  // 监听 iframe 传来的图片点击预览消息
  React.useEffect(() => {
    const handleMessage = (e: MessageEvent) => {
      if (e.data && e.data.type === 'GTB_PREVIEW_IMAGE' && e.data.src) {
        setPreviewImgUrl(e.data.src);
      }
    };
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  // 收藏与笔记状态
  const [isFav, setIsFav] = useState(initialIsFavorite);
  const [noteText, setNoteText] = useState(initialNoteContent);
  const [isSavingNote, setIsSavingNote] = useState(false);

  // NOTE: 当通过延伸知识链条切换报告时，Next.js 会复用此组件（Props 改变但组件不重新挂载）
  // 必须同步重置 unlocked、content 状态，且退出全屏模式
  React.useEffect(() => {
    setUnlocked(report.isUnlocked);
    setContent(report.content_html);
    setIsFullscreen(false);
    setQuota(freeQuota);
    setIsFav(initialIsFavorite);
    setNoteText(initialNoteContent);
  }, [report.id, report.isUnlocked, report.content_html, freeQuota, initialIsFavorite, initialNoteContent]);

  // 页面浏览量与停留时间追踪
  React.useEffect(() => {
    let viewId: string | null = null;
    let startTime = Date.now();

    // 1. 发送初始化浏览记录
    fetch('/api/track/pageview', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content_type: 'report', content_id: report.id })
    })
      .then(res => res.json())
      .then(data => {
        if (data.view_id) {
          viewId = data.view_id;
        }
      })
      .catch(err => console.error('Error tracking pageview:', err));

    // 2. 页面销毁或隐藏时发送停留时长
    const sendDuration = () => {
      if (!viewId) return;
      const durationSeconds = Math.round((Date.now() - startTime) / 1000);
      if (durationSeconds <= 0) return;

      const payload = JSON.stringify({ view_id: viewId, duration_seconds: durationSeconds });
      
      // 使用 fetch keepalive 代替 navigator.sendBeacon 以支持 Content-Type 并保证到达
      fetch('/api/track/pageview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: payload,
        keepalive: true
      }).catch(err => console.warn('Error sending duration:', err));
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        sendDuration();
      } else {
        // 重新进入页面，重置起始时间和 viewId，以记录新的会话
        startTime = Date.now();
        viewId = null;
        fetch('/api/track/pageview', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ content_type: 'report', content_id: report.id })
        })
          .then(res => res.json())
          .then(data => {
            if (data.view_id) {
              viewId = data.view_id;
            }
          })
          .catch(err => console.error('Error tracking pageview:', err));
      }
    };

    window.addEventListener('beforeunload', sendDuration);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      sendDuration();
      window.removeEventListener('beforeunload', sendDuration);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [report.id]);

  // 控制全屏时的页面滚动条锁定，防止外层和 iframe 同时滚动的糟糕体验
  React.useEffect(() => {
    if (isFullscreen) {
      document.body.style.overflow = 'hidden';
      document.body.classList.add('report-fullscreen-active');
    } else {
      document.body.style.overflow = 'unset';
      document.body.classList.remove('report-fullscreen-active');
    }
    return () => {
      document.body.style.overflow = 'unset';
      document.body.classList.remove('report-fullscreen-active');
    };
  }, [isFullscreen]);

  // 监听 Esc 键快速退出全屏阅读模式
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsFullscreen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  const handleToggleFavorite = async () => {
    if (!userId) {
      alert('请先返回主页登录后再进行收藏！');
      return;
    }
    try {
      const res = await fetch('/api/user/favorite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reportId: report.id })
      });
      const data = await res.json();
      if (res.ok && data.status) {
        setIsFav(data.status === 'added');
      } else {
        alert(data.error || '操作失败');
      }
    } catch (err) {
      alert('连接服务器失败');
    }
  };

  const handleSaveNote = async () => {
    if (!userId) {
      alert('请先返回主页登录再保存笔记！');
      return;
    }
    setIsSavingNote(true);
    try {
      const res = await fetch(`/api/user/note?reportId=${report.id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: noteText })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        alert('笔记保存成功！');
      } else {
        alert(data.error || '保存失败');
      }
    } catch (err) {
      alert('连接服务器失败');
    } finally {
      setIsSavingNote(false);
    }
  };

  // 模拟微信/支付宝扫码解锁功能
  const handleUnlock = async () => {
    if (!userId) {
      alert('请先返回主页登录系统，再解锁报告！');
      return;
    }
    try {
      const res = await fetch(`/api/user/unlock-action`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, reportId: report.id }),
      });
      const data = await res.json();
      if (data.success) {
        setUnlocked(true);
        setContent(data.content_html);
        setQuota(q => Math.max(0, q - 1));
        setIsFav(true); // 自动收藏
      } else {
        alert(data.error || '解锁失败，请充值额度');
      }
    } catch (err) {
      alert('连接支付网关失败');
    }
  };

  return (
    <WatermarkContainer text={userId ? `外贸智友 - 用户: ${nickname || userId.substring(0, 8)}` : '外贸智友 - 游客浏览模式'}>
      <div style={{
        background: 'transparent',
        color: 'var(--color-text)',
        minHeight: '100vh',
        position: 'relative'
      }}>
        <Head>
          {/* 基础 TDK (百度/搜狗/360/谷歌) */}
          <title>{`${report.title} | Market Graphic (外贸智友)`}</title>
          <meta name="description" content={report.summary || '全球出海深度商业与品类调研报告，助力中国外贸企业穿透海外供应链。'} />
          <meta name="keywords" content={`出海调研, 商业洞察, ${report.category === 'customer' ? '买家洞察' : '品类洞察'}, ${report.market_region}, 外贸报告, 外贸智友, Market Graphic, GlobalTradeBuddy`} />
          <meta name="author" content="外贸智友 Market Graphic" />
          <meta name="robots" content="index, follow" />
          <meta name="applicable-device" content="pc,mobile" />
          {canonicalUrl && <link rel="canonical" href={canonicalUrl} />}

          {/* 百度出图缩略图 */}
          <meta name="thumbnail" content={siteUrl ? `${siteUrl}/images/discover_focus_panorama.jpg` : '/images/discover_focus_panorama.jpg'} />

          {/* 微信 / QQ 网页分享协议 */}
          <meta itemProp="name" content={`${report.title} | Market Graphic (外贸智友)`} />
          <meta itemProp="description" content={report.summary || '全球出海深度商业与品类调研报告，助力中国外贸企业穿透海外供应链。'} />
          <meta itemProp="image" content={siteUrl ? `${siteUrl}/images/discover_focus_panorama.jpg` : '/images/discover_focus_panorama.jpg'} />

          {/* 微信/微博/知乎/抖音通用 OpenGraph */}
          <meta property="og:type" content="article" />
          <meta property="og:title" content={`${report.title} | Market Graphic (外贸智友)`} />
          <meta property="og:description" content={report.summary || '全球出海深度商业与品类调研报告，助力中国外贸企业穿透海外供应链。'} />
          <meta property="og:image" content={siteUrl ? `${siteUrl}/images/discover_focus_panorama.jpg` : '/images/discover_focus_panorama.jpg'} />
          {canonicalUrl && <meta property="og:url" content={canonicalUrl} />}
          <meta property="og:site_name" content="Market Graphic (外贸智友)" />

          <meta name="twitter:card" content="summary_large_image" />
          <meta name="twitter:title" content={`${report.title} | Market Graphic (外贸智友)`} />
          <meta name="twitter:description" content={report.summary || `${report.title} — 深度商业研报`} />
          <meta name="twitter:image" content={siteUrl ? `${siteUrl}/images/discover_focus_panorama.jpg` : '/images/discover_focus_panorama.jpg'} />

          <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'Article',
            headline: report.title,
            description: report.summary || `${report.title} — 深度商业研报`,
            image: [siteUrl ? `${siteUrl}/images/discover_focus_panorama.jpg` : 'https://marketgraphic.cn/images/discover_focus_panorama.jpg'],
            author: {
              '@type': 'Organization',
              name: '外贸智友 Market Graphic',
              url: 'https://marketgraphic.cn'
            },
            publisher: {
              '@type': 'Organization',
              name: 'Market Graphic (外贸智友)',
              url: 'https://marketgraphic.cn',
              logo: {
                '@type': 'ImageObject',
                url: 'https://marketgraphic.cn/images/mg_logo.png'
              }
            },
            mainEntityOfPage: {
              '@type': 'WebPage',
              '@id': canonicalUrl || ''
            }
          }) }} />
        </Head>

        {/* 微信首图兜底 */}
        <div style={{ display: 'none', position: 'absolute', width: 0, height: 0, overflow: 'hidden' }}>
          <img src={siteUrl ? `${siteUrl}/images/discover_focus_panorama.jpg` : '/images/discover_focus_panorama.jpg'} alt={report.title} width="300" height="300" />
        </div>
        {/* 全局背景流光光源 */}
        <div className="ambient-glow-container">
          <div className="ambient-light ambient-light-1" />
        </div>

        {/* 统一导航栏 */}
        {!isFullscreen && (
          <Navbar
            userId={userId}
            userRole={userRole}
            quota={quota}
            nickname={nickname}
            onShowAuthModal={() => setShowAuthModal(true)}
          />
        )}

        <div style={{ 
          maxWidth: unlocked ? '1400px' : '900px', 
          margin: '0 auto', 
          padding: '110px 20px 40px 20px', 
          position: 'relative', 
          zIndex: 5,
          transition: 'max-width 0.4s cubic-bezier(0.16, 1, 0.3, 1)'
        }}>

          {/* 标题 */}
          <h1 className="font-editorial" style={{ fontSize: '2.4rem', fontWeight: 400, color: 'var(--color-text)', marginBottom: '16px', lineHeight: 1.3, letterSpacing: '-0.015em' }}>
            {report.title}
          </h1>

          {/* 标签与收藏 */}
          <div style={{ display: 'flex', gap: '10px', marginBottom: '30px', flexWrap: 'wrap', alignItems: 'center' }}>
            <span style={{
              background: 'transparent',
              border: '1px solid rgba(18, 18, 18, 0.08)',
              color: 'var(--color-muted)',
              fontSize: '0.75rem',
              padding: '4px 12px',
              borderRadius: 'var(--border-radius)',
              fontWeight: 300
            }}>
              {report.category === 'customer' ? '客户洞察' : '品类分析'}
            </span>
            <span style={{
              background: 'transparent',
              color: 'var(--color-muted)',
              border: '1px solid rgba(18, 18, 18, 0.08)',
              fontSize: '0.75rem',
              padding: '4px 12px',
              borderRadius: 'var(--border-radius)',
              fontWeight: 300
            }}>
              Target: {report.market_region}
            </span>
            {userId && (
              <button
                onClick={handleToggleFavorite}
                style={{
                  background: 'transparent',
                  border: isFav ? '1px solid var(--color-accent)' : '1px solid rgba(18, 18, 18, 0.15)',
                  color: isFav ? 'var(--color-accent)' : 'var(--color-muted)',
                  fontSize: '0.75rem',
                  padding: '4px 12px',
                  borderRadius: 'var(--border-radius)',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  transition: 'all 0.2s',
                  marginLeft: 'auto' // 将收藏按钮推到最右侧
                }}
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill={isFav ? 'var(--color-accent)' : 'none'} stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                </svg>
                {isFav ? '已加入图谱 (已收藏)' : '加入图谱 (点击收藏)'}
              </button>
            )}
          </div>

          {/* 摘要区 */}
          <div style={{
            background: 'rgba(255, 255, 255, 0.45)',
            backdropFilter: 'blur(15px)',
            WebkitBackdropFilter: 'blur(15px)',
            border: '1px solid rgba(18, 18, 18, 0.05)',
            borderRadius: 'var(--border-radius)',
            padding: '24px 30px',
            marginBottom: '30px',
            boxShadow: '0 8px 32px rgba(0, 0, 0, 0.01)'
          }}>
            <h3 style={{ margin: '0 0 10px 0', fontSize: '1rem', color: 'var(--color-text)', fontWeight: 400, display: 'flex', alignItems: 'center', gap: '6px' }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" strokeLinejoin="round">
                <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
                <path d="M4 4.5A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1-2.5-2.5v-15z" />
              </svg>
              报告摘要
            </h3>
            <p style={{ margin: 0, fontSize: '0.9rem', color: 'var(--color-muted)', lineHeight: 1.6, fontWeight: 300 }}>{report.summary}</p>
          </div>

          {/* 内容展示区 */}
          <div style={{ position: 'relative', minHeight: '300px', marginBottom: '50px' }}>
            {unlocked ? (
              // 已解锁：高保真 iframe 呈现，已集成全屏沉浸阅读模式
              <div>
                {/* 沉浸式阅读操作顶栏：仅全屏时显示 */}
                {isFullscreen && (
                  <div style={{
                    position: 'fixed',
                    top: 0,
                    left: 0,
                    right: 0,
                    height: '52px',
                    background: 'rgba(253, 251, 247, 0.95)',
                    backdropFilter: 'blur(20px)',
                    borderBottom: '1px solid rgba(15, 23, 42, 0.08)',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '0 24px',
                    zIndex: 10000,
                    color: 'var(--color-text)',
                    boxShadow: '0 4px 12px rgba(15, 23, 42, 0.02)'
                  }}>
                    <span style={{ fontSize: '0.9rem', fontWeight: 500, letterSpacing: '-0.2px', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap', maxWidth: '75%' }}>
                      {report.title}
                    </span>
                    <button 
                      onClick={() => setIsFullscreen(false)}
                      style={{
                        background: 'var(--color-accent)',
                        color: '#ffffff',
                        border: 'none',
                        padding: '6px 14px',
                        borderRadius: '0px',
                        fontSize: '0.8rem',
                        fontWeight: 500,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        boxShadow: '0 4px 10px rgba(46, 91, 255, 0.2)',
                        transition: 'all 0.3s'
                      }}
                    >
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <line x1="18" y1="6" x2="6" y2="18"/>
                        <line x1="6" y1="6" x2="18" y2="18"/>
                      </svg>
                      退出沉浸阅读 (Esc)
                    </button>
                  </div>
                )}

                {/* 报告容器 (非全屏时卡片展示，全屏时铺满整个窗口) */}
                <div style={isFullscreen ? {
                  position: 'fixed',
                  top: '52px',
                  left: 0,
                  width: '100vw',
                  height: 'calc(100vh - 52px)',
                  zIndex: 9999,
                  background: '#ffffff',
                  borderRadius: 0,
                  margin: 0,
                  overflow: 'hidden'
                } : {
                  position: 'relative', // 设为定位基准，以承载悬浮按钮
                  borderRadius: 'var(--border-radius)',
                  boxShadow: '0 10px 40px rgba(160, 109, 68, 0.02)',
                  border: 'none',
                  marginTop: '10px',
                  transition: 'all 0.5s ease',
                  overflow: 'hidden',
                  background: '#ffffff'
                }}>
                  <iframe
                    srcDoc={content || ''}
                    style={{
                      width: '100%',
                      height: '100%',
                      minHeight: isFullscreen ? 'calc(100vh - 52px)' : '80vh',
                      border: 'none',
                      display: 'block'
                    }}
                    sandbox="allow-scripts allow-popups allow-popups-to-escape-sandbox"
                  />

                  {/* 智能悬浮全屏控制按钮：仅在未全屏时悬浮在报告窗口右下角 */}
                  {!isFullscreen && (
                    <button
                      onClick={() => setIsFullscreen(true)}
                      style={{
                        position: 'absolute',
                        bottom: '24px',
                        right: '24px',
                        zIndex: 50,
                        background: 'rgba(253, 251, 247, 0.95)',
                        backdropFilter: 'blur(12px)',
                        border: '1px solid rgba(160, 109, 68, 0.18)',
                        borderRadius: '50%',
                        width: '46px',
                        height: '46px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        cursor: 'pointer',
                        boxShadow: '0 6px 20px rgba(160, 109, 68, 0.12)',
                        color: 'var(--color-text)',
                        opacity: 0.5,
                        transition: 'all 0.3s cubic-bezier(0.16, 1, 0.3, 1)'
                      }}
                      onMouseOver={(e) => {
                        e.currentTarget.style.opacity = '1';
                        e.currentTarget.style.transform = 'scale(1.08)';
                        e.currentTarget.style.borderColor = 'var(--color-accent)';
                        e.currentTarget.style.color = 'var(--color-accent)';
                        e.currentTarget.style.boxShadow = '0 0 15px rgba(255, 100, 30, 0.2)';
                      }}
                      onMouseOut={(e) => {
                        e.currentTarget.style.opacity = '0.5';
                        e.currentTarget.style.transform = 'none';
                        e.currentTarget.style.borderColor = 'rgba(160, 109, 68, 0.18)';
                        e.currentTarget.style.color = 'var(--color-text)';
                        e.currentTarget.style.boxShadow = '0 6px 20px rgba(160, 109, 68, 0.12)';
                      }}
                      title="全屏沉浸阅读模式"
                    >
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.25" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7"/>
                      </svg>
                    </button>
                  )}

                  {/* 全屏缩小悬浮控制按钮：在全屏时悬浮在屏幕右下角 */}
                  {isFullscreen && (
                    <button
                      onClick={() => setIsFullscreen(false)}
                      style={{
                        position: 'fixed',
                        bottom: '24px',
                        right: '24px',
                        zIndex: 10005,
                        background: 'rgba(253, 251, 247, 0.95)',
                        backdropFilter: 'blur(12px)',
                        border: '1px solid rgba(160, 109, 68, 0.18)',
                        borderRadius: '50%',
                        width: '46px',
                        height: '46px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        cursor: 'pointer',
                        boxShadow: '0 6px 20px rgba(160, 109, 68, 0.12)',
                        color: 'var(--color-text)',
                        opacity: 0.5,
                        transition: 'all 0.3s cubic-bezier(0.16, 1, 0.3, 1)'
                      }}
                      onMouseOver={(e) => {
                        e.currentTarget.style.opacity = '1';
                        e.currentTarget.style.transform = 'scale(1.08)';
                        e.currentTarget.style.borderColor = 'var(--color-accent)';
                        e.currentTarget.style.color = 'var(--color-accent)';
                        e.currentTarget.style.boxShadow = '0 0 15px rgba(255, 100, 30, 0.2)';
                      }}
                      onMouseOut={(e) => {
                        e.currentTarget.style.opacity = '0.5';
                        e.currentTarget.style.transform = 'none';
                        e.currentTarget.style.borderColor = 'rgba(160, 109, 68, 0.18)';
                        e.currentTarget.style.color = 'var(--color-text)';
                        e.currentTarget.style.boxShadow = '0 6px 20px rgba(160, 109, 68, 0.12)';
                      }}
                      title="退出全屏沉浸阅读"
                    >
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.25" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M4 14h6v6M20 10h-6V4M14 10l7-7M10 14l-7 7"/>
                      </svg>
                    </button>
                  )}
                </div>
                
                {/* 已解锁的笔记记录交互区 */}
                <div style={{
                  marginTop: '30px',
                  background: 'rgba(255, 255, 255, 0.45)',
                  backdropFilter: 'blur(15px)',
                  border: '1px solid rgba(18, 18, 18, 0.05)',
                  borderRadius: 'var(--border-radius)',
                  padding: '24px 30px',
                  boxShadow: '0 8px 32px rgba(0, 0, 0, 0.01)'
                }}>
                  <h3 style={{ margin: '0 0 16px 0', fontSize: '1rem', color: 'var(--color-text)', fontWeight: 400, display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M12 20h9" />
                      <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
                    </svg>
                    业务备忘笔记
                  </h3>
                  <textarea
                    placeholder="在此记录针对该客户或品类的跟进要点、核心供应商联系方式或您的个人业务构想..."
                    value={noteText}
                    onChange={(e) => setNoteText(e.target.value)}
                    style={{
                      width: '100%',
                      height: '100px',
                      background: 'rgba(255, 255, 255, 0.65)',
                      border: '1px solid rgba(18, 18, 18, 0.08)',
                      borderRadius: 'var(--border-radius)',
                      padding: '12px 16px',
                      fontSize: '0.85rem',
                      color: 'var(--color-text)',
                      outline: 'none',
                      resize: 'vertical',
                      fontFamily: 'inherit',
                      boxSizing: 'border-box'
                    }}
                  />
                  <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '12px' }}>
                    <button
                      onClick={handleSaveNote}
                      disabled={isSavingNote}
                      className="sand-btn"
                      style={{
                        padding: '8px 24px',
                        fontSize: '0.85rem',
                        cursor: isSavingNote ? 'not-allowed' : 'pointer',
                        opacity: isSavingNote ? 0.7 : 1
                      }}
                    >
                      {isSavingNote ? '正在保存...' : '保存备忘笔记'}
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              // 未解锁状态：展现结构化研报全景大纲、前导核心摘要与引导解锁卡片（既对爬虫友好，又严格保护付费数据）
              <div style={{ position: 'relative' }}>
                {/* 1. 结构化大纲与核心导读公开展示区 */}
                <div
                  style={{
                    backgroundColor: 'rgba(255, 255, 255, 0.65)',
                    backdropFilter: 'blur(15px)',
                    WebkitBackdropFilter: 'blur(15px)',
                    border: '1px solid rgba(18, 18, 18, 0.08)',
                    borderRadius: 'var(--border-radius)',
                    padding: '32px 36px',
                    marginBottom: '32px',
                    boxShadow: '0 8px 30px rgba(0, 0, 0, 0.02)'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
                    <span style={{ fontSize: '1.1rem' }}>📌</span>
                    <h3 style={{ fontSize: '1.15rem', fontWeight: 600, color: 'var(--color-text)', margin: 0 }}>
                      研报核心分析维度与前导摘要
                    </h3>
                  </div>

                  {/* 核心导读文本 */}
                  <p style={{
                    fontSize: '0.92rem',
                    lineHeight: 1.8,
                    color: 'var(--color-text)',
                    margin: '0 0 24px 0',
                    fontWeight: 300,
                    textAlign: 'justify'
                  }}>
                    {previewData.excerpt || report.summary || '本篇商业洞察研报基于全球公开海关提单、企业官方财报及国际行业协会公报进行多维事实交叉验证，深度剖析目标市场供应链网络、买家采购偏好与核心准入技术标准。'}
                  </p>

                  {/* 研报全景大纲目录速览 */}
                  {previewData.toc && previewData.toc.length > 0 && (
                    <div>
                      <div style={{
                        fontSize: '0.85rem',
                        fontWeight: 600,
                        color: 'var(--color-muted)',
                        textTransform: 'uppercase',
                        letterSpacing: '1px',
                        marginBottom: '14px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px'
                      }}>
                        <span>📑</span> 研报包含的核心分析章节大纲 (Table of Contents)
                      </div>
                      <div
                        style={{
                          display: 'grid',
                          gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
                          gap: '12px'
                        }}
                      >
                        {previewData.toc.map((chapter, idx) => (
                          <div
                            key={idx}
                            style={{
                              backgroundColor: '#ffffff',
                              border: '1px solid rgba(18, 18, 18, 0.06)',
                              borderRadius: '8px',
                              padding: '12px 16px',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '10px',
                              boxShadow: '0 2px 8px rgba(0, 0, 0, 0.01)'
                            }}
                          >
                            <span
                              style={{
                                width: '22px',
                                height: '22px',
                                borderRadius: '50%',
                                backgroundColor: 'rgba(255, 100, 30, 0.1)',
                                color: 'var(--color-accent, #ff641e)',
                                fontSize: '0.75rem',
                                fontWeight: 700,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                flexShrink: 0
                              }}
                            >
                              {idx + 1}
                            </span>
                            <span
                              style={{
                                fontSize: '0.88rem',
                                color: 'var(--color-text)',
                                fontWeight: 400,
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                whiteSpace: 'nowrap'
                              }}
                            >
                              {chapter}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* 2. 付费深度数据遮罩与解锁卡片 */}
                <div style={{ position: 'relative', minHeight: '280px' }}>
                  <div style={{ filter: 'blur(8px)', userSelect: 'none', pointerEvents: 'none', opacity: 0.18, lineHeight: 1.9, color: 'var(--color-muted)' }}>
                    <p>【高敏感核心供应链数据】该买家在过去三年的核心供货网络拓扑分布，涵盖关键工厂出货周期与议价能力权重分析...</p>
                    <p>【深度财务与交易风险穿透】针对欧盟最新环保与碳关税政策调整，目标买家在下半年的集中直采类目与规格偏好演进模型...</p>
                    <p>【交互式全景图表】包含上游供应商梯队图谱、同行竞争矩阵对比及各核心决策人商务接洽要点...</p>
                  </div>
                  
                  {/* 解锁弹窗 */}
                  <div style={{
                    position: 'absolute',
                    top: '20px',
                    left: '50%',
                    transform: 'translateX(-50%)',
                    width: '90%',
                    maxWidth: '460px',
                    background: 'rgba(253, 251, 247, 0.92)',
                    border: '1px solid rgba(18, 18, 18, 0.08)',
                    borderRadius: 'var(--border-radius)',
                    padding: '36px 32px',
                    textAlign: 'center',
                    boxShadow: '0 20px 50px rgba(0, 0, 0, 0.1)',
                    zIndex: 10,
                    backdropFilter: 'blur(20px)',
                    WebkitBackdropFilter: 'blur(20px)',
                    color: 'var(--color-text)'
                  }}>
                    <div style={{
                      width: '44px',
                      height: '44px',
                      borderRadius: '12px',
                      backgroundColor: 'rgba(255, 100, 30, 0.1)',
                      color: 'var(--color-accent, #ff641e)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      margin: '0 auto 16px auto',
                      fontSize: '1.3rem'
                    }}>
                      🔒
                    </div>
                    <h3 style={{ margin: '0 0 10px 0', fontSize: '1.25rem', fontWeight: 600, letterSpacing: '-0.3px' }}>解锁研报阅读完整深度情报</h3>
                    <p style={{ fontSize: '0.86rem', color: 'var(--color-muted)', marginBottom: '24px', lineHeight: 1.6, fontWeight: 300 }}>
                      此研报包含完整的高保真交互式图表、供应链穿透网络与供应商决策要点。您可以消耗 1 次免费额度直接解锁。
                    </p>
                    <button 
                      onClick={handleUnlock}
                      className="accent-glow"
                      style={{
                        padding: '14px 28px',
                        fontSize: '0.95rem',
                        fontWeight: 500,
                        width: '100%',
                        background: 'var(--color-accent)',
                        color: '#ffffff',
                        border: 'none',
                        borderRadius: 'var(--border-radius)',
                        cursor: 'pointer',
                        transition: 'all 0.3s cubic-bezier(0.16, 1, 0.3, 1)'
                      }}
                    >
                      {userId ? '立即解锁研报 (消耗 1 次额度)' : '请先登录后再解锁研报'}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* 知识跳转链 (强关联延伸推荐) */}
          {related.length > 0 && (
            <div style={{ borderTop: 'none', paddingTop: '40px' }}>
              <h3 style={{ fontSize: '1.1rem', fontWeight: 300, color: 'var(--color-text)', marginBottom: '20px', letterSpacing: '-0.3px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
                  <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
                </svg>
                延伸知识链条 (顺藤摸瓜探索更多关联报告)
              </h3>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '20px' }}>
                {related.map(item => (
                  <Link href={`/reports/${item.id}`} key={item.id} style={{ textDecoration: 'none' }}>
                  <div 
                    className="report-card"
                    style={{
                      borderRadius: 'var(--border-radius)',
                      padding: '20px',
                      cursor: 'pointer',
                      boxSizing: 'border-box'
                    }}
                  >
                      <span style={{
                        fontSize: '0.7rem',
                        fontWeight: 300,
                        color: 'var(--color-muted)',
                        background: 'transparent',
                        border: '1px solid rgba(18, 18, 18, 0.08)',
                        padding: '4px 10px',
                        borderRadius: 'var(--border-radius)',
                        display: 'inline-block',
                        marginBottom: '10px'
                      }}>
                        {item.category === 'customer' ? '客户洞察' : '品类分析'}
                      </span>
                      <h4 style={{ margin: '0 0 8px 0', fontSize: '0.95rem', color: 'var(--color-text)', fontWeight: 400 }}>{item.title}</h4>
                      <span style={{ fontSize: '0.75rem', color: 'var(--color-muted)', fontWeight: 300, display: 'flex', alignItems: 'center', gap: '4px', marginTop: '4px' }}>
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" strokeLinejoin="round">
                          <circle cx="12" cy="12" r="10" />
                          <line x1="2" y1="12" x2="22" y2="12" />
                          <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
                        </svg>
                        目标地区: {item.market_region}
                      </span>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          )}

        </div>

      </div>
      <AuthModal
        isOpen={showAuthModal}
        onClose={() => setShowAuthModal(false)}
      />

      {/* 🖼️ 报告正文图片全屏放大预览 Modal */}
      {previewImgUrl && (
        <div
          onClick={() => setPreviewImgUrl(null)}
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0, 0, 0, 0.85)',
            backdropFilter: 'blur(15px)',
            WebkitBackdropFilter: 'blur(15px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 99999,
            cursor: 'zoom-out',
            animation: 'navFadeIn 0.2s ease-out'
          }}
        >
          <img
            src={previewImgUrl}
            alt="图片放大预览"
            style={{
              maxWidth: '92vw',
              maxHeight: '92vh',
              objectFit: 'contain',
              borderRadius: '8px',
              boxShadow: '0 25px 60px rgba(0, 0, 0, 0.6)',
              cursor: 'zoom-out'
            }}
          />
          <button
            onClick={() => setPreviewImgUrl(null)}
            style={{
              position: 'absolute',
              top: '24px',
              right: '24px',
              background: 'rgba(255, 255, 255, 0.2)',
              border: 'none',
              color: '#ffffff',
              fontSize: '1.4rem',
              width: '44px',
              height: '44px',
              borderRadius: '50%',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              backdropFilter: 'blur(10px)',
              transition: 'background 0.2s'
            }}
          >
            ✕
          </button>
        </div>
      )}
    </WatermarkContainer>
  );
}

export const getServerSideProps: GetServerSideProps = async (context) => {
  const { id } = context.params!;
  let dbClient: any = null;

  try {
    dbClient = await pool.connect();
    const auth = await resolveSsrAuth(context, dbClient);

    const userId = auth.userId;
    const userRole = auth.userRole;
    const freeQuota = auth.freeQuota;
    const nickname = auth.nickname;

function extractPublicPreview(contentHtml: string | null) {
  if (!contentHtml) return { toc: [], excerpt: '' };
  
  // 提取章节标题 h2 / h3
  const headingMatches = contentHtml.match(/<h[23][^>]*>(.*?)<\/h[23]>/gi) || [];
  const toc = headingMatches.map(h => {
    return h.replace(/<[^>]+>/g, '').trim();
  }).filter(t => t.length > 2 && t.length < 80).slice(0, 8);

  // 提取正文实质段落
  const pMatches = contentHtml.match(/<p[^>]*>(.*?)<\/p>/gi) || [];
  const cleanParagraphs = pMatches
    .map(p => p.replace(/<[^>]+>/g, '').trim())
    .filter(p => p.length > 25 && !p.includes('版权') && !p.includes('保留所有权利') && !p.includes('免责'))
    .slice(0, 2);

  const excerpt = cleanParagraphs.join(' ');
  return { toc, excerpt };
}

    let report: any = null;
    let previewData = { toc: [] as string[], excerpt: '' };
    let related: RelatedReport[] = [];
    let isFavorite = false;
    let noteContent = '';

    // 并行拉取：报告详情、收藏状态、笔记、关联推荐报告
    const reportPromise = (async () => {
      if (userId) {
        if (userRole === 'admin') {
          const reportRes = await dbClient.query(
            'SELECT id, title, category, market_region, summary, content_html FROM reports WHERE id = $1',
            [id]
          );
          if (reportRes.rows.length === 0) return null;
          const rep = reportRes.rows[0];
          previewData = extractPublicPreview(rep.content_html);
          return {
            id: rep.id,
            title: rep.title,
            category: rep.category,
            market_region: rep.market_region,
            summary: rep.summary,
            isUnlocked: true,
            content_html: localizeReportHtml(rep.content_html)
          };
        } else {
          const detail = await getReportDetail(userId, id as string, dbClient);
          if (detail && detail.content_html) {
            previewData = extractPublicPreview(detail.content_html);
          }
          return detail;
        }
      } else {
        const reportRes = await dbClient.query(
          'SELECT id, title, category, market_region, summary, content_html FROM reports WHERE id = $1',
          [id]
        );
        if (reportRes.rows.length === 0) return null;
        const rep = reportRes.rows[0];
        previewData = extractPublicPreview(rep.content_html);
        return {
          id: rep.id,
          title: rep.title,
          category: rep.category,
          market_region: rep.market_region,
          summary: rep.summary,
          isUnlocked: false,
          content_html: null
        };
      }
    })();

    const favPromise = userId
      ? dbClient.query('SELECT id FROM favorites WHERE user_id = $1 AND report_id = $2', [userId, id])
      : Promise.resolve({ rows: [] });

    const notePromise = userId
      ? dbClient.query('SELECT content FROM notes WHERE user_id = $1 AND report_id = $2', [userId, id])
      : Promise.resolve({ rows: [] });

    const relatedPromise = dbClient.query(
      `SELECT r.id, r.title, r.category, r.market_region, rel.relation_key
       FROM reports r
       JOIN relations rel ON r.id = rel.report_id_a
       WHERE rel.report_id_b = $1
       UNION
       SELECT r.id, r.title, r.category, r.market_region, rel.relation_key
       FROM reports r
       JOIN relations rel ON r.id = rel.report_id_b
       WHERE rel.report_id_a = $1`,
      [id]
    );

    const [resolvedReport, favRes, noteRes, relatedRes] = await Promise.all([
      reportPromise,
      favPromise,
      notePromise,
      relatedPromise
    ]);

    if (!resolvedReport) {
      return { notFound: true };
    }

    report = resolvedReport;
    isFavorite = favRes.rows.length > 0;
    noteContent = noteRes.rows[0]?.content || '';

    const rawRows = relatedRes.rows;

    // 1. 归类到 4 个关系类型的篮子中
    const baskets: Record<string, any[]> = {
      competitor: [],
      supplier: [],
      operation: [],
      mention: []
    };

    rawRows.forEach((row: any) => {
      const key = row.relation_key;
      if (baskets[key]) {
        baskets[key].push(row);
      } else {
        baskets.mention.push(row);
      }
    });

    // 2. 随机打散每个篮子中的候选报告
    const shuffle = (array: any[]) => {
      for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
      }
      return array;
    };

    shuffle(baskets.competitor);
    shuffle(baskets.supplier);
    shuffle(baskets.operation);
    shuffle(baskets.mention);

    // 3. 轮询穿插抽取不重复的报告 (竞争 -> 供销 -> 经营 -> 涉及)
    const orderKeys = ['competitor', 'supplier', 'operation', 'mention'];
    const basketIndices = [0, 0, 0, 0];
    const selectedList: any[] = [];
    const selectedIds = new Set<string>();

    let hasMore = true;
    while (selectedList.length < 4 && hasMore) {
      hasMore = false;
      for (let i = 0; i < 4; i++) {
        if (selectedList.length >= 4) break;
        const key = orderKeys[i];
        const basket = baskets[key];
        const curIdx = basketIndices[i];
        if (curIdx < basket.length) {
          hasMore = true;
          const item = basket[curIdx];
          basketIndices[i] = curIdx + 1;
          if (!selectedIds.has(item.id)) {
            selectedIds.add(item.id);
            selectedList.push({
              id: item.id,
              title: item.title,
              category: item.category,
              market_region: item.market_region
            });
          }
        }
      }
    }

    // 4. 最后再次随机混淆已选出报告的排序，以完全打破规律性
    related = shuffle(selectedList);

    if (userId) {
      context.res.setHeader('Cache-Control', 'private, no-cache, no-store');
    } else {
      context.res.setHeader('Cache-Control', 'public, s-maxage=3600, stale-while-revalidate=86400');
    }
    context.res.setHeader('Vary', 'Cookie');


    const proto = (context.req.headers['x-forwarded-proto'] as string) || 'https';
    const host = (context.req.headers['x-forwarded-host'] as string) || context.req.headers.host || 'marketgraphic.cn';
    const siteUrl = `${proto}://${host}`;
    const canonicalUrl = `${siteUrl}/reports/${id}`;

    return {
      props: {
        report,
        previewData,
        related,
        canonicalUrl,
        siteUrl,
        userId: userId || '',
        userRole,
        freeQuota,
        initialIsFavorite: isFavorite,
        initialNoteContent: noteContent,
        nickname
      }
    };
  } catch (err: any) {
    if (err.message === '报告未找到' || err.message?.includes('未找到')) {
      return { notFound: true };
    }
    console.error('SSR 加载报告详情页失败，原因:', err);
    throw err; // 让 Next.js 渲染 500.tsx 错误页，避免伪装成 404 导致爬虫误删索引
  } finally {

    if (dbClient) {
      dbClient.release();
    }
  }
};

