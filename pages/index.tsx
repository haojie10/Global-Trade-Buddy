import { GetServerSideProps } from 'next';
import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
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
  const [reports, setReports] = useState(allReports);
  const [showAllReports, setShowAllReports] = useState(false);
  const [emailInput, setEmailInput] = useState('');
  const [subscribed, setSubscribed] = useState(false);
  const [prefArticles, setPrefArticles] = useState<any[]>(latestArticles);

  const router = useRouter();

  // 根据 localStorage 偏好设置动态过滤首页资讯
  useEffect(() => {
    const cacheRegion = localStorage.getItem('gtb_news_region') || 'All';
    const cacheCountry = localStorage.getItem('gtb_news_country') || 'All';
    const cacheIndustry = localStorage.getItem('gtb_news_industry') || 'All';

    if (cacheRegion !== 'All' || cacheCountry !== 'All' || cacheIndustry !== 'All') {
      let url = `/api/user/articles?pageSize=6`;
      if (cacheRegion !== 'All') url += `&region=${encodeURIComponent(cacheRegion)}`;
      if (cacheCountry !== 'All') url += `&country=${encodeURIComponent(cacheCountry)}`;
      if (cacheIndustry !== 'All') url += `&industry=${encodeURIComponent(cacheIndustry)}`;

      fetch(url)
        .then(res => res.json())
        .then(data => {
          if (data.articles && data.articles.length > 0) {
            setPrefArticles(data.articles);
          } else {
            setPrefArticles(latestArticles);
          }
        })
        .catch(() => setPrefArticles(latestArticles));
    } else {
      setPrefArticles(latestArticles);
    }
  }, [latestArticles]);

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
            // 实时增加前台显示额度
            setQuota(prev => prev + 1);
          }
          // 无论成功还是失败，均清除本地缓存，防止重复请求
          localStorage.removeItem('gtb_referrer_id');
        })
        .catch(err => {
          console.error('[ERROR] 自动绑定邀请关系失败:', err);
          localStorage.removeItem('gtb_referrer_id');
        });
    }
  }, [userId]);

  // 弹窗与控制面板状态
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [showUploadModal, setShowUploadModal] = useState(false);

  // 调色板定制状态
  const [accentColor, setAccentColor] = useState('#ff641e');
  const [bgSub, setBgSub] = useState('#eaeaea');
  const [ambientOpacity, setAmbientOpacity] = useState(0.40);
  const [ambientBlur, setAmbientBlur] = useState(30);
  const [ambientScale, setAmbientScale] = useState(1.4);
  const [ambientBlendMode, setAmbientBlendMode] = useState('normal');
  const [brandWeight, setBrandWeight] = useState<'standard' | 'vibrant'>('standard');

  // 实时同步 CSS 变量
  useEffect(() => {
    const root = document.documentElement;
    if (root) {
      root.style.setProperty('--color-accent', accentColor);
      root.style.setProperty('--bg-sub', bgSub);
      root.style.setProperty('--ambient-opacity', String(ambientOpacity));
      root.style.setProperty('--ambient-blur', `${ambientBlur}px`);
      root.style.setProperty('--ambient-scale', String(ambientScale));
      root.style.setProperty('--ambient-blend-mode', ambientBlendMode);
    }
  }, [accentColor, bgSub, ambientOpacity, ambientBlur, ambientScale, ambientBlendMode]);

  const handleLogout = () => {
    document.cookie = `user_id=; path=/; max-age=0`;
    document.cookie = `user_role=; path=/; max-age=0`;
    window.location.reload();
  };



  // 滚动进入可视区域动画监听
  useEffect(() => {
    const observerOptions = {
      root: null,
      rootMargin: '0px',
      threshold: 0.1,
    };

    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('in-view');
        }
      });
    }, observerOptions);

    const targets = document.querySelectorAll('.animate-on-scroll');
    targets.forEach((target) => observer.observe(target));

    return () => {
      targets.forEach((target) => observer.unobserve(target));
    };
  }, [reports]);

  const handleSubscribe = (e: React.FormEvent) => {
    e.preventDefault();
    if (emailInput.trim()) {
      setSubscribed(true);
      setEmailInput('');
      setTimeout(() => setSubscribed(false), 3000);
    }
  };




  return (
    <div style={{
      background: 'transparent',
      color: 'var(--color-text)',
      minHeight: '100vh',
      position: 'relative'
    }}>
      {/* 全局背景流光光源 */}
      <div className="ambient-glow-container">
        <div className="ambient-light ambient-light-1" />
      </div>

      {/* 统一导航栏 */}
      <Navbar
        userId={userId}
        userRole={userRole}
        quota={quota}
        nickname={nickname}
        onShowAuthModal={() => setShowAuthModal(true)}
        onShowUploadModal={() => setShowUploadModal(true)}
      />

      {/* 滚动大容器 */}
      <div style={{ position: 'relative', zIndex: 10, paddingTop: '80px' }}>
        
        {/* 模块一：Hero 核心引导区 */}
        <section style={{
          minHeight: '88vh',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'center',
          textAlign: 'center',
          padding: brandWeight === 'vibrant' ? '80px 40px' : '40px 20px',
          position: 'relative',
          maxWidth: '1200px',
          margin: brandWeight === 'vibrant' ? '40px auto' : '0 auto',
          background: brandWeight === 'vibrant' ? 'linear-gradient(135deg, var(--color-accent) 0%, #ff884d 100%)' : 'transparent',
          borderRadius: '0px',
          boxShadow: brandWeight === 'vibrant' ? '0 20px 50px rgba(255, 100, 30, 0.15)' : 'none',
          transition: 'all 0.5s ease-in-out'
        }}>
          {/* 移除浮动卡片 */}

          <div style={{ maxWidth: '850px', zIndex: 5 }}>
            <span style={{
              background: 'transparent',
              border: '1px solid rgba(18, 18, 18, 0.08)',
              padding: '6px 16px',
              borderRadius: '0px',
              color: 'var(--color-muted)',
              fontSize: '0.85rem',
              fontWeight: 300,
              textTransform: 'uppercase',
              letterSpacing: '1.5px',
              display: 'inline-block',
              marginBottom: '24px'
            }}>
              专为出海决策者与外贸精英量身打造的市场资讯分析与认知图谱平台
            </span>
            <h2 className="font-editorial" style={{
              fontSize: '3.8rem',
              fontWeight: 400,
              lineHeight: 1.25,
              margin: '0 0 24px 0',
              color: brandWeight === 'vibrant' ? '#ffffff' : 'var(--color-text)',
              letterSpacing: '-0.02em'
            }}>
              俯瞰全球市场结构<br />循线追踪市场盲区
            </h2>
            <p style={{
              fontSize: '1.25rem',
              color: brandWeight === 'vibrant' ? 'rgba(255, 255, 255, 0.85)' : 'var(--color-muted)',
              lineHeight: 1.6,
              maxWidth: '720px',
              margin: '0 auto 36px auto',
              fontWeight: 300
            }}>
              告别碎片资讯与认知局限。外贸智友帮您突破原有认知边界，实现多维度的全球品类洞察。通过网状知识图谱将零碎资讯智能互联，助您在宏观的全球贸易版图中掌握更清晰的市场认知。
            </p>
            <button 
              onClick={() => router.push('/reports')}
              className="sand-btn"
              style={{
                padding: '16px 40px',
                fontSize: '1rem',
                background: 'transparent',
                border: '1px solid rgba(18, 18, 18, 0.15)',
                color: '#000000',
                borderRadius: '0px',
                transition: 'all 0.2s',
                cursor: 'pointer'
              }}
              onMouseOver={(e) => {
                e.currentTarget.style.borderColor = 'var(--color-accent)';
                e.currentTarget.style.color = 'var(--color-accent)';
              }}
              onMouseOut={(e) => {
                e.currentTarget.style.borderColor = 'rgba(18, 18, 18, 0.15)';
                e.currentTarget.style.color = '#000000';
              }}
            >
              立即探索洞察大厅
            </button>
          </div>
        </section>



      {/* 新增三大认知能力板块与认知图谱预览 */}
        <section className="animate-on-scroll" style={{
          padding: '60px 40px',
          maxWidth: '1400px',
          margin: '0 auto',
          background: 'transparent'
        }}>
          <div style={{ textAlign: 'center', marginBottom: '45px' }}>
            <span style={{ color: 'var(--color-accent)', fontSize: '0.8rem', letterSpacing: '2px', textTransform: 'uppercase' }}>Core Capabilities</span>
            <h2 className="font-editorial" style={{ fontSize: '2.5rem', margin: '8px 0 0 0', fontWeight: 400 }}>为出海展业赋予更高的市场视野</h2>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '20px', marginBottom: '40px' }}>
            {/* 卡片一 */}
            <div className="float-on-hover" style={{ background: 'var(--card-bg)', backdropFilter: 'blur(15px)', WebkitBackdropFilter: 'blur(15px)', border: '1px solid var(--card-border)', padding: '24px', borderRadius: 'var(--border-radius)', display: 'flex', flexDirection: 'column' }}>
              <div style={{ height: '140px', overflow: 'hidden', borderRadius: 'var(--border-radius)', marginBottom: '16px', border: '1px solid rgba(18, 18, 18, 0.08)', boxShadow: '0 4px 12px rgba(0,0,0,0.01)' }}>
                <img src="/images/market_structure_network.jpg" alt="拓宽视野" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              </div>
              <h3 style={{ fontSize: '1.2rem', margin: '0 0 10px 0', color: 'var(--color-text)', fontWeight: 500 }}>拓宽视野：突破认知盲区</h3>
              <p style={{ fontSize: '0.9rem', color: 'var(--color-muted)', lineHeight: 1.6, margin: 0, fontWeight: 300 }}>
                通过解锁品类与渠道洞察报告，智能匹配相近的公司或关联产品。带您探索以前未曾关注的盲区市场，打破原有的信息茧房。
              </p>
            </div>

            {/* 卡片二 */}
            <div className="float-on-hover" style={{ background: 'var(--card-bg)', backdropFilter: 'blur(15px)', WebkitBackdropFilter: 'blur(15px)', border: '1px solid var(--card-border)', padding: '24px', borderRadius: 'var(--border-radius)', display: 'flex', flexDirection: 'column' }}>
              <div style={{ height: '140px', overflow: 'hidden', borderRadius: 'var(--border-radius)', marginBottom: '16px', border: '1px solid rgba(18, 18, 18, 0.08)', boxShadow: '0 4px 12px rgba(0,0,0,0.01)' }}>
                <img src="/images/global_trade_trends.jpg" alt="掌握动向" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              </div>
              <h3 style={{ fontSize: '1.2rem', margin: '0 0 10px 0', color: 'var(--color-text)', fontWeight: 500 }}>掌握动向：全球品类洞察</h3>
              <p style={{ fontSize: '0.9rem', color: 'var(--color-muted)', lineHeight: 1.6, margin: 0, fontWeight: 300 }}>
                提供多维度的全球品类洞察。深度剖析海外主流零售渠道最新的渗透率与上架准入标准，结合绿色环保、锂电化等前沿变动，精准捕捉市场动向。
              </p>
            </div>

            {/* 卡片三 */}
            <div className="float-on-hover" style={{ background: 'var(--card-bg)', backdropFilter: 'blur(15px)', WebkitBackdropFilter: 'blur(15px)', border: '1px solid var(--card-border)', padding: '24px', borderRadius: 'var(--border-radius)', borderColor: 'var(--color-accent)', display: 'flex', flexDirection: 'column' }}>
              <div style={{ height: '140px', overflow: 'hidden', borderRadius: 'var(--border-radius)', marginBottom: '16px', border: '1px solid rgba(18, 18, 18, 0.08)', boxShadow: '0 4px 12px rgba(0,0,0,0.01)' }}>
                <img src="/images/global_market_focus.jpg" alt="筛选聚焦" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              </div>
              <h3 style={{ fontSize: '1.2rem', margin: '0 0 10px 0', color: 'var(--color-text)', fontWeight: 500 }}>筛选聚焦：纵览市场全局</h3>
              <p style={{ fontSize: '0.9rem', color: 'var(--color-muted)', lineHeight: 1.6, margin: 0, fontWeight: 300 }}>
                支持跨行业、跨国家的精细化筛选，满足您对特定国家的关注需求。不仅能进行循线追踪，更能让您聚焦地审视整个市场的全局结构。
              </p>
            </div>
          </div>

          {/* 市场认知图谱配图 */}
          <div style={{ background: 'var(--card-bg)', backdropFilter: 'blur(15px)', WebkitBackdropFilter: 'blur(15px)', border: '1px solid var(--card-border)', borderRadius: 'var(--border-radius)', padding: '30px', display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: '40px' }}>
            <div style={{ flex: '1 1 400px' }}>
              <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--color-accent)', letterSpacing: '2px', textTransform: 'uppercase', marginBottom: '8px' }}>
                Discover & Focus
              </div>
              <h4 style={{ fontSize: '1.2rem', color: 'var(--color-text)', margin: '0 0 10px 0', fontWeight: 500 }}>循线追踪，绘制您的专属市场认知脑图</h4>
              <p style={{ fontSize: '0.95rem', color: 'var(--color-muted)', lineHeight: 1.6, margin: '0 0 15px 0', fontWeight: 300 }}>
                在您的个人市场图谱中，每一份行业资讯、零售渠道、核心品类及个人笔记都被编织成清晰的知识网络。您可以通过实体之间的关联网络，向下延伸发现相近的品类或公司，向上俯瞰把握宏观结构，将市场掌握得更加透彻。
              </p>
              <span style={{ fontSize: '0.9rem', color: 'var(--color-accent)', borderBottom: '1px solid var(--color-accent)', paddingBottom: '2px', fontWeight: 400 }}>
                结合报告与个人见解，沉淀专属的商业大脑 ➔
              </span>
            </div>
            <div style={{ flex: '1 1 300px', maxWidth: '480px', borderRadius: 'var(--border-radius)', overflow: 'hidden', border: '1px solid rgba(18, 18, 18, 0.08)', boxShadow: '0 8px 32px rgba(0,0,0,0.02)' }}>
              <img src="/images/discover_focus_panorama.jpg" alt="Discover & Focus" style={{ width: '100%', display: 'block' }} />
            </div>
          </div>
        </section>



        {/* 模块四：拓展效能与增长工具 */}
        <section className="animate-on-scroll" style={{
          padding: '60px 40px',
          maxWidth: '1400px',
          margin: '0 auto',
          background: 'transparent'
        }}>
          <div style={{ textAlign: 'center', marginBottom: '45px' }}>
            <span style={{ color: 'var(--color-accent)', fontSize: '0.8rem', letterSpacing: '2px', textTransform: 'uppercase' }}>Growth & Productivity</span>
            <h2 className="font-editorial" style={{ fontSize: '2.5rem', margin: '8px 0 0 0', fontWeight: 400 }}>更实用的出海赋能小工具</h2>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: '30px' }}>
            {/* 个人笔记挂载 */}
            <div className="float-on-hover" style={{ background: 'var(--card-bg)', backdropFilter: 'blur(15px)', WebkitBackdropFilter: 'blur(15px)', border: '1px solid var(--card-border)', padding: '24px', borderRadius: 'var(--border-radius)', display: 'flex', gap: '20px', alignItems: 'flex-start' }}>
              <div style={{ background: 'var(--bg-main)', border: '1px solid rgba(18, 18, 18, 0.08)', padding: '12px', borderRadius: '0px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <span style={{ fontSize: '1.5rem' }}>📝</span>
              </div>
              <div>
                <h3 style={{ fontSize: '1.1rem', fontWeight: 500, margin: '0 0 8px 0', color: 'var(--color-text)' }}>
                  挂载个人笔记：沉淀专属出海大脑
                </h3>
                <p style={{ fontSize: '0.85rem', color: 'var(--color-muted)', lineHeight: 1.6, margin: 0, fontWeight: 300 }}>
                  支持在任何已解锁的报告或公司节点下，挂载您专属的随笔与见解。这些笔记将作为私密节点编织进图谱中，让您的个人市场图谱不断迭代成长。
                </p>
              </div>
            </div>

            {/* 邀请裂变机制 */}
            <div className="float-on-hover" style={{ 
              background: 'var(--card-bg)', 
              backdropFilter: 'blur(15px)', 
              WebkitBackdropFilter: 'blur(15px)', 
              border: '1px solid var(--card-border)', 
              padding: '24px', 
              borderRadius: 'var(--border-radius)', 
              display: 'flex', 
              gap: '20px', 
              alignItems: 'flex-start',
              flexDirection: 'column'
            }}>
              <div style={{ display: 'flex', gap: '20px', alignItems: 'flex-start' }}>
                <div style={{ background: 'var(--bg-main)', border: '1px solid rgba(18, 18, 18, 0.08)', padding: '12px', borderRadius: '0px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <span style={{ fontSize: '1.5rem' }}>🤝</span>
                </div>
                <div>
                  <h3 style={{ fontSize: '1.1rem', fontWeight: 500, margin: '0 0 8px 0', color: 'var(--color-text)' }}>
                    推荐同行加入：共同免费获取额度
                  </h3>
                  <p style={{ fontSize: '0.85rem', color: 'var(--color-muted)', lineHeight: 1.6, margin: 0, fontWeight: 300 }}>
                    通过分享您的专属邀请链接，推荐同行注册。每成功推荐一位用户，您与新注册用户均可获赠额外的免费报告解锁额度，实现双赢。
                  </p>
                </div>
              </div>
              
              <div style={{ width: '100%', marginTop: '8px' }}>
                {userId ? (
                  <div style={{ display: 'flex', gap: '10px' }}>
                    <input
                      type="text"
                      readOnly
                      value={`${typeof window !== 'undefined' ? window.location.origin : ''}/?invite=${userId}`}
                      style={{
                        flex: 1,
                        background: 'var(--input-bg)',
                        border: '1px solid var(--card-border)',
                        borderRadius: '0px',
                        padding: '8px 12px',
                        fontSize: '0.8rem',
                        color: 'var(--color-muted)',
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
                      className="sand-btn"
                      style={{
                        padding: '8px 16px',
                        fontSize: '0.8rem',
                        cursor: 'pointer'
                      }}
                    >
                      复制链接
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => {
                      const loginBtn = document.getElementById('navbar-login-btn');
                      if (loginBtn) {
                        loginBtn.click();
                      } else {
                        alert('请先在页面右上角登录后再生成专属邀请链接');
                      }
                    }}
                    className="sand-btn"
                    style={{
                      width: '100%',
                      padding: '10px',
                      fontSize: '0.85rem',
                      cursor: 'pointer',
                      textAlign: 'center'
                    }}
                  >
                    🔐 登录后生成我的专属邀请链接
                  </button>
                )}
              </div>
            </div>
          </div>
        </section>

        {/* 模块五：资讯订阅与 Footer */}
        <section className="animate-on-scroll" style={{
          padding: '120px 40px 60px 40px',
          maxWidth: '1440px',
          margin: '0 auto',
          borderTop: 'none'
        }}>
          {/* 新增：Call to Action (行动呼吁) 注册引导区 - 已登录状态下自动隐藏 */}
          {!userId && (
            <div style={{
              background: 'var(--card-bg)',
              border: '1px solid var(--card-border)',
              borderRadius: 'var(--border-radius)',
              padding: '60px 40px',
              textAlign: 'center',
              marginTop: '60px',
              marginBottom: '40px',
              boxShadow: '0 8px 32px rgba(0, 0, 0, 0.01)'
            }}>
              <h2 className="font-editorial" style={{
                fontSize: '2.2rem',
                fontWeight: 400,
                margin: '0 0 16px 0',
                color: 'var(--color-text)',
                letterSpacing: '-0.5px'
              }}>
                突破认知边界，即刻开启您的全球市场洞察之旅
              </h2>
              <p style={{ fontSize: '1rem', color: 'var(--color-muted)', maxWidth: '580px', margin: '0 auto 36px auto', fontWeight: 300, lineHeight: 1.6 }}>
                免费注册账号，即刻获取专属初始额度。俯瞰全球品类动态，通过市场图谱实现循线追踪，解锁更清晰的出海决策力。
              </p>

              <form onSubmit={handleSubscribe} style={{
                display: 'flex',
                gap: '12px',
                maxWidth: '480px',
                margin: '0 auto',
                position: 'relative',
                zIndex: 5
              }}>
                <input 
                  type="email" 
                  required
                  value={emailInput}
                  onChange={(e) => setEmailInput(e.target.value)}
                  placeholder="输入您的业务邮箱" 
                  style={{
                    flex: 1,
                    padding: '16px 24px',
                    borderRadius: '0px',
                    background: 'var(--bg-main)',
                    border: '1px solid rgba(18, 18, 18, 0.15)',
                    color: 'var(--color-text)',
                    outline: 'none',
                    fontSize: '0.95rem',
                    fontWeight: 300,
                    transition: 'box-shadow 0.2s'
                  }}
                  onFocus={(e) => e.target.style.boxShadow = '0 0 0 2px var(--color-accent)'}
                  onBlur={(e) => e.target.style.boxShadow = 'none'}
                />
                <button 
                  type="submit"
                  className="sand-btn"
                  style={{
                    padding: '16px 36px',
                    fontSize: '0.95rem',
                    background: 'var(--color-accent)',
                    border: 'none',
                    color: '#ffffff',
                    borderRadius: '0px',
                    fontWeight: 500,
                    transition: 'all 0.2s',
                    cursor: 'pointer'
                  }}
                >
                  免费注册体验
                </button>
              </form>
            </div>
          )}

          {/* 极简安全与合规背书 */}
          <div style={{ 
            textAlign: 'center', 
            fontSize: '0.75rem', 
            color: 'var(--color-muted)', 
            padding: '15px 0', 
            borderTop: '1px solid rgba(160, 109, 68, 0.08)', 
            marginBottom: '20px', 
            opacity: 0.8 
          }}>
            🔒 <b>数据合规背书：</b> 本系统采用本地化 Docker 部署开源数据库，数据均保存在国内。页面底层自动铺设专属防盗数字水印及隐形安全盲水印，严防任何机密泄漏。
          </div>

          {/* 版刻 & 导航 Footer */}
          <footer style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            color: 'var(--color-muted)',
            fontSize: '0.85rem',
            paddingTop: '20px',
            borderTop: 'none',
            fontWeight: 300
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <MGLogo height={30} />
            </div>
            <div>
              &copy; {new Date().getFullYear()} MARKET GRAPHIC. All rights reserved.
            </div>
          </footer>
        </section>

      </div>


      {/* 登录/注册弹窗 */}
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

// SSR 获取初始解锁图谱数据
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

    // 获取最新 6 条资讯数据传给主页
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
