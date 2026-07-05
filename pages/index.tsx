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
  const [showAllReports, setShowAllReports] = useState(false);
  const [focusImageIndex, setFocusImageIndex] = useState(0);
  const [emailInput, setEmailInput] = useState('');
  const [subscribed, setSubscribed] = useState(false);

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
  const [showCustomizer, setShowCustomizer] = useState(false);

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

  // Discover & Focus 幻灯片图谱自动切换
  useEffect(() => {
    const timer = setInterval(() => {
      setFocusImageIndex(prev => (prev + 1) % 3);
    }, 3000);
    return () => clearInterval(timer);
  }, []);

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
      </div>

      {/* 头部导航栏 - 贴顶置顶黑色样式 */}
      <div style={{ 
        position: 'fixed', 
        top: 0, 
        left: 0, 
        right: 0, 
        background: '#121212', 
        zIndex: 1000, 
        borderBottom: '1px solid rgba(255, 255, 255, 0.1)' 
      }}>
        <header style={{
          background: 'transparent',
          padding: '16px 40px',
          borderRadius: '0px',
          border: 'none',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          boxShadow: 'none',
          maxWidth: '1400px',
          margin: '0 auto',
          width: '100%'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <GlobeIcon size={18} stroke="var(--color-accent)" />
            <span style={{
              fontSize: '1.25rem',
              fontWeight: 400,
              color: '#ffffff',
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
                gap: '6px',
                color: '#ffffff',
                background: 'transparent',
                border: '1px solid rgba(255, 255, 255, 0.15)',
                borderRadius: '0px',
                padding: '6px 16px',
                transition: 'all 0.2s'
              }}
              onMouseOver={(e) => {
                e.currentTarget.style.borderColor = 'var(--color-accent)';
                e.currentTarget.style.color = 'var(--color-accent)';
              }}
              onMouseOut={(e) => {
                e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.15)';
                e.currentTarget.style.color = '#ffffff';
              }}
            >
              <GraphIcon size={14} stroke="currentColor" />
              个人市场图谱
            </Link>
            {userId ? (
              <>
                {userRole === 'admin' ? (
                  <>
                    <span style={{ color: '#ffffff', fontWeight: 400, display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <CrownIcon size={14} stroke="currentColor" />
                      管理员: <code style={{ color: 'rgba(255, 255, 255, 0.6)', fontWeight: 500 }}>{userId.substring(0, 8)}...</code>
                    </span>
                    <button 
                      onClick={() => setShowUploadModal(true)}
                      className="sand-btn"
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        color: '#ffffff',
                        background: 'transparent',
                        border: '1px solid rgba(255, 255, 255, 0.15)',
                        borderRadius: '0px',
                        padding: '6px 16px',
                        transition: 'all 0.2s',
                        cursor: 'pointer'
                      }}
                      onMouseOver={(e) => {
                        e.currentTarget.style.borderColor = 'var(--color-accent)';
                        e.currentTarget.style.color = 'var(--color-accent)';
                      }}
                      onMouseOut={(e) => {
                        e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.15)';
                        e.currentTarget.style.color = '#ffffff';
                      }}
                    >
                      <UploadIcon size={14} stroke="currentColor" />
                      上传新报告
                    </button>
                  </>
                ) : (
                  <>
                    <span style={{ color: '#ffffff', fontWeight: 400 }}>
                      业务员 ID: <code style={{ color: 'rgba(255, 255, 255, 0.6)', fontWeight: 500 }}>{userId.substring(0, 8)}...</code>
                    </span>
                    <span style={{
                      border: '1px solid rgba(255, 255, 255, 0.15)',
                      padding: '6px 14px',
                      borderRadius: '0px',
                      color: '#ffffff',
                      fontWeight: 400,
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px'
                    }}>
                      <LockIcon size={14} stroke="currentColor" />
                      剩余额度: <b style={{ color: 'rgba(255, 255, 255, 0.6)', fontWeight: 500 }}>{quota}</b> 次
                    </span>
                  </>
                )}
                <button 
                  onClick={handleLogout}
                  className="sand-btn"
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    color: '#ffffff',
                    background: 'transparent',
                    border: '1px solid rgba(255, 255, 255, 0.15)',
                    borderRadius: '0px',
                    padding: '6px 16px',
                    transition: 'all 0.2s',
                    cursor: 'pointer'
                  }}
                  onMouseOver={(e) => {
                    e.currentTarget.style.borderColor = 'var(--color-accent)';
                    e.currentTarget.style.color = 'var(--color-accent)';
                  }}
                  onMouseOut={(e) => {
                    e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.15)';
                    e.currentTarget.style.color = '#ffffff';
                  }}
                >
                  <LogOutIcon size={14} stroke="currentColor" />
                  退出登录
                </button>
              </>
            ) : (
              <>
                <span style={{ color: '#ffffff', display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <UserIcon size={14} stroke="currentColor" />
                  游客模式
                </span>
                <button 
                  onClick={() => {
                    setShowAuthModal(true);
                  }}
                  className="sand-btn"
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    color: '#ffffff',
                    background: 'transparent',
                    border: '1px solid rgba(255, 255, 255, 0.15)',
                    borderRadius: '0px',
                    padding: '6px 16px',
                    transition: 'all 0.2s',
                    cursor: 'pointer'
                  }}
                  onMouseOver={(e) => {
                    e.currentTarget.style.borderColor = 'var(--color-accent)';
                    e.currentTarget.style.color = 'var(--color-accent)';
                  }}
                  onMouseOut={(e) => {
                    e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.15)';
                    e.currentTarget.style.color = '#ffffff';
                  }}
                >
                  <LockIcon size={14} stroke="currentColor" />
                  登录 / 注册
                </button>
              </>
            )}
          </div>
        </header>
      </div>

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
              俯瞰全球市场结构，<br />循线追踪市场盲区
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
              onClick={scrollToInsights}
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
            <div className="float-on-hover" style={{ background: 'rgba(255, 255, 255, 0.45)', backdropFilter: 'blur(15px)', WebkitBackdropFilter: 'blur(15px)', border: '1px solid rgba(18, 18, 18, 0.05)', padding: '24px', borderRadius: 'var(--border-radius)', display: 'flex', flexDirection: 'column' }}>
              <div style={{ height: '140px', overflow: 'hidden', borderRadius: 'var(--border-radius)', marginBottom: '16px', border: '1px solid rgba(18, 18, 18, 0.08)', boxShadow: '0 4px 12px rgba(0,0,0,0.01)' }}>
                <img src="/images/market_structure_network.jpg" alt="拓宽视野" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              </div>
              <h3 style={{ fontSize: '1.2rem', margin: '0 0 10px 0', color: 'var(--color-text)', fontWeight: 500 }}>拓宽视野：突破认知盲区</h3>
              <p style={{ fontSize: '0.9rem', color: 'var(--color-muted)', lineHeight: 1.6, margin: 0, fontWeight: 300 }}>
                通过解锁品类与渠道洞察报告，智能匹配相近的公司或关联产品。带您探索以前未曾关注的盲区市场，打破原有的信息茧房。
              </p>
            </div>

            {/* 卡片二 */}
            <div className="float-on-hover" style={{ background: 'rgba(255, 255, 255, 0.45)', backdropFilter: 'blur(15px)', WebkitBackdropFilter: 'blur(15px)', border: '1px solid rgba(18, 18, 18, 0.05)', padding: '24px', borderRadius: 'var(--border-radius)', display: 'flex', flexDirection: 'column' }}>
              <div style={{ height: '140px', overflow: 'hidden', borderRadius: 'var(--border-radius)', marginBottom: '16px', border: '1px solid rgba(18, 18, 18, 0.08)', boxShadow: '0 4px 12px rgba(0,0,0,0.01)' }}>
                <img src="/images/global_trade_trends.jpg" alt="掌握动向" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              </div>
              <h3 style={{ fontSize: '1.2rem', margin: '0 0 10px 0', color: 'var(--color-text)', fontWeight: 500 }}>掌握动向：全球品类洞察</h3>
              <p style={{ fontSize: '0.9rem', color: 'var(--color-muted)', lineHeight: 1.6, margin: 0, fontWeight: 300 }}>
                提供多维度的全球品类洞察。深度剖析海外主流零售渠道最新的渗透率与上架准入标准，结合绿色环保、锂电化等前沿变动，精准捕捉市场动向。
              </p>
            </div>

            {/* 卡片三 */}
            <div className="float-on-hover" style={{ background: 'rgba(255, 255, 255, 0.45)', backdropFilter: 'blur(15px)', WebkitBackdropFilter: 'blur(15px)', border: '1px solid rgba(18, 18, 18, 0.05)', padding: '24px', borderRadius: 'var(--border-radius)', borderColor: 'var(--color-accent)', display: 'flex', flexDirection: 'column' }}>
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
          <div style={{ background: 'rgba(255, 255, 255, 0.45)', backdropFilter: 'blur(15px)', WebkitBackdropFilter: 'blur(15px)', border: '1px solid rgba(18, 18, 18, 0.05)', borderRadius: 'var(--border-radius)', padding: '30px', display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: '40px' }}>
            <div style={{ flex: '1 1 400px' }}>
              <h4 style={{ fontSize: '1.2rem', color: 'var(--color-text)', margin: '0 0 10px 0', fontWeight: 500 }}>循线追踪，绘制您的专属市场认知脑图</h4>
              <p style={{ fontSize: '0.95rem', color: 'var(--color-muted)', lineHeight: 1.6, margin: '0 0 15px 0', fontWeight: 300 }}>
                在您的个人市场图谱中，每一份行业资讯、零售渠道、核心品类及个人笔记都被编织成清晰的知识网络。您可以通过实体之间的关联网络，向下延伸发现相近的品类或公司，向上俯瞰把握宏观结构，将市场掌握得更加透彻。
              </p>
              <span style={{ fontSize: '0.9rem', color: 'var(--color-accent)', borderBottom: '1px solid var(--color-accent)', paddingBottom: '2px', fontWeight: 400 }}>
                结合报告与个人见解，沉淀专属的商业大脑 ➔
              </span>
            </div>
            <div style={{ flex: '1 1 300px', maxWidth: '480px', borderRadius: 'var(--border-radius)', overflow: 'hidden', border: '1px solid rgba(18, 18, 18, 0.08)', boxShadow: '0 8px 32px rgba(0,0,0,0.02)' }}>
              <img src="/images/market_structure_network.jpg" alt="市场认知脑图" style={{ width: '100%', display: 'block' }} />
            </div>
          </div>
        </section>

        {/* 模块三：报告市场发现大厅 */}
        <section id="insights-library" className="animate-on-scroll" style={{
          padding: '60px 40px',
          maxWidth: '1400px',
          margin: '0 auto 60px auto',
          background: 'transparent',
          borderRadius: '0px'
        }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '30px', alignItems: 'center', marginBottom: '50px' }}>
            <div style={{ flex: '1 1 500px' }}>
              <h2 className="font-editorial" style={{
                fontSize: '2.8rem',
                fontWeight: 400,
                margin: '0 0 16px 0',
                color: 'var(--color-text)',
                letterSpacing: '-0.015em'
              }}>
                Discover & Focus
              </h2>
              <p style={{ fontSize: '1.05rem', color: 'var(--color-muted)', margin: 0, fontWeight: 300, lineHeight: 1.6 }}>
                探索大厅已发布跨国品类与渠道洞察报告，支持按行业、国家多维度筛选。帮助从业人员摆脱信息茧房，精准把握全球市场趋势与准入规则。
              </p>
            </div>
            <div style={{ 
              flex: '1 1 320px', 
              maxWidth: '480px', 
              display: 'flex', 
              flexDirection: 'column', 
              gap: '12px' 
            }}>
              <div style={{ 
                position: 'relative',
                width: '100%',
                height: '240px',
                borderRadius: 'var(--border-radius)', 
                overflow: 'hidden', 
                border: '1px solid rgba(18, 18, 18, 0.08)', 
                boxShadow: '0 8px 32px rgba(0,0,0,0.02)',
                background: '#0d1117'
              }}>
                {/* 第一张：全景远视图 */}
                <img 
                  src="/images/discover_focus_panorama.jpg" 
                  alt="全景远视图" 
                  style={{ 
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    width: '100%', 
                    height: '100%',
                    objectFit: 'cover',
                    transition: 'opacity 0.6s ease-in-out',
                    opacity: focusImageIndex === 0 ? 1 : 0,
                    zIndex: focusImageIndex === 0 ? 2 : 1
                  }} 
                />
                {/* 第二张：选中橙色节点 */}
                <img 
                  src="/images/discover_focus_select_orange.jpg" 
                  alt="选中一级二级橙色节点" 
                  style={{ 
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    width: '100%', 
                    height: '100%',
                    objectFit: 'cover',
                    transition: 'opacity 0.6s ease-in-out',
                    opacity: focusImageIndex === 1 ? 1 : 0,
                    zIndex: focusImageIndex === 1 ? 2 : 1
                  }} 
                />
                {/* 第三张：选中灰色节点 */}
                <img 
                  src="/images/discover_focus_select_grey.jpg" 
                  alt="选中一级二级灰色节点" 
                  style={{ 
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    width: '100%', 
                    height: '100%',
                    objectFit: 'cover',
                    transition: 'opacity 0.6s ease-in-out',
                    opacity: focusImageIndex === 2 ? 1 : 0,
                    zIndex: focusImageIndex === 2 ? 2 : 1
                  }} 
                />
              </div>

              {/* 幻灯片指示点 */}
              <div style={{ display: 'flex', justifyContent: 'center', gap: '8px', marginTop: '4px' }}>
                {[0, 1, 2].map((idx) => (
                  <button
                    key={idx}
                    onClick={() => setFocusImageIndex(idx)}
                    style={{
                      width: '8px',
                      height: '8px',
                      borderRadius: '50%',
                      padding: 0,
                      border: 'none',
                      cursor: 'pointer',
                      background: focusImageIndex === idx ? 'var(--color-accent)' : 'rgba(18, 18, 18, 0.15)',
                      transition: 'background 0.3s, transform 0.2s',
                      transform: focusImageIndex === idx ? 'scale(1.2)' : 'scale(1)'
                    }}
                    aria-label={`切换到图片 ${idx + 1}`}
                  />
                ))}
              </div>
            </div>
          </div>

          <ReportList
            reports={showAllReports ? reports : reports.slice(0, 6)}
            userId={userId}
            userRole={userRole}
            quota={quota}
            onUnlockSuccess={(newQuota, unlockedReportId) => {
              setQuota(newQuota);
              setReports(prev => prev.map(r => r.id === unlockedReportId ? { ...r, isUnlocked: true } : r));
            }}
          />

          {!showAllReports && reports.length > 6 && (
            <div style={{ textAlign: 'center', marginTop: '35px' }}>
              <button 
                onClick={() => setShowAllReports(true)}
                className="sand-btn"
                style={{
                  padding: '14px 36px',
                  fontSize: '0.95rem',
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
                查看全部报告 (包含其余 {reports.length - 6} 份) ➔
              </button>
            </div>
          )}
        </section>

        {/* 水平轻柔分割线 */}
        <div style={{
          width: '100%',
          maxWidth: '1400px',
          borderTop: '1px solid rgba(160, 109, 68, 0.08)',
          margin: '40px auto 20px auto'
        }} />

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
            <div className="float-on-hover" style={{ background: 'rgba(255, 255, 255, 0.45)', backdropFilter: 'blur(15px)', WebkitBackdropFilter: 'blur(15px)', border: '1px solid rgba(18, 18, 18, 0.05)', padding: '24px', borderRadius: 'var(--border-radius)', display: 'flex', gap: '20px', alignItems: 'flex-start' }}>
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
            <div className="float-on-hover" style={{ background: 'rgba(255, 255, 255, 0.45)', backdropFilter: 'blur(15px)', WebkitBackdropFilter: 'blur(15px)', border: '1px solid rgba(18, 18, 18, 0.05)', padding: '24px', borderRadius: 'var(--border-radius)', display: 'flex', gap: '20px', alignItems: 'flex-start' }}>
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
            background: 'rgba(255, 255, 255, 0.45)',
            backdropFilter: 'blur(15px)',
            WebkitBackdropFilter: 'blur(15px)',
            border: '1px solid rgba(18, 18, 18, 0.05)',
            borderRadius: 'var(--border-radius)',
            padding: '80px 40px',
            textAlign: 'center',
            position: 'relative',
            overflow: 'hidden',
            marginBottom: '80px',
            boxShadow: '0 8px 32px rgba(0, 0, 0, 0.01)'
          }}>
            <h2 className="font-editorial" style={{
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
                Submit
              </button>
            </form>

            {subscribed && (
              <div style={{ marginTop: '16px', color: 'var(--color-muted)', fontWeight: 500, fontSize: '0.95rem' }}>
                订阅成功！感谢您的关注。
              </div>
            )}
          </div>

          {/* 新增：Call to Action (行动呼吁) 注册引导区 */}
          <div style={{
            background: 'linear-gradient(180deg, rgba(255, 255, 255, 0.01) 0%, rgba(255, 255, 255, 0.04) 100%)',
            border: '1px solid rgba(18, 18, 18, 0.05)',
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
          borderRadius: '0px',
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
        ambientBlur={ambientBlur}
        setAmbientBlur={setAmbientBlur}
        ambientScale={ambientScale}
        setAmbientScale={setAmbientScale}
        ambientBlendMode={ambientBlendMode}
        setAmbientBlendMode={setAmbientBlendMode}
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
  
  let dbClient: any = null;

  try {
    dbClient = await pool.connect();
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
        const reportIds = nodes.map((n: any) => n.id);
        
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
        
        allReports = reportsRes.rows.map((row: any) => ({
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
        
        allReports = reportsRes.rows.map((row: any) => ({
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
      allReports = reportsRes.rows.map((row: any) => ({
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
    if (dbClient) {
      dbClient.release();
    }
  }
};
