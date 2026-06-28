import { GetServerSideProps } from 'next';
import React, { useState, useEffect } from 'react';
import pool from '../lib/db';
import { parseCookies } from '../lib/cookies';
import { getUserGraph, GraphNode, GraphLink } from './api/user/graph';
import Link from 'next/link';
import dynamic from 'next/dynamic';
const AdminPanel = dynamic(() => import('../components/AdminPanel'), { ssr: false });
import ReportList, { PlatformReport } from '../components/ReportList';
import AuthModal from '../components/AuthModal';
import ThemeCustomizer from '../components/ThemeCustomizer';
import {
  GlobeIcon,
  GraphIcon,
  CrownIcon,
  UploadIcon,
  LogOutIcon,
  UserIcon,
  LockIcon,
  DollarIcon,
  TrendIcon,
  SearchIcon
} from '../components/Icons';

interface HomeProps {
  graphData: {
    nodes: GraphNode[];
    links: GraphLink[];
  };
  allReports: PlatformReport[];
  userId: string;
  userRole: string;
  freeQuota: number;
}

export default function HomePage({ graphData, allReports, userId, userRole, freeQuota }: HomeProps) {
  const [quota, setQuota] = useState(freeQuota);
  const [reports, setReports] = useState(allReports);
  const [emailInput, setEmailInput] = useState('');
  const [subscribed, setSubscribed] = useState(false);

  // 弹窗与控制面板状态
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [showUploadModal, setShowUploadModal] = useState(false);

  // 调色板定制状态
  const [accentColor, setAccentColor] = useState('#ff641e');
  const [bgSub, setBgSub] = useState('#f6f3ec');
  const [ambientOpacity, setAmbientOpacity] = useState(0.12);
  const [brandWeight, setBrandWeight] = useState<'standard' | 'vibrant'>('standard');
  const [showCustomizer, setShowCustomizer] = useState(false);

  // 实时同步 CSS 变量
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const root = document.documentElement;
      root.style.setProperty('--color-accent', accentColor);
      root.style.setProperty('--bg-sub', bgSub);
      root.style.setProperty('--ambient-opacity', String(ambientOpacity));
    }
  }, [accentColor, bgSub, ambientOpacity]);

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

  const scrollToInsights = () => {
    const el = document.getElementById('insights-library');
    if (el) {
      el.scrollIntoView({ behavior: 'smooth' });
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
        <div className="ambient-light ambient-light-2" />
        <div className="ambient-light ambient-light-3" />
      </div>

      {/* 头部导航栏 - 浮空漂浮样式 */}
      <div style={{ padding: '20px 40px 10px 40px', position: 'sticky', top: 0, zIndex: 1000 }}>
        <header style={{
          background: 'rgba(253, 251, 247, 0.75)',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          padding: '12px 30px',
          borderRadius: 'var(--border-radius)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          boxShadow: '0 10px 40px rgba(160, 109, 68, 0.02)',
          maxWidth: '1400px',
          margin: '0 auto',
          width: '100%'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <GlobeIcon size={18} stroke="var(--color-accent)" />
            <span style={{
              fontSize: '1.25rem',
              fontWeight: 400,
              color: 'var(--color-text)',
              letterSpacing: '-0.5px'
            }}>
              Globaltradebuddy
            </span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '24px', fontSize: '0.85rem' }}>
            <Link 
              href="/my-graph" 
              className="sand-btn"
              style={{
                textDecoration: 'none',
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
              }}
            >
              <GraphIcon size={14} />
              个人知识拓扑网图
            </Link>
            {userId ? (
              <>
                {userRole === 'admin' ? (
                  <>
                    <span style={{ color: 'var(--color-muted)', fontWeight: 300, display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <CrownIcon size={14} />
                      管理员: <code style={{ color: 'var(--color-accent)', fontWeight: 400 }}>{userId.substring(0, 8)}...</code>
                    </span>
                    <button 
                      onClick={() => setShowUploadModal(true)}
                      className="sand-btn"
                      style={{
                        color: 'var(--color-accent)',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px'
                      }}
                    >
                      <UploadIcon size={14} />
                      上传新报告
                    </button>
                  </>
                ) : (
                  <>
                    <span style={{ color: 'var(--color-muted)', fontWeight: 300 }}>
                      业务员 ID: <code style={{ color: 'var(--color-accent)', fontWeight: 400 }}>{userId.substring(0, 8)}...</code>
                    </span>
                    <span style={{
                      background: 'var(--bg-sub)',
                      padding: '6px 14px',
                      borderRadius: '20px',
                      color: 'var(--color-text)',
                      fontWeight: 300,
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px'
                    }}>
                      <LockIcon size={14} />
                      剩余额度: <b style={{ color: 'var(--color-accent)', fontWeight: 500 }}>{quota}</b> 次
                    </span>
                  </>
                )}
                <button 
                  onClick={handleLogout}
                  className="sand-btn"
                  style={{
                    color: '#ef4444',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px'
                  }}
                >
                  <LogOutIcon size={14} />
                  退出登录
                </button>
              </>
            ) : (
              <>
                <span style={{ color: 'var(--color-muted)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <UserIcon size={14} />
                  游客模式
                </span>
                <button 
                  onClick={() => {
                    setShowAuthModal(true);
                  }}
                  className="sand-btn"
                  style={{
                    color: 'var(--color-accent)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px'
                  }}
                >
                  <LockIcon size={14} />
                  登录 / 注册
                </button>
              </>
            )}
          </div>
        </header>
      </div>

      {/* 滚动大容器 */}
      <div style={{ position: 'relative', zIndex: 10 }}>
        
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
          borderRadius: brandWeight === 'vibrant' ? '32px' : '0px',
          boxShadow: brandWeight === 'vibrant' ? '0 20px 50px rgba(255, 100, 30, 0.15)' : 'none',
          transition: 'all 0.5s ease-in-out'
        }}>
          {/* 外贸元素悬浮浮动卡片 */}
          <div className="floating-card floating-card-1 float-on-hover" style={{ display: 'flex' }}>
            <GlobeIcon size={20} stroke="var(--color-accent)" style={{ flexShrink: 0 }} />
            <div style={{ textAlign: 'left' }}>
              <div style={{ fontSize: '0.75rem', color: 'var(--color-muted)', fontWeight: 300 }}>全球商机</div>
              <div style={{ fontSize: '0.8rem', fontWeight: 500, color: '#10b981' }}>实时监控中</div>
            </div>
          </div>
          <div className="floating-card floating-card-2 float-on-hover" style={{ display: 'flex' }}>
            <DollarIcon size={20} stroke="var(--color-accent)" style={{ flexShrink: 0 }} />
            <div style={{ textAlign: 'left' }}>
              <div style={{ fontSize: '0.75rem', color: 'var(--color-muted)', fontWeight: 300 }}>结汇汇率</div>
              <div style={{ fontSize: '0.8rem', fontWeight: 500, color: 'var(--color-text)' }}>CNY 7.24</div>
            </div>
          </div>
          <div className="floating-card floating-card-3 float-on-hover" style={{ display: 'flex' }}>
            <TrendIcon size={20} stroke="var(--color-accent)" style={{ flexShrink: 0 }} />
            <div style={{ textAlign: 'left' }}>
              <div style={{ fontSize: '0.75rem', color: 'var(--color-muted)', fontWeight: 300 }}>前沿报告</div>
              <div style={{ fontSize: '0.8rem', fontWeight: 500, color: 'var(--color-accent)' }}>已收录 {allReports.length} 份</div>
            </div>
          </div>
          <div className="floating-card floating-card-4 float-on-hover" style={{ display: 'flex' }}>
            <SearchIcon size={20} stroke="var(--color-accent)" style={{ flexShrink: 0 }} />
            <div style={{ textAlign: 'left' }}>
              <div style={{ fontSize: '0.75rem', color: 'var(--color-muted)', fontWeight: 300 }}>海关检索</div>
              <div style={{ fontSize: '0.8rem', fontWeight: 500, color: '#b45309' }}>HS: 8708.70</div>
            </div>
          </div>

          <div style={{ maxWidth: '800px', zIndex: 5 }}>
            <span style={{
              background: brandWeight === 'vibrant' ? 'rgba(255, 255, 255, 0.18)' : 'rgba(255, 100, 30, 0.05)',
              padding: '6px 16px',
              borderRadius: '20px',
              color: brandWeight === 'vibrant' ? '#ffffff' : 'var(--color-accent)',
              fontSize: '0.85rem',
              fontWeight: brandWeight === 'vibrant' ? 400 : 300,
              textTransform: 'uppercase',
              letterSpacing: '1.5px',
              display: 'inline-block',
              marginBottom: '24px'
            }}>
              您的全智能出海展业伴侣
            </span>
            <h2 className="font-editorial" style={{
              fontSize: '4.2rem',
              fontWeight: 400,
              lineHeight: 1.15,
              margin: '0 0 24px 0',
              color: brandWeight === 'vibrant' ? '#ffffff' : 'var(--color-text)',
              letterSpacing: '-0.02em'
            }}>
              Your home for trade insights,<br />predictions, and tools.
            </h2>
            <p style={{
              fontSize: '1.25rem',
              color: brandWeight === 'vibrant' ? 'rgba(255, 255, 255, 0.85)' : 'var(--color-muted)',
              lineHeight: 1.6,
              maxWidth: '620px',
              margin: '0 auto 36px auto',
              fontWeight: 300
            }}>
              集成海量采购商机与买家画像报告。汇聚结汇计算、HS通关、全球时区窗口，为外贸精英全面赋能。
            </p>
            <button 
              onClick={scrollToInsights}
              className="sand-btn accent-glow"
              style={{
                padding: '16px 40px',
                fontSize: '1rem',
                background: brandWeight === 'vibrant' ? '#ffffff' : 'var(--bg-sub)',
                color: 'var(--color-accent)',
                boxShadow: brandWeight === 'vibrant' ? '0 10px 25px rgba(0,0,0,0.08)' : 'none'
              }}
            >
              探索洞察报告库
            </button>
          </div>
        </section>

        {/* 模块三：报告市场发现大厅 */}
        <section id="insights-library" className="animate-on-scroll" style={{
          padding: '60px 40px',
          maxWidth: '1400px',
          margin: '0 auto 60px auto',
          background: 'rgba(246, 243, 236, 0.55)',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          borderRadius: '32px',
          boxShadow: '0 12px 40px rgba(160, 109, 68, 0.03)',
          border: '1px solid rgba(255, 100, 30, 0.03)'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '50px', flexWrap: 'wrap', gap: '20px' }}>
            <div>
              <h2 className="font-editorial" style={{
                fontSize: '2.8rem',
                fontWeight: 400,
                margin: '0 0 16px 0',
                color: 'var(--color-text)',
                letterSpacing: '-0.015em'
              }}>
                Discover, Unlock & Connect.
              </h2>
              <p style={{ fontSize: '1.05rem', color: 'var(--color-muted)', margin: 0, fontWeight: 300 }}>
                探索大厅发布了 <b style={{ color: 'var(--color-text)', fontWeight: 500 }}>{reports.length}</b> 份最具潜力的跨国采购品类与买家画像报告。
              </p>
            </div>
            
            <div style={{
              background: 'var(--bg-main)',
              border: '1px solid rgba(160, 109, 68, 0.05)',
              padding: '12px 24px',
              borderRadius: '16px',
              display: 'flex',
              flexDirection: 'column',
              gap: '4px',
              boxShadow: '0 4px 12px rgba(160, 109, 68, 0.02)'
            }}>
              <span style={{ fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '1px', color: 'var(--color-muted)' }}>数据中心状况</span>
              <span style={{ fontSize: '0.9rem', fontWeight: 500, color: '#10b981', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ width: '8px', height: '8px', background: '#10b981', borderRadius: '50%', display: 'inline-block' }} />
                实时数据同步正常
              </span>
            </div>
          </div>

          <ReportList
            reports={reports}
            userId={userId}
            userRole={userRole}
            quota={quota}
            onUnlockSuccess={(newQuota, unlockedReportId) => {
              setQuota(newQuota);
              setReports(prev => prev.map(r => r.id === unlockedReportId ? { ...r, isUnlocked: true } : r));
            }}
          />
        </section>

        {/* 水平轻柔分割线 */}
        <div style={{
          width: '100%',
          maxWidth: '1400px',
          borderTop: '1px solid rgba(160, 109, 68, 0.08)',
          margin: '40px auto 20px auto'
        }} />

        {/* 模块四：安全保障与个人拓扑 */}
        <section className="animate-on-scroll" style={{
          padding: '80px 40px',
          maxWidth: '1400px',
          margin: '0 auto',
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))',
          gap: '60px',
          alignItems: 'center',
          position: 'relative'
        }}>
          <div>
            <span style={{
              background: 'rgba(255, 100, 30, 0.05)',
              padding: '6px 16px',
              borderRadius: '20px',
              color: 'var(--color-accent)',
              fontSize: '0.85rem',
              fontWeight: 300,
              textTransform: 'uppercase',
              letterSpacing: '1px',
              display: 'inline-block',
              marginBottom: '20px'
            }}>
              出海合规与安全防线
            </span>
            <h2 className="font-editorial" style={{
              fontSize: '3rem',
              fontWeight: 400,
              margin: '0 0 24px 0',
              color: 'var(--color-text)',
              letterSpacing: '-0.02em',
              lineHeight: 1.2
            }}>
              Controlled by you,<br />secured by us.
            </h2>
            <p style={{ fontSize: '1.1rem', color: 'var(--color-muted)', lineHeight: 1.7, margin: 0, fontWeight: 300, maxWidth: '480px' }}>
              我们致力于构建最智能的数据隔离防火墙与隐私脱水管道，全力呵护您的核心买家商机与供应商脉络，规避数据二次泄露风险。
            </p>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            {/* 特色 1 */}
            <div className="float-on-hover" style={{
              background: 'var(--bg-sub)',
              borderRadius: 'var(--border-radius)',
              padding: '24px 30px',
              display: 'flex',
              gap: '20px',
              alignItems: 'flex-start',
              boxShadow: '0 6px 20px rgba(160, 109, 68, 0.015)'
            }}>
              <div style={{
                background: 'var(--bg-main)',
                padding: '12px',
                borderRadius: '12px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0
              }}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--color-accent)" strokeWidth="1.1" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M4.5 16.5c-1.5 1.26-2.5 3.19-2.5 5.5h20c0-2.31-1-4.24-2.5-5.5" />
                  <circle cx="12" cy="12" r="2" />
                  <circle cx="12" cy="2" r="1" />
                  <circle cx="4" cy="16" r="1" />
                  <circle cx="20" cy="16" r="1" />
                </svg>
              </div>
              <div>
                <h3 style={{ fontSize: '1.1rem', fontWeight: 500, margin: '0 0 8px 0', color: 'var(--color-text)' }}>
                  个人专属知识拓扑
                </h3>
                <p style={{ fontSize: '0.85rem', color: 'var(--color-muted)', lineHeight: 1.6, margin: 0, fontWeight: 300 }}>
                  独创的 3D 星空网状图谱，根据您解锁的每一份国家级、品类级洞察建立深度知识链。连线高亮与节点互动助您一眼发掘隐藏的商机。
                </p>
              </div>
            </div>

            {/* 特色 2 */}
            <div className="float-on-hover" style={{
              background: 'var(--bg-sub)',
              borderRadius: 'var(--border-radius)',
              padding: '24px 30px',
              display: 'flex',
              gap: '20px',
              alignItems: 'flex-start',
              boxShadow: '0 6px 20px rgba(160, 109, 68, 0.015)'
            }}>
              <div style={{
                background: 'var(--bg-main)',
                padding: '12px',
                borderRadius: '12px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0
              }}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--color-accent)" strokeWidth="1.1" strokeLinecap="round" strokeLinejoin="round">
                  <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />
                </svg>
              </div>
              <div>
                <h3 style={{ fontSize: '1.1rem', fontWeight: 500, margin: '0 0 8px 0', color: 'var(--color-text)' }}>
                  脱水上传管道技术
                </h3>
                <p style={{ fontSize: '0.85rem', color: 'var(--color-muted)', lineHeight: 1.6, margin: 0, fontWeight: 300 }}>
                  行业领先的智能处理核心。提取 PDF/Doc 文件并全自动“脱水”，自动滤除敏感数据，对结构进行去标识 Base64 化转码，规避合规风险。
                </p>
              </div>
            </div>

            {/* 特色 3 */}
            <div className="float-on-hover" style={{
              background: 'var(--bg-sub)',
              borderRadius: 'var(--border-radius)',
              padding: '24px 30px',
              display: 'flex',
              gap: '20px',
              alignItems: 'flex-start',
              boxShadow: '0 6px 20px rgba(160, 109, 68, 0.015)'
            }}>
              <div style={{
                background: 'var(--bg-main)',
                padding: '12px',
                borderRadius: '12px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0
              }}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--color-accent)" strokeWidth="1.1" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                </svg>
              </div>
              <div>
                <h3 style={{ fontSize: '1.1rem', fontWeight: 500, margin: '0 0 8px 0', color: 'var(--color-text)' }}>
                  动态微光防盗水印
                </h3>
                <p style={{ fontSize: '0.85rem', color: 'var(--color-muted)', lineHeight: 1.6, margin: 0, fontWeight: 300 }}>
                  专为防止机密外泄设计。用户专属业务员 ID 在报告底层以 0.015 极弱光动态旋转水印展现，结合高斯模糊付费锁，强力保护核心情报不被分发盗用。
                </p>
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
          <div style={{
            background: brandWeight === 'vibrant' ? 'linear-gradient(135deg, var(--color-accent) 0%, #ff884d 100%)' : 'var(--bg-sub)',
            borderRadius: 'var(--border-radius)',
            padding: '80px 40px',
            textAlign: 'center',
            position: 'relative',
            overflow: 'hidden',
            marginBottom: '80px',
            boxShadow: brandWeight === 'vibrant' ? '0 20px 50px rgba(255, 100, 30, 0.15)' : '0 6px 20px rgba(160, 109, 68, 0.01)'
          }}>
            <h2 className={brandWeight === 'vibrant' ? "" : "font-editorial"} style={{
              fontSize: '2.6rem',
              fontWeight: brandWeight === 'vibrant' ? 400 : 300,
              margin: '0 0 16px 0',
              color: brandWeight === 'vibrant' ? '#ffffff' : 'var(--color-text)',
              letterSpacing: '-1px'
            }}>
              Get started.<br />Subscribe to Globaltradebuddy.
            </h2>
            <p style={{ fontSize: '1.05rem', color: brandWeight === 'vibrant' ? 'rgba(255, 255, 255, 0.85)' : 'var(--color-muted)', maxWidth: '480px', margin: '0 auto 36px auto', fontWeight: 300 }}>
              第一时间接收最新的市场洞察更新与全球宏观贸易数据。
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
                placeholder="Enter your email" 
                style={{
                  flex: 1,
                  padding: '16px 24px',
                  borderRadius: '30px',
                  background: 'var(--bg-main)',
                  border: 'none',
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
                  background: brandWeight === 'vibrant' ? '#ffffff' : 'var(--bg-sub)',
                  color: 'var(--color-accent)',
                  boxShadow: brandWeight === 'vibrant' ? '0 4px 12px rgba(0,0,0,0.08)' : 'none'
                }}
              >
                Submit
              </button>
            </form>

            {subscribed && (
              <div style={{ marginTop: '16px', color: 'var(--color-accent)', fontWeight: 500, fontSize: '0.95rem' }}>
                订阅成功！感谢您的关注。
              </div>
            )}
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
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" />
                <line x1="2" y1="12" x2="22" y2="12" />
                <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
              </svg>
              <span style={{ fontWeight: 500, color: 'var(--color-text)' }}>Globaltradebuddy</span>
            </div>
            <div>
              &copy; {new Date().getFullYear()} Globaltradebuddy. All rights reserved.
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

      {/* 浮动调色定制器入口 */}
      <button
        onClick={() => setShowCustomizer(!showCustomizer)}
        className="accent-glow animate-pulse"
        style={{
          position: 'fixed',
          bottom: '30px',
          right: '30px',
          zIndex: 1050,
          width: '56px',
          height: '56px',
          borderRadius: '50%',
          background: 'var(--color-accent)',
          border: 'none',
          cursor: 'pointer',
          boxShadow: '0 8px 32px rgba(255, 100, 30, 0.3)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#ffffff',
          transition: 'all 0.3s cubic-bezier(0.25, 1, 0.22, 1)'
        }}
        aria-label="打开调色板"
      >
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 22C17.5228 22 22 17.5228 22 12C22 6.47715 17.5228 2 12 2C6.47715 2 2 6.47715 2 12C2 14.7255 3.09032 17.1962 4.85857 19C5.34484 19.4863 5.34484 20.2753 4.85857 20.7616L4.70711 20.913C4.31658 21.3035 4.31658 21.9367 4.70711 22.3272C5.09763 22.7177 5.7308 22.7177 6.12132 22.3272L6.27278 22.1757C6.75905 21.6895 7.54807 21.6895 8.03434 22.1757C9.2384 22.7153 10.5843 23 12 23" />
          <circle cx="7.5" cy="10.5" r="1.5" fill="currentColor" />
          <circle cx="11.5" cy="7.5" r="1.5" fill="currentColor" />
          <circle cx="16.5" cy="9.5" r="1.5" fill="currentColor" />
          <circle cx="15.5" cy="14.5" r="1.5" fill="currentColor" />
        </svg>
      </button>

      <ThemeCustomizer 
        isOpen={showCustomizer}
        onClose={() => setShowCustomizer(false)}
        accentColor={accentColor}
        setAccentColor={setAccentColor}
        bgSub={bgSub}
        setBgSub={setBgSub}
        ambientOpacity={ambientOpacity}
        setAmbientOpacity={setAmbientOpacity}
        brandWeight={brandWeight}
        setBrandWeight={setBrandWeight}
      />
    </div>
  );
}

