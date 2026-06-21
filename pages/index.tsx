import { GetServerSideProps } from 'next';
import React, { useState, useEffect } from 'react';
import pool from '../lib/db';
import { parseCookies } from '../lib/cookies';
import { getUserGraph, GraphNode, GraphLink } from './api/user/graph';
import Link from 'next/link';
import AdminPanel from '../components/AdminPanel';
import ReportList, { PlatformReport } from '../components/ReportList';

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

  // 登录/注册/退出/上传弹窗状态
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [authMode, setAuthMode] = useState<'login' | 'signup'>('login');
  
  // 登录/注册表单输入
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<'user' | 'admin'>('user');
  const [errorMsg, setErrorMsg] = useState('');
  
  // 管理员上传报告弹窗状态
  const [showUploadModal, setShowUploadModal] = useState(false);

  const inputStyle = {
    background: 'var(--bg-main)',
    border: 'none',
    borderRadius: '12px',
    padding: '12px 16px',
    fontSize: '0.85rem',
    color: 'var(--color-text)',
    outline: 'none',
    width: '100%',
    transition: 'box-shadow 0.3s ease',
    boxSizing: 'border-box' as const
  };

  const handleAuthSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    try {
      const endpoint = authMode === 'login' ? '/api/auth/login' : '/api/auth/signup';
      const body = authMode === 'login' 
        ? { phoneOrEmail: phone || email, password }
        : { phone, email, password, role };

      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      const data = await res.json();
      if (res.ok && data.success) {
        document.cookie = `user_id=${data.user.id}; path=/; max-age=604800`;
        document.cookie = `user_role=${data.user.role}; path=/; max-age=604800`;
        window.location.reload();
      } else {
        setErrorMsg(data.error || '认证失败，请重试');
      }
    } catch (err) {
      setErrorMsg('连接服务器失败');
    }
  };

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
      background: 'var(--bg-main)',
      color: 'var(--color-text)',
      minHeight: '100vh',
      fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, sans-serif',
      position: 'relative',
      overflowX: 'hidden'
    }}>
      {/* 头部导航栏 - 浮空漂浮样式 */}
      <div style={{ padding: '20px 40px 10px 40px', position: 'sticky', top: 0, zIndex: 100 }}>
        <header style={{
          background: 'rgba(246, 243, 236, 0.8)',
          backdropFilter: 'blur(24px)',
          WebkitBackdropFilter: 'blur(24px)',
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
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--color-accent)" strokeWidth="1.1" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" />
              <line x1="2" y1="12" x2="22" y2="12" />
              <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
            </svg>
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
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" strokeLinejoin="round">
                <path d="M4.5 16.5c-1.5 1.26-2.5 3.19-2.5 5.5h20c0-2.31-1-4.24-2.5-5.5" />
                <circle cx="12" cy="12" r="2" />
                <circle cx="12" cy="2" r="1" />
                <circle cx="4" cy="16" r="1" />
                <circle cx="20" cy="16" r="1" />
              </svg>
              个人知识拓扑网图
            </Link>
            {userId ? (
              <>
                {userRole === 'admin' ? (
                  <>
                    <span style={{ color: 'var(--color-muted)', fontWeight: 300, display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M2 4l3 12h14l3-12-6 7-4-7-4 7-6-7z" />
                        <path d="M3 20h18" />
                      </svg>
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
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                        <polyline points="17 8 12 3 7 8" />
                        <line x1="12" y1="3" x2="12" y2="15" />
                      </svg>
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
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" strokeLinejoin="round">
                        <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                        <path d="M7 11V7a5 5 0 0 1 9.9-1" />
                      </svg>
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
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                    <polyline points="16 17 21 12 16 7" />
                    <line x1="21" y1="12" x2="9" y2="12" />
                  </svg>
                  退出登录
                </button>
              </>
            ) : (
              <>
                <span style={{ color: 'var(--color-muted)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                    <circle cx="12" cy="7" r="4" />
                  </svg>
                  游客模式
                </span>
                <button 
                  onClick={() => {
                    setAuthMode('login');
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
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                    <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                  </svg>
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
          padding: '40px 20px',
          position: 'relative',
          maxWidth: '1200px',
          margin: '0 auto'
        }}>
          {/* 外贸元素悬浮浮动卡片 */}
          <div className="floating-card floating-card-1" style={{ display: 'flex' }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--color-accent)" strokeWidth="1.1" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
              <circle cx="12" cy="12" r="10" />
              <line x1="2" y1="12" x2="22" y2="12" />
              <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
            </svg>
            <div style={{ textAlign: 'left' }}>
              <div style={{ fontSize: '0.75rem', color: 'var(--color-muted)', fontWeight: 300 }}>全球商机</div>
              <div style={{ fontSize: '0.8rem', fontWeight: 500, color: '#10b981' }}>实时监控中</div>
            </div>
          </div>
          <div className="floating-card floating-card-2" style={{ display: 'flex' }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--color-accent)" strokeWidth="1.1" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
              <circle cx="12" cy="12" r="10" />
              <path d="M12 6v12M15 9H10a2 2 0 0 0 0 4h4a2 2 0 0 1 0 4H9" />
            </svg>
            <div style={{ textAlign: 'left' }}>
              <div style={{ fontSize: '0.75rem', color: 'var(--color-muted)', fontWeight: 300 }}>结汇汇率</div>
              <div style={{ fontSize: '0.8rem', fontWeight: 500, color: 'var(--color-text)' }}>CNY 7.24</div>
            </div>
          </div>
          <div className="floating-card floating-card-3" style={{ display: 'flex' }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--color-accent)" strokeWidth="1.1" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
              <path d="M3 3v18h18" />
              <path d="M18.7 8l-5.1 5.2-2.8-2.7L7 14.3" />
            </svg>
            <div style={{ textAlign: 'left' }}>
              <div style={{ fontSize: '0.75rem', color: 'var(--color-muted)', fontWeight: 300 }}>前沿报告</div>
              <div style={{ fontSize: '0.8rem', fontWeight: 500, color: 'var(--color-accent)' }}>已收录 {allReports.length} 份</div>
            </div>
          </div>
          <div className="floating-card floating-card-4" style={{ display: 'flex' }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--color-accent)" strokeWidth="1.1" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            <div style={{ textAlign: 'left' }}>
              <div style={{ fontSize: '0.75rem', color: 'var(--color-muted)', fontWeight: 300 }}>海关检索</div>
              <div style={{ fontSize: '0.8rem', fontWeight: 500, color: '#b45309' }}>HS: 8708.70</div>
            </div>
          </div>

          <div style={{ maxWidth: '800px', zIndex: 5 }}>
            <span style={{
              background: 'rgba(255, 100, 30, 0.05)',
              padding: '6px 16px',
              borderRadius: '20px',
              color: 'var(--color-accent)',
              fontSize: '0.85rem',
              fontWeight: 300,
              textTransform: 'uppercase',
              letterSpacing: '1.5px',
              display: 'inline-block',
              marginBottom: '24px'
            }}>
              您的全智能出海展业伴侣
            </span>
            <h2 style={{
              fontSize: '3.6rem',
              fontWeight: 300,
              lineHeight: 1.15,
              margin: '0 0 24px 0',
              color: 'var(--color-text)',
              letterSpacing: '-2px'
            }}>
              Your home for trade insights,<br />predictions, and tools.
            </h2>
            <p style={{
              fontSize: '1.25rem',
              color: 'var(--color-muted)',
              lineHeight: 1.6,
              maxWidth: '620px',
              margin: '0 auto 36px auto',
              fontWeight: 300
            }}>
              集成海量采购商机与买家画像报告。汇聚结汇计算、HS通关、全球时区窗口，为外贸精英全面赋能。
            </p>
            <button 
              onClick={scrollToInsights}
              className="sand-btn"
              style={{
                padding: '16px 40px',
                fontSize: '1rem'
              }}
            >
              探索洞察报告库
            </button>
          </div>
        </section>

        {/* 模块三：报告市场发现大厅 */}
        <section id="insights-library" className="animate-on-scroll" style={{
          padding: '100px 40px',
          maxWidth: '1440px',
          margin: '0 auto'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '50px' }}>
            <div>
              <h2 style={{
                fontSize: '2.4rem',
                fontWeight: 300,
                margin: '0 0 16px 0',
                color: 'var(--color-text)',
                letterSpacing: '-1px'
              }}>
                Discover, Unlock & Connect.
              </h2>
              <p style={{ fontSize: '1.05rem', color: 'var(--color-muted)', margin: 0, fontWeight: 300 }}>
                探索大厅发布了 <b style={{ color: 'var(--color-text)', fontWeight: 500 }}>{reports.length}</b> 份最具潜力的跨国采购品类与买家画像报告。
              </p>
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

        {/* 模块四：安全保障与个人拓扑 */}
        <section className="animate-on-scroll" style={{
          padding: '100px 40px',
          maxWidth: '1440px',
          margin: '0 auto',
          position: 'relative'
        }}>
          <div style={{ textAlign: 'center', marginBottom: '60px' }}>
            <h2 style={{
              fontSize: '2.4rem',
              fontWeight: 300,
              margin: '0 0 16px 0',
              color: 'var(--color-text)',
              letterSpacing: '-1px'
            }}>
              Controlled by you, secured by us.
            </h2>
            <p style={{ fontSize: '1.05rem', color: 'var(--color-muted)', maxWidth: '550px', margin: '0 auto', fontWeight: 300 }}>
              构建最智能的数据隔离防火墙，全力呵护您的商机脉络不受二次流失。
            </p>
          </div>

          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
            gap: '24px'
          }}>
            {/* 特色 1 */}
            <div style={{
              background: 'var(--bg-sub)',
              border: 'none',
              borderRadius: 'var(--border-radius)',
              padding: '36px',
              transition: 'all 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
              boxShadow: '0 6px 20px rgba(160, 109, 68, 0.015)'
            }}
            onMouseOver={(e) => {
              e.currentTarget.style.background = 'var(--bg-main)';
              e.currentTarget.style.transform = 'translateY(-4px)';
              e.currentTarget.style.boxShadow = '0 12px 30px rgba(160, 109, 68, 0.04)';
            }}
            onMouseOut={(e) => {
              e.currentTarget.style.background = 'var(--bg-sub)';
              e.currentTarget.style.transform = 'none';
              e.currentTarget.style.boxShadow = '0 6px 20px rgba(160, 109, 68, 0.015)';
            }}
            >
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="var(--color-accent)" strokeWidth="1.1" strokeLinecap="round" strokeLinejoin="round" style={{ marginBottom: '20px' }}>
                <path d="M4.5 16.5c-1.5 1.26-2.5 3.19-2.5 5.5h20c0-2.31-1-4.24-2.5-5.5" />
                <circle cx="12" cy="12" r="2" />
                <circle cx="12" cy="2" r="1" />
                <circle cx="4" cy="16" r="1" />
                <circle cx="20" cy="16" r="1" />
              </svg>
              <h3 style={{ fontSize: '1.15rem', fontWeight: 500, margin: '0 0 12px 0', color: 'var(--color-text)' }}>
                个人专属知识拓扑
              </h3>
              <p style={{ fontSize: '0.9rem', color: 'var(--color-muted)', lineHeight: 1.6, margin: 0, fontWeight: 300 }}>
                独创 of 3D 星空网状图谱，根据您解锁的每一份国家级、品类级洞察建立深度知识链。连线高亮与节点互动助您一眼发掘隐藏的商机。
              </p>
            </div>

            {/* 特色 2 */}
            <div style={{
              background: 'var(--bg-sub)',
              border: 'none',
              borderRadius: 'var(--border-radius)',
              padding: '36px',
              transition: 'all 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
              boxShadow: '0 6px 20px rgba(160, 109, 68, 0.015)'
            }}
            onMouseOver={(e) => {
              e.currentTarget.style.background = 'var(--bg-main)';
              e.currentTarget.style.transform = 'translateY(-4px)';
              e.currentTarget.style.boxShadow = '0 12px 30px rgba(160, 109, 68, 0.04)';
            }}
            onMouseOut={(e) => {
              e.currentTarget.style.background = 'var(--bg-sub)';
              e.currentTarget.style.transform = 'none';
              e.currentTarget.style.boxShadow = '0 6px 20px rgba(160, 109, 68, 0.015)';
            }}
            >
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="var(--color-accent)" strokeWidth="1.1" strokeLinecap="round" strokeLinejoin="round" style={{ marginBottom: '20px' }}>
                <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />
              </svg>
              <h3 style={{ fontSize: '1.15rem', fontWeight: 500, margin: '0 0 12px 0', color: 'var(--color-text)' }}>
                脱水上传管道技术
              </h3>
              <p style={{ fontSize: '0.9rem', color: 'var(--color-muted)', lineHeight: 1.6, margin: 0, fontWeight: 300 }}>
                行业领先的智能处理核心。提取 PDF/Doc 文件并全自动“脱水”，自动滤除敏感数据，对结构进行去标识 Base64 化转码，规避合规风险。
              </p>
            </div>

            {/* 特色 3 */}
            <div style={{
              background: 'var(--bg-sub)',
              border: 'none',
              borderRadius: 'var(--border-radius)',
              padding: '36px',
              transition: 'all 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
              boxShadow: '0 6px 20px rgba(160, 109, 68, 0.015)'
            }}
            onMouseOver={(e) => {
              e.currentTarget.style.background = 'var(--bg-main)';
              e.currentTarget.style.transform = 'translateY(-4px)';
              e.currentTarget.style.boxShadow = '0 12px 30px rgba(160, 109, 68, 0.04)';
            }}
            onMouseOut={(e) => {
              e.currentTarget.style.background = 'var(--bg-sub)';
              e.currentTarget.style.transform = 'none';
              e.currentTarget.style.boxShadow = '0 6px 20px rgba(160, 109, 68, 0.015)';
            }}
            >
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="var(--color-accent)" strokeWidth="1.1" strokeLinecap="round" strokeLinejoin="round" style={{ marginBottom: '20px' }}>
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
              </svg>
              <h3 style={{ fontSize: '1.15rem', fontWeight: 500, margin: '0 0 12px 0', color: 'var(--color-text)' }}>
                动态微光防盗水印
              </h3>
              <p style={{ fontSize: '0.9rem', color: 'var(--color-muted)', lineHeight: 1.6, margin: 0, fontWeight: 300 }}>
                专为防止机密外泄设计。用户专属业务员 ID 在报告底层以 0.015 极弱光动态旋转水印展现，结合高斯模糊付费锁，强力保护核心情报不被分发盗用。
              </p>
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
            background: 'var(--bg-sub)',
            borderRadius: 'var(--border-radius)',
            padding: '80px 40px',
            textAlign: 'center',
            position: 'relative',
            overflow: 'hidden',
            marginBottom: '80px',
            boxShadow: '0 6px 20px rgba(160, 109, 68, 0.01)'
          }}>
            <h2 style={{
              fontSize: '2.6rem',
              fontWeight: 300,
              margin: '0 0 16px 0',
              color: 'var(--color-text)',
              letterSpacing: '-1px'
            }}>
              Get started.<br />Subscribe to Globaltradebuddy.
            </h2>
            <p style={{ fontSize: '1.05rem', color: 'var(--color-muted)', maxWidth: '480px', margin: '0 auto 36px auto', fontWeight: 300 }}>
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
                  fontSize: '0.95rem'
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
      {showAuthModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(15, 23, 42, 0.15)',
          backdropFilter: 'blur(16px)',
          WebkitBackdropFilter: 'blur(16px)',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          zIndex: 1000
        }}>
          <div style={{
            background: 'var(--bg-sub)',
            border: 'none',
            borderRadius: 'var(--border-radius)',
            padding: '40px 30px',
            width: '90%',
            maxWidth: '420px',
            boxShadow: '0 20px 40px rgba(160, 109, 68, 0.05)',
            position: 'relative'
          }}>
            <button 
              onClick={() => setShowAuthModal(false)}
              style={{
                position: 'absolute',
                top: '20px',
                right: '20px',
                background: 'none',
                border: 'none',
                fontSize: '1.25rem',
                cursor: 'pointer',
                color: 'var(--color-muted)'
              }}
            >
              ✕
            </button>
            <h2 style={{ fontSize: '1.5rem', fontWeight: 300, marginBottom: '24px', textAlign: 'center', color: 'var(--color-text)' }}>
              {authMode === 'login' ? '账号登录' : '新用户注册'}
            </h2>
            <form onSubmit={handleAuthSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {authMode === 'signup' ? (
                <>
                  <input 
                    type="text" 
                    placeholder="手机号 (可选)" 
                    value={phone}
                    onChange={e => setPhone(e.target.value)}
                    style={inputStyle}
                  />
                  <input 
                    type="email" 
                    placeholder="邮箱 (可选)" 
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    style={inputStyle}
                  />
                  <div style={{ display: 'flex', gap: '20px', alignItems: 'center', fontSize: '0.85rem', padding: '0 4px' }}>
                    <span style={{ color: 'var(--color-muted)' }}>选择角色:</span>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer' }}>
                      <input 
                        type="radio" 
                        name="role" 
                        checked={role === 'user'}
                        onChange={() => setRole('user')}
                      />
                      普通用户
                    </label>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer' }}>
                      <input 
                        type="radio" 
                        name="role" 
                        checked={role === 'admin'}
                        onChange={() => setRole('admin')}
                      />
                      管理员
                    </label>
                  </div>
                </>
              ) : (
                <input 
                  type="text" 
                  placeholder="手机号 或 邮箱" 
                  value={phone}
                  onChange={e => setPhone(e.target.value)}
                  style={inputStyle}
                  required
                />
              )}
              <input 
                type="password" 
                placeholder="密码" 
                value={password}
                onChange={e => setPassword(e.target.value)}
                style={inputStyle}
                required
              />
              {errorMsg && (
                <div style={{ fontSize: '0.8rem', color: '#ef4444', textAlign: 'center' }}>
                  {errorMsg}
                </div>
              )}
              <button 
                type="submit" 
                className="sand-btn"
                style={{ padding: '12px', fontSize: '0.95rem', width: '100%', marginTop: '8px' }}
              >
                {authMode === 'login' ? '登录' : '注册'}
              </button>
            </form>
            <div style={{ marginTop: '20px', textAlign: 'center', fontSize: '0.85rem', color: 'var(--color-muted)' }}>
              {authMode === 'login' ? (
                <span>还没有账号？ <a href="#" onClick={(e) => { e.preventDefault(); setAuthMode('signup'); setErrorMsg(''); }} style={{ color: 'var(--color-accent)', textDecoration: 'none', fontWeight: 500 }}>立即注册</a></span>
              ) : (
                <span>已有账号？ <a href="#" onClick={(e) => { e.preventDefault(); setAuthMode('login'); setErrorMsg(''); }} style={{ color: 'var(--color-accent)', textDecoration: 'none', fontWeight: 500 }}>去登录</a></span>
              )}
            </div>
          </div>
        </div>
      )}

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
        SELECT id, title, category, market_region, summary FROM reports ORDER BY created_at DESC
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
