import { GetServerSideProps } from 'next';
import React, { useState, useEffect } from 'react';
import { Client } from 'pg';
import pool from '../lib/db';
import { getUserGraph, GraphNode, GraphLink } from './api/user/graph';
import ToolsPanel from '../components/ToolsPanel';
import Link from 'next/link';

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
  freeQuota: number;
}

export default function HomePage({ graphData, allReports, userId, freeQuota }: HomeProps) {
  const [quota, setQuota] = useState(freeQuota);
  const [emailInput, setEmailInput] = useState('');
  const [subscribed, setSubscribed] = useState(false);

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
            <span style={{ color: '#475569', fontWeight: 300 }}>🔑 业务员 ID: <code style={{ color: '#2563eb', fontWeight: 400 }}>{userId.substring(0, 8)}...</code></span>
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
    </div>
  );
}

// SSR 获取初始解锁图谱数据
export const getServerSideProps: GetServerSideProps = async (context) => {
  const dbClient = await pool.connect();

  try {
    // 默认获取第一个测试用户的 UUID
    const userRes = await dbClient.query('SELECT id, free_quota FROM users ORDER BY created_at ASC LIMIT 1');
    
    // 如果没有用户，先动态创建一个默认测试用户
    let userId = '';
    let freeQuota = 3;
    
    if (userRes.rows.length === 0) {
      const newUser = await dbClient.query(
        "INSERT INTO users (phone_number, free_quota) VALUES ('13800000000', 3) RETURNING id, free_quota"
      );
      userId = newUser.rows[0].id;
      freeQuota = newUser.rows[0].free_quota;
    } else {
      userId = userRes.rows[0].id;
      freeQuota = userRes.rows[0].free_quota;
    }

    const graphData = await getUserGraph(userId, dbClient);

    // 查询系统内所有的报告，同时检查当前用户是否已解锁它们
    const reportsRes = await dbClient.query(`
      SELECT r.id, r.title, r.category, r.market_region, r.summary,
             EXISTS(SELECT 1 FROM unlocks u WHERE u.user_id = $1 AND u.report_id = r.id) as is_unlocked
      FROM reports r
      ORDER BY r.created_at DESC
    `, [userId]);
    
    const allReports = reportsRes.rows.map(row => ({
      id: row.id,
      title: row.title,
      category: row.category,
      market_region: row.market_region,
      summary: row.summary,
      isUnlocked: row.is_unlocked
    }));

    return {
      props: {
        graphData,
        allReports,
        userId,
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
        freeQuota: 0
      }
    };
  } finally {
    dbClient.release();
  }
};