// SSR 获取初始解锁图谱数据
export const getServerSideProps: GetServerSideProps = async (context) => {
  const cookies = parseCookies(context.req.headers.cookie);
  const cookieUserId = cookies.user_id;
  
  const dbClient = await pool.connect();

  try {
    let userId: string | null = null;
    let userRole = 'guest';
    let freeQuota = 0;

    if (cookieUserId) {
      const userRes = await dbClient.query('SELECT id, role, free_quota FROM users WHERE id = $1', [cookieUserId]);
      if (userRes.rows.length > 0) {
        userId = userRes.rows[0].id;
        userRole = userRes.rows[0].role;
        freeQuota = userRes.rows[0].free_quota;
      }
    }

    let graphData: any = { nodes: [], links: [] };
    let allReports: any[] = [];

    if (userId) {
      if (userRole === 'admin') {
        const reportsRes = await dbClient.query(`SELECT id, title, category, market_region, summary FROM reports`);
        const nodes = reportsRes.rows;
        const reportIds = nodes.map(n => n.id);
        
        let links = [];
        if (reportIds.length > 0) {
          const relationsRes = await dbClient.query(
            `SELECT report_id_a AS source, report_id_b AS target, relation_key 
             FROM relations 
             WHERE report_id_a = ANY($1) AND report_id_b = ANY($1)`,
            [reportIds]
          );
          links = relationsRes.rows;
        }
        graphData = { nodes, links };
        
        allReports = reportsRes.rows.map(row => ({
          id: row.id,
          title: row.title,
          category: row.category,
          market_region: row.market_region,
          summary: row.summary,
          isUnlocked: true
        }));
      } else {
        graphData = await getUserGraph(userId, dbClient);
        
        const reportsRes = await dbClient.query(`
          SELECT r.id, r.title, r.category, r.market_region, r.summary,
                 EXISTS(SELECT 1 FROM unlocks u WHERE u.user_id = $1 AND u.report_id = r.id) as is_unlocked
          FROM reports r
          ORDER BY r.created_at DESC
          LIMIT 30
        `, [userId]);
        
        allReports = reportsRes.rows.map(row => ({
          id: row.id,
          title: row.title,
          category: row.category,
          market_region: row.market_region,
          summary: row.summary,
          isUnlocked: row.is_unlocked
        }));
      }
    } else {
      const reportsRes = await dbClient.query(`
        SELECT id, title, category, market_region, summary FROM reports ORDER BY created_at DESC LIMIT 30
      `);
      allReports = reportsRes.rows.map(row => ({
        id: row.id,
        title: row.title,
        category: row.category,
        market_region: row.market_region,
        summary: row.summary,
        isUnlocked: false
      }));
    }

    context.res.setHeader('Cache-Control', 'public, s-maxage=60, stale-while-revalidate=120');

    return {
      props: {
        graphData,
        allReports,
        userId: userId || '',
        userRole,
        freeQuota
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
        freeQuota: 0
      }
    };
  } finally {
    dbClient.release();
  }
};
