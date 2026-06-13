import { GetServerSideProps } from 'next';
import React, { useState, useEffect, useRef } from 'react';
import { Client } from 'pg';
import pool from '../lib/db';
import { getUserGraph, GraphNode, GraphLink } from './api/user/graph';
import ToolsPanel from '../components/ToolsPanel';
import Link from 'next/link';
import { detectAndDecodeHtml } from '../lib/encoding';

interface PlatformReport {
  id: string;
  title: string;
  category: string;
  market_region: string;
  summary: string;
  isUnlocked: boolean;
}

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
  const [rawHtmlContent, setRawHtmlContent] = useState('');
  const [uploadLoading, setUploadLoading] = useState(false);

  // 拖拽及文件状态
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isDragActive, setIsDragActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

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

  const handleFileChange = (file: File) => {
    if (!file) return;
    if (!file.name.endsWith('.html') && !file.name.endsWith('.htm')) {
      alert('只支持上传 .html 格式的文件');
      return;
    }
    setSelectedFile(file);
    
    // 读取文件内容
    const reader = new FileReader();
    reader.onload = (e) => {
      const buffer = e.target?.result as ArrayBuffer;
      try {
        const decodedText = detectAndDecodeHtml(buffer);
        setRawHtmlContent(decodedText);
      } catch (err) {
        alert('读取或解析文件失败，请检查编码格式');
      }
    };
    reader.onerror = () => {
      alert('读取文件出错');
    };
    reader.readAsArrayBuffer(file);
  };

  const handleUploadReport = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!rawHtmlContent.trim()) return;
    setUploadLoading(true);
    try {
      const res = await fetch('/api/admin/reports/upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rawHtml: rawHtmlContent })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        alert('报告上传成功！');
        setRawHtmlContent('');
        setSelectedFile(null);
        setIsDragActive(false);
        setShowUploadModal(false);
        window.location.reload();
      } else {
        alert(data.error || '上传失败');
      }
    } catch (err) {
      alert('上传报告失败，请检查连接');
    } finally {
      setUploadLoading(false);
    }
  };

  const inputStyle = {
    background: 'rgba(255, 255, 255, 0.65)',
    border: '1px solid rgba(15, 23, 42, 0.08)',
    borderRadius: '12px',
    padding: '12px 16px',
    fontSize: '0.85rem',
    color: '#0f172a',
    outline: 'none',
    width: '100%',
    transition: 'border-color 0.3s ease',
    boxSizing: 'border-box' as const
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
  }, [allReports]);

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
      background: '#f8fafc',
      color: '#0f172a',
      minHeight: '100vh',
      fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, sans-serif',
      position: 'relative',
      overflowX: 'hidden'
    }}>
      {/* 渐变星云背景 - 清爽浅色淡蓝光晕 */}
      <div style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        height: '100%',
        background: 'radial-gradient(circle at 15% 15%, rgba(37, 99, 235, 0.04) 0%, transparent 50%), radial-gradient(circle at 85% 45%, rgba(37, 99, 235, 0.03) 0%, transparent 50%), radial-gradient(circle at 50% 85%, rgba(37, 99, 235, 0.02) 0%, transparent 60%)',
        pointerEvents: 'none',
        zIndex: 0
      }} />

      {/* 头部导航栏 - 浮空漂浮样式 */}
      <div style={{ padding: '20px 40px 10px 40px', position: 'sticky', top: 0, zIndex: 100 }}>
        <header style={{
          background: 'rgba(255, 255, 255, 0.75)',
          backdropFilter: 'blur(24px)',
          WebkitBackdropFilter: 'blur(24px)',
          padding: '12px 30px',
          borderRadius: '24px',
          border: '1px solid rgba(15, 23, 42, 0.08)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          boxShadow: '0 10px 30px rgba(15, 23, 42, 0.03)',
          maxWidth: '1400px',
          margin: '0 auto',
          width: '100%'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ fontSize: '1.6rem' }}>🌐</span>
            <span style={{
              fontSize: '1.25rem',
              fontWeight: 400,
              color: '#0f172a',
              letterSpacing: '-0.5px'
            }}>
              Globaltradebuddy
            </span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '24px', fontSize: '0.85rem' }}>
            <Link 
              href="/my-graph" 
              className="water-drop-btn"
              style={{
                textDecoration: 'none',
                fontWeight: 500,
                padding: '8px 24px',
                fontSize: '0.85rem'
              }}
            >
              🕸️ 个人知识拓扑网图
            </Link>
            {userId ? (
              <>
                {userRole === 'admin' ? (
                  <>
                    <span style={{ color: '#475569', fontWeight: 300 }}>
                      👑 管理员: <code style={{ color: '#2563eb', fontWeight: 400 }}>{userId.substring(0, 8)}...</code>
                    </span>
                    <button 
                      onClick={() => setShowUploadModal(true)}
                      className="water-drop-btn"
                      style={{
                        fontWeight: 500,
                        padding: '8px 24px',
                        fontSize: '0.85rem',
                        color: '#2563eb',
                        border: '1px solid rgba(37, 99, 235, 0.3)'
                      }}
                    >
                      📤 上传新报告
                    </button>
                  </>
                ) : (
                  <>
                    <span style={{ color: '#475569', fontWeight: 300 }}>
                      🔑 业务员 ID: <code style={{ color: '#2563eb', fontWeight: 400 }}>{userId.substring(0, 8)}...</code>
                    </span>
                    <span style={{
                      background: 'rgba(15, 23, 42, 0.03)',
                      border: '1px solid rgba(15, 23, 42, 0.08)',
                      padding: '6px 14px',
                      borderRadius: '20px',
                      color: '#0f172a',
                      fontWeight: 300
                    }}>
                      🔓 剩余额度: <b style={{ color: '#10b981', fontWeight: 500 }}>{quota}</b> 次
                    </span>
                  </>
                )}
                <button 
                  onClick={handleLogout}
                  className="water-drop-btn"
                  style={{
                    fontWeight: 500,
                    padding: '8px 24px',
                    fontSize: '0.85rem',
                    color: '#ef4444',
                    border: '1px solid rgba(239, 68, 68, 0.3)'
                  }}
                >
                  🚪 退出登录
                </button>
              </>
            ) : (
              <>
                <span style={{ color: '#64748b' }}>👤 游客模式</span>
                <button 
                  onClick={() => {
                    setAuthMode('login');
                    setShowAuthModal(true);
                  }}
                  className="water-drop-btn"
                  style={{
                    fontWeight: 500,
                    padding: '8px 24px',
                    fontSize: '0.85rem',
                    color: '#2563eb',
                    border: '1px solid rgba(37, 99, 235, 0.3)'
                  }}
                >
                  🔐 登录 / 注册
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
            <span style={{ fontSize: '1.5rem' }}>🌐</span>
            <div style={{ textAlign: 'left' }}>
              <div style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 300 }}>全球商机</div>
              <div style={{ fontSize: '0.8rem', fontWeight: 500, color: '#10b981' }}>实时监控中</div>
            </div>
          </div>
          <div className="floating-card floating-card-2" style={{ display: 'flex' }}>
            <span style={{ fontSize: '1.5rem' }}>🪙</span>
            <div style={{ textAlign: 'left' }}>
              <div style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 300 }}>结汇汇率</div>
              <div style={{ fontSize: '0.8rem', fontWeight: 500, color: '#0f172a' }}>CNY 7.24</div>
            </div>
          </div>
          <div className="floating-card floating-card-3" style={{ display: 'flex' }}>
            <span style={{ fontSize: '1.5rem' }}>📊</span>
            <div style={{ textAlign: 'left' }}>
              <div style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 300 }}>前沿报告</div>
              <div style={{ fontSize: '0.8rem', fontWeight: 500, color: '#2563eb' }}>已收录 {allReports.length} 份</div>
            </div>
          </div>
          <div className="floating-card floating-card-4" style={{ display: 'flex' }}>
            <span style={{ fontSize: '1.5rem' }}>🔍</span>
            <div style={{ textAlign: 'left' }}>
              <div style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 300 }}>海关检索</div>
              <div style={{ fontSize: '0.8rem', fontWeight: 500, color: '#b45309' }}>HS: 8708.70</div>
            </div>
          </div>

          <div style={{ maxWidth: '800px', zIndex: 5 }}>
            <span style={{
              background: 'rgba(37, 99, 235, 0.05)',
              border: '1px solid rgba(37, 99, 235, 0.12)',
              padding: '6px 16px',
              borderRadius: '20px',
              color: '#2563eb',
              fontSize: '0.85rem',
              fontWeight: 500,
              textTransform: 'uppercase',
              letterSpacing: '1px',
              display: 'inline-block',
              marginBottom: '24px'
            }}>
              ✨ 您的全智能出海展业伴侣
            </span>
            <h2 style={{
              fontSize: '3.6rem',
              fontWeight: 300,
              lineHeight: 1.15,
              margin: '0 0 24px 0',
              color: '#0f172a',
              letterSpacing: '-2px'
            }}>
              Your home for trade insights,<br />predictions, and tools.
            </h2>
            <p style={{
              fontSize: '1.25rem',
              color: '#475569',
              lineHeight: 1.6,
              maxWidth: '620px',
              margin: '0 auto 36px auto',
              fontWeight: 300
            }}>
              集成海量采购商机与买家画像报告。汇聚结汇计算、HS通关、全球时区窗口，为外贸精英全面赋能。
            </p>
            <button 
              onClick={scrollToInsights}
              className="water-drop-btn"
              style={{
                padding: '16px 40px',
                fontSize: '1rem',
                fontWeight: 500,
                border: '1px solid rgba(255, 255, 255, 0.8)'
              }}
            >
              探索洞察报告库 ↓
            </button>
          </div>
        </section>

        {/* 模块二：外贸智能工具箱 */}
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
              color: '#0f172a',
              letterSpacing: '-1px'
            }}>
              Trading tools for <span style={{ color: '#2563eb', fontWeight: 400 }}>everyone</span>.
            </h2>
            <p style={{ fontSize: '1.05rem', color: '#475569', maxWidth: '550px', margin: '0 auto', fontWeight: 300 }}>
              无需繁复查阅，随时掌握海外客户沟通黄金时间，更支持 AI 商品展厅级渲染处理。
            </p>
          </div>

          <div style={{ width: '100%' }}>
            <ToolsPanel layout="row" />
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
                color: '#0f172a',
                letterSpacing: '-1px'
              }}>
                Discover, Unlock & Connect.
              </h2>
              <p style={{ fontSize: '1.05rem', color: '#475569', margin: 0, fontWeight: 300 }}>
                探索大厅发布了 <b style={{ color: '#0f172a', fontWeight: 500 }}>{allReports.length}</b> 份最具潜力的跨国采购品类与买家画像报告。
              </p>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: '24px' }}>
            {allReports.length > 0 ? (
              allReports.map((report) => (
                <Link 
                  href={`/reports/${report.id}`} 
                  key={report.id} 
                  style={{ textDecoration: 'none' }}
                >
                  <div style={{
                    border: '1px solid rgba(15, 23, 42, 0.08)',
                    borderRadius: '24px',
                    padding: '28px',
                    background: 'rgba(255, 255, 255, 0.75)',
                    backdropFilter: 'blur(20px)',
                    cursor: 'pointer',
                    transition: 'all 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    height: '260px',
                    boxShadow: '0 8px 30px rgba(15, 23, 42, 0.03)'
                  }}
                  onMouseOver={(e) => {
                    e.currentTarget.style.borderColor = 'rgba(37, 99, 235, 0.4)';
                    e.currentTarget.style.transform = 'translateY(-6px)';
                    e.currentTarget.style.boxShadow = '0 20px 40px rgba(37, 99, 235, 0.08)';
                    e.currentTarget.style.background = 'rgba(255, 255, 255, 0.95)';
                  }}
                  onMouseOut={(e) => {
                    e.currentTarget.style.borderColor = 'rgba(15, 23, 42, 0.08)';
                    e.currentTarget.style.transform = 'none';
                    e.currentTarget.style.boxShadow = '0 8px 30px rgba(15, 23, 42, 0.03)';
                    e.currentTarget.style.background = 'rgba(255, 255, 255, 0.75)';
                  }}
                  >
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                        <span style={{
                          fontSize: '0.75rem',
                          fontWeight: 500,
                          color: report.category === 'customer' ? '#2563eb' : '#b45309',
                          background: report.category === 'customer' ? 'rgba(37, 99, 235, 0.06)' : 'rgba(217, 119, 6, 0.06)',
                          padding: '5px 12px',
                          borderRadius: '8px'
                        }}>
                          {report.category === 'customer' ? '👥 客户洞察' : '📈 品类分析'}
                        </span>
                        <span style={{ fontSize: '0.8rem', color: '#475569', fontWeight: 500 }}>
                          🎯 {report.market_region}
                        </span>
                      </div>
                      <h4 style={{
                        margin: '0 0 10px 0',
                        fontSize: '1.05rem',
                        color: '#0f172a',
                        fontWeight: 500,
                        lineHeight: 1.4,
                        display: '-webkit-box',
                        WebkitLineClamp: 2,
                        WebkitBoxOrient: 'vertical',
                        overflow: 'hidden'
                      }}>
                        {report.title}
                      </h4>
                      <p style={{
                        margin: 0,
                        fontSize: '0.85rem',
                        color: '#475569',
                        lineHeight: 1.5,
                        display: '-webkit-box',
                        WebkitLineClamp: 2,
                        WebkitBoxOrient: 'vertical',
                        overflow: 'hidden',
                        fontWeight: 300
                      }}>
                        {report.summary}
                      </p>
                    </div>
                    <div style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      marginTop: '16px',
                      borderTop: '1px solid rgba(15, 23, 42, 0.06)',
                      paddingTop: '16px'
                    }}>
                      <span style={{
                        fontSize: '0.75rem',
                        fontWeight: 500,
                        padding: '4px 10px',
                        borderRadius: '8px',
                        background: report.isUnlocked ? 'rgba(16, 185, 129, 0.08)' : 'rgba(217, 119, 6, 0.08)',
                        color: report.isUnlocked ? '#059669' : '#b45309'
                      }}>
                        {report.isUnlocked ? '✅ 已解锁' : '🔒 未解锁'}
                      </span>
                      <span style={{ fontSize: '0.8rem', color: '#2563eb', fontWeight: 500 }}>
                        立即预览与解锁 →
                      </span>
                    </div>
                  </div>
                </Link>
              ))
            ) : (
              <div style={{ gridColumn: '1 / -1', padding: '80px 40px', textAlign: 'center', color: '#64748b', fontWeight: 300 }}>
                📭 平台目前尚未发布任何报告。
              </div>
            )}
          </div>
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
              color: '#0f172a',
              letterSpacing: '-1px'
            }}>
              Controlled by you, secured by us.
            </h2>
            <p style={{ fontSize: '1.05rem', color: '#475569', maxWidth: '550px', margin: '0 auto', fontWeight: 300 }}>
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
              background: 'rgba(255, 255, 255, 0.75)',
              border: '1px solid rgba(15, 23, 42, 0.08)',
              borderRadius: '24px',
              padding: '36px',
              backdropFilter: 'blur(20px)',
              transition: 'all 0.3s cubic-bezier(0.16, 1, 0.3, 1)'
            }}
            onMouseOver={(e) => {
              e.currentTarget.style.borderColor = 'rgba(37, 99, 235, 0.3)';
              e.currentTarget.style.transform = 'translateY(-4px)';
            }}
            onMouseOut={(e) => {
              e.currentTarget.style.borderColor = 'rgba(15, 23, 42, 0.08)';
              e.currentTarget.style.transform = 'none';
            }}
            >
              <div style={{ fontSize: '2.5rem', marginBottom: '20px' }}>🕸️</div>
              <h3 style={{ fontSize: '1.15rem', fontWeight: 500, margin: '0 0 12px 0', color: '#0f172a' }}>
                个人专属知识拓扑
              </h3>
              <p style={{ fontSize: '0.9rem', color: '#475569', lineHeight: 1.6, margin: 0, fontWeight: 300 }}>
                独创的 3D 星空网状图谱，根据您解锁的每一份国家级、品类级洞察建立深度知识链。连线高亮与节点互动助您一眼发掘隐藏的商机。
              </p>
            </div>

            {/* 特色 2 */}
            <div style={{
              background: 'rgba(255, 255, 255, 0.75)',
              border: '1px solid rgba(15, 23, 42, 0.08)',
              borderRadius: '24px',
              padding: '36px',
              backdropFilter: 'blur(20px)',
              transition: 'all 0.3s cubic-bezier(0.16, 1, 0.3, 1)'
            }}
            onMouseOver={(e) => {
              e.currentTarget.style.borderColor = 'rgba(37, 99, 235, 0.3)';
              e.currentTarget.style.transform = 'translateY(-4px)';
            }}
            onMouseOut={(e) => {
              e.currentTarget.style.borderColor = 'rgba(15, 23, 42, 0.08)';
              e.currentTarget.style.transform = 'none';
            }}
            >
              <div style={{ fontSize: '2.5rem', marginBottom: '20px' }}>🧬</div>
              <h3 style={{ fontSize: '1.15rem', fontWeight: 500, margin: '0 0 12px 0', color: '#0f172a' }}>
                脱水上传管道技术
              </h3>
              <p style={{ fontSize: '0.9rem', color: '#475569', lineHeight: 1.6, margin: 0, fontWeight: 300 }}>
                行业领先的智能处理核心。提取 PDF/Doc 文件并全自动“脱水”，自动滤除敏感数据，对结构进行去标识 Base64 化转码，规避合规风险。
              </p>
            </div>

            {/* 特色 3 */}
            <div style={{
              background: 'rgba(255, 255, 255, 0.75)',
              border: '1px solid rgba(15, 23, 42, 0.08)',
              borderRadius: '24px',
              padding: '36px',
              backdropFilter: 'blur(20px)',
              transition: 'all 0.3s cubic-bezier(0.16, 1, 0.3, 1)'
            }}
            onMouseOver={(e) => {
              e.currentTarget.style.borderColor = 'rgba(37, 99, 235, 0.3)';
              e.currentTarget.style.transform = 'translateY(-4px)';
            }}
            onMouseOut={(e) => {
              e.currentTarget.style.borderColor = 'rgba(15, 23, 42, 0.08)';
              e.currentTarget.style.transform = 'none';
            }}
            >
              <div style={{ fontSize: '2.5rem', marginBottom: '20px' }}>💧</div>
              <h3 style={{ fontSize: '1.15rem', fontWeight: 500, margin: '0 0 12px 0', color: '#0f172a' }}>
                动态微光防盗水印
              </h3>
              <p style={{ fontSize: '0.9rem', color: '#475569', lineHeight: 1.6, margin: 0, fontWeight: 300 }}>
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
          borderTop: '1px solid rgba(15, 23, 42, 0.08)'
        }}>
          <div style={{
            background: 'linear-gradient(135deg, rgba(37, 99, 235, 0.05) 0%, rgba(37, 99, 235, 0.01) 100%)',
            border: '1px solid rgba(37, 99, 235, 0.1)',
            borderRadius: '32px',
            padding: '80px 40px',
            textAlign: 'center',
            position: 'relative',
            overflow: 'hidden',
            marginBottom: '80px'
          }}>
            <h2 style={{
              fontSize: '2.6rem',
              fontWeight: 300,
              margin: '0 0 16px 0',
              color: '#0f172a',
              letterSpacing: '-1px'
            }}>
              Get started.<br />Subscribe to Globaltradebuddy.
            </h2>
            <p style={{ fontSize: '1.05rem', color: '#475569', maxWidth: '480px', margin: '0 auto 36px auto', fontWeight: 300 }}>
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
                  background: 'rgba(15, 23, 42, 0.03)',
                  border: '1px solid rgba(15, 23, 42, 0.08)',
                  color: '#0f172a',
                  outline: 'none',
                  fontSize: '0.95rem',
                  fontWeight: 300,
                  transition: 'border-color 0.2s'
                }}
                onFocus={(e) => e.target.style.borderColor = '#2563eb'}
                onBlur={(e) => e.target.style.borderColor = 'rgba(15, 23, 42, 0.08)'}
              />
              <button 
                type="submit"
                className="water-drop-btn"
                style={{
                  padding: '16px 36px',
                  fontSize: '0.95rem',
                  fontWeight: 500,
                  border: '1px solid rgba(255, 255, 255, 0.8)'
                }}
              >
                Submit
              </button>
            </form>

            {subscribed && (
              <div style={{ marginTop: '16px', color: '#059669', fontWeight: 500, fontSize: '0.95rem' }}>
                🎉 订阅成功！感谢您的关注。
              </div>
            )}
          </div>

          {/* 版刻 & 导航 Footer */}
          <footer style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            color: '#64748b',
            fontSize: '0.85rem',
            paddingTop: '20px',
            borderTop: '1px solid rgba(15, 23, 42, 0.05)',
            fontWeight: 300
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span>🌐</span>
              <span style={{ fontWeight: 500, color: '#0f172a' }}>Globaltradebuddy</span>
            </div>
            <div>
              &copy; {new Date().getFullYear()} Globaltradebuddy. All rights reserved.
            </div>
          </footer>
        </section>

      </div>

      {/* 动画全局注入 */}
      <style jsx global>{`
        @keyframes float1 {
          0% { transform: translateY(0px) rotate(0deg); }
          50% { transform: translateY(-16px) rotate(6deg); }
          100% { transform: translateY(0px) rotate(0deg); }
        }
        @keyframes float2 {
          0% { transform: translateY(0px) rotate(0deg); }
          50% { transform: translateY(-22px) rotate(-8deg); }
          100% { transform: translateY(0px) rotate(0deg); }
        }
        @keyframes float3 {
          0% { transform: translateY(0px) rotate(0deg); }
          50% { transform: translateY(-12px) rotate(4deg); }
          100% { transform: translateY(0px) rotate(0deg); }
        }
        @keyframes float4 {
          0% { transform: translateY(0px) rotate(0deg); }
          50% { transform: translateY(-20px) rotate(-5deg); }
          100% { transform: translateY(0px) rotate(0deg); }
        }

        .floating-card {
          position: absolute;
          background: rgba(255, 255, 255, 0.8);
          backdrop-filter: blur(16px);
          -webkit-backdrop-filter: blur(16px);
          border: 1px solid rgba(15, 23, 42, 0.08);
          border-radius: 20px;
          padding: 16px 20px;
          align-items: center;
          gap: 12px;
          box-shadow: 0 16px 36px rgba(15, 23, 42, 0.04);
          z-index: 2;
        }

        .floating-card-1 {
          top: 18%;
          left: 6%;
          animation: float1 7s ease-in-out infinite;
        }
        .floating-card-2 {
          top: 28%;
          right: 8%;
          animation: float2 8s ease-in-out infinite 0.5s;
        }
        .floating-card-3 {
          bottom: 22%;
          left: 10%;
          animation: float3 6s ease-in-out infinite 1s;
        }
        .floating-card-4 {
          bottom: 18%;
          right: 12%;
          animation: float4 7.5s ease-in-out infinite 0.2s;
        }

        .animate-on-scroll {
          opacity: 0;
          transform: translateY(50px);
          transition: opacity 1.2s cubic-bezier(0.16, 1, 0.3, 1), transform 1.2s cubic-bezier(0.16, 1, 0.3, 1);
        }

        .animate-on-scroll.in-view {
          opacity: 1;
          transform: translateY(0);
        }

        @media (max-width: 1024px) {
          .floating-card {
            display: none !important;
          }
        }

        .water-drop-btn {
          background: rgba(255, 255, 255, 0.45);
          backdrop-filter: blur(16px);
          -webkit-backdrop-filter: blur(16px);
          border: 1px solid rgba(255, 255, 255, 0.75);
          border-radius: 30px;
          color: #0f172a;
          box-shadow: 
            0 8px 24px rgba(31, 38, 135, 0.03), 
            inset 0 4px 10px rgba(255, 255, 255, 0.65), 
            inset 0 -4px 10px rgba(15, 23, 42, 0.02);
          transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1);
          cursor: pointer;
          outline: none;
          display: inline-block;
          text-align: center;
        }
        .water-drop-btn:hover {
          background: rgba(255, 255, 255, 0.7);
          box-shadow: 
            0 12px 30px rgba(31, 38, 135, 0.05), 
            inset 0 8px 16px rgba(255, 255, 255, 0.8), 
            inset 0 -6px 16px rgba(15, 23, 42, 0.03);
          transform: translateY(-1px);
        }
      `}</style>
      {/* 登录/注册弹窗 */}
      {showAuthModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(15, 23, 42, 0.25)',
          backdropFilter: 'blur(16px)',
          WebkitBackdropFilter: 'blur(16px)',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          zIndex: 1000
        }}>
          <div style={{
            background: 'rgba(255, 255, 255, 0.45)',
            border: '1px solid rgba(255, 255, 255, 0.75)',
            borderRadius: '24px',
            padding: '40px 30px',
            width: '90%',
            maxWidth: '420px',
            boxShadow: '0 20px 40px rgba(15, 23, 42, 0.08), inset 0 8px 16px rgba(255, 255, 255, 0.55)',
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
                color: '#64748b'
              }}
            >
              ✕
            </button>
            <h2 style={{ fontSize: '1.5rem', fontWeight: 300, marginBottom: '24px', textAlign: 'center', color: '#0f172a' }}>
              {authMode === 'login' ? '🔐 账号登录' : '📝 新用户注册'}
            </h2>
            <form onSubmit={handleAuthSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {authMode === 'signup' ? (
                <>
                  <input 
                    type="text" 
                    placeholder="📱 手机号 (可选)" 
                    value={phone}
                    onChange={e => setPhone(e.target.value)}
                    style={inputStyle}
                  />
                  <input 
                    type="email" 
                    placeholder="✉️ 邮箱 (可选)" 
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    style={inputStyle}
                  />
                  <div style={{ display: 'flex', gap: '20px', alignItems: 'center', fontSize: '0.85rem', padding: '0 4px' }}>
                    <span style={{ color: '#475569' }}>选择角色:</span>
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
                  placeholder="📱 手机号 或 ✉️ 邮箱" 
                  value={phone}
                  onChange={e => setPhone(e.target.value)}
                  style={inputStyle}
                  required
                />
              )}
              <input 
                type="password" 
                placeholder="🔑 密码" 
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
                className="water-drop-btn"
                style={{ padding: '12px', fontSize: '0.95rem', fontWeight: 500, width: '100%', marginTop: '8px' }}
              >
                {authMode === 'login' ? '🚀 登录' : '✨ 注册'}
              </button>
            </form>
            <div style={{ marginTop: '20px', textAlign: 'center', fontSize: '0.85rem', color: '#64748b' }}>
              {authMode === 'login' ? (
                <span>还没有账号？ <a href="#" onClick={(e) => { e.preventDefault(); setAuthMode('signup'); setErrorMsg(''); }} style={{ color: '#2563eb', textDecoration: 'none', fontWeight: 500 }}>立即注册</a></span>
              ) : (
                <span>已有账号？ <a href="#" onClick={(e) => { e.preventDefault(); setAuthMode('login'); setErrorMsg(''); }} style={{ color: '#2563eb', textDecoration: 'none', fontWeight: 500 }}>去登录</a></span>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 管理员上传报告弹窗 */}
      {showUploadModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(15, 23, 42, 0.25)',
          backdropFilter: 'blur(16px)',
          WebkitBackdropFilter: 'blur(16px)',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          zIndex: 1000
        }}>
          <div style={{
            background: 'rgba(255, 255, 255, 0.45)',
            border: '1px solid rgba(255, 255, 255, 0.75)',
            borderRadius: '24px',
            padding: '40px 30px',
            width: '90%',
            maxWidth: '650px',
            boxShadow: '0 20px 40px rgba(15, 23, 42, 0.08), inset 0 8px 16px rgba(255, 255, 255, 0.55)',
            position: 'relative'
          }}>
            <button 
              onClick={() => {
                setShowUploadModal(false);
                setSelectedFile(null);
                setIsDragActive(false);
                setRawHtmlContent('');
              }}
              style={{
                position: 'absolute',
                top: '20px',
                right: '20px',
                background: 'none',
                border: 'none',
                fontSize: '1.25rem',
                cursor: 'pointer',
                color: '#64748b'
              }}
            >
              ✕
            </button>
            <h2 style={{ fontSize: '1.5rem', fontWeight: 300, marginBottom: '10px', textAlign: 'center', color: '#0f172a' }}>
              📤 发布外贸数据报告 (Admin)
            </h2>
            <p style={{ fontSize: '0.8rem', color: '#475569', textAlign: 'center', marginBottom: '24px' }}>
              拖拽上传报告的原始 HTML 文件，系统将自动进行脱水处理（自动转码、自动剥离 Base64 图并上传）。
            </p>
            <form onSubmit={handleUploadReport} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div 
                onClick={() => fileInputRef.current?.click()}
                onDragOver={(e) => {
                  e.preventDefault();
                  setIsDragActive(true);
                }}
                onDragLeave={() => setIsDragActive(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setIsDragActive(false);
                  if (e.dataTransfer.files && e.dataTransfer.files[0]) {
                    handleFileChange(e.dataTransfer.files[0]);
                  }
                }}
                style={{
                  width: '100%',
                  height: '240px',
                  background: selectedFile 
                    ? 'linear-gradient(135deg, rgba(37, 99, 235, 0.03) 0%, rgba(37, 99, 235, 0.08) 100%)' 
                    : isDragActive 
                      ? 'linear-gradient(135deg, rgba(37, 99, 235, 0.05) 0%, rgba(37, 99, 235, 0.12) 100%)'
                      : 'rgba(255, 255, 255, 0.65)',
                  border: selectedFile 
                    ? '2px solid #2563eb' 
                    : isDragActive 
                      ? '2px dashed #2563eb' 
                      : '2px dashed rgba(15, 23, 42, 0.15)',
                  borderRadius: '20px',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '12px',
                  cursor: 'pointer',
                  transition: 'all 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
                  padding: '20px',
                  boxShadow: isDragActive ? '0 12px 30px rgba(37, 99, 235, 0.08)' : 'none',
                }}
                onMouseOver={(e) => {
                  if (!selectedFile && !isDragActive) {
                    e.currentTarget.style.borderColor = 'rgba(37, 99, 235, 0.5)';
                    e.currentTarget.style.boxShadow = '0 8px 20px rgba(15, 23, 42, 0.02)';
                  }
                }}
                onMouseOut={(e) => {
                  if (!selectedFile && !isDragActive) {
                    e.currentTarget.style.borderColor = 'rgba(15, 23, 42, 0.15)';
                    e.currentTarget.style.boxShadow = 'none';
                  }
                }}
              >
                <input 
                  type="file" 
                  ref={fileInputRef}
                  onChange={(e) => {
                    if (e.target.files && e.target.files[0]) {
                      handleFileChange(e.target.files[0]);
                    }
                  }}
                  accept=".html,.htm"
                  style={{ display: 'none' }}
                />
                {selectedFile ? (
                  <>
                    <div style={{ fontSize: '3rem' }}>📄</div>
                    <div style={{ textAlign: 'center' }}>
                      <p style={{ margin: '0 0 4px 0', fontWeight: 600, fontSize: '0.95rem', color: '#0f172a', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '350px' }}>
                        {selectedFile.name}
                      </p>
                      <p style={{ margin: 0, fontSize: '0.8rem', color: '#64748b' }}>
                        文件大小: {(selectedFile.size / 1024).toFixed(1)} KB
                      </p>
                    </div>
                    <button 
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedFile(null);
                        setRawHtmlContent('');
                      }}
                      style={{
                        marginTop: '8px',
                        background: 'rgba(239, 68, 68, 0.08)',
                        border: '1px solid rgba(239, 68, 68, 0.2)',
                        color: '#ef4444',
                        borderRadius: '12px',
                        padding: '6px 16px',
                        fontSize: '0.8rem',
                        cursor: 'pointer',
                        fontWeight: 500,
                        transition: 'all 0.2s'
                      }}
                      onMouseOver={(e) => {
                        e.currentTarget.style.background = 'rgba(239, 68, 68, 0.15)';
                      }}
                      onMouseOut={(e) => {
                        e.currentTarget.style.background = 'rgba(239, 68, 68, 0.08)';
                      }}
                    >
                      ✕ 清除重选
                    </button>
                  </>
                ) : (
                  <>
                    <div style={{ 
                      fontSize: '3rem', 
                      transform: isDragActive ? 'translateY(-5px)' : 'none',
                      transition: 'transform 0.2s'
                    }}>
                      ☁️
                    </div>
                    <div style={{ textAlign: 'center' }}>
                      <p style={{ margin: '0 0 4px 0', fontWeight: 500, color: '#0f172a', fontSize: '0.95rem' }}>
                        {isDragActive ? '释放以导入此报告' : '将 HTML 报告文件拖到这里'}
                      </p>
                      <p style={{ margin: 0, fontSize: '0.8rem', color: '#64748b' }}>
                        支持 Drag & Drop，或点击本卡片浏览文件
                      </p>
                    </div>
                  </>
                )}
              </div>
              <button 
                type="submit" 
                className="water-drop-btn"
                disabled={uploadLoading || !rawHtmlContent}
                style={{ padding: '12px', fontSize: '0.95rem', fontWeight: 500, width: '100%' }}
              >
                {uploadLoading ? '⏳ 正在处理并上传报告...' : '🚀 立即发布报告'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

function parseCookies(cookieHeader?: string) {
  const list: Record<string, string> = {};
  if (!cookieHeader) return list;
  cookieHeader.split(';').forEach((cookie) => {
    const parts = cookie.split('=');
    list[parts.shift()!.trim()] = decodeURI(parts.join('='));
  });
  return list;
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

    let graphData = { nodes: [], links: [] };
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
