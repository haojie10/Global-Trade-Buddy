import { GetServerSideProps } from 'next';
import React, { useState } from 'react';
import { Client } from 'pg';
import pool from '../lib/db';
import { getUserGraph } from './api/user/graph';
import ObsidianGraph, { Node as ObsidianNode } from '../components/ObsidianGraph';
import ToolsPanel from '../components/ToolsPanel';
import Link from 'next/link';
import { filterGraphData, GraphNode, GraphLink } from '../lib/graph-helpers';

interface MyGraphProps {
  graphData: {
    nodes: GraphNode[];
    links: GraphLink[];
  };
  userId: string;
  userRole: string;
  freeQuota: number;
}

export default function MyGraphPage({ graphData, userId, userRole, freeQuota }: MyGraphProps) {
  const [quota, setQuota] = useState(freeQuota);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // 筛选与画像状态管理
  const [selectedMarket, setSelectedMarket] = useState('All');
  const [selectedProduct, setSelectedProduct] = useState('All');
  const [focusNodeId, setFocusNodeId] = useState<string | null>(null);
  const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null);
  const [activeTab, setActiveTab] = useState<'profile' | 'tools'>('tools');

  if (!userId) {
    return (
      <div style={{
        background: '#f8fafc',
        color: '#0f172a',
        minHeight: '100vh',
        fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, sans-serif',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        padding: '20px',
        textAlign: 'center'
      }}>
        <div style={{
          background: 'rgba(255, 255, 255, 0.45)',
          backdropFilter: 'blur(16px)',
          border: '1px solid rgba(15, 23, 42, 0.08)',
          padding: '40px',
          borderRadius: '24px',
          maxWidth: '480px',
          boxShadow: '0 8px 32px 0 rgba(31, 38, 135, 0.07)'
        }}>
          <h2 style={{ fontSize: '1.5rem', fontWeight: 300, marginBottom: '16px' }}>🔒 暂未登录</h2>
          <p style={{ color: '#475569', fontSize: '0.9rem', marginBottom: '24px', lineHeight: 1.6 }}>
            游客模式下无法查看个人知识拓扑网图。请返回首页登录或注册账号后体验！
          </p>
          <Link href="/" className="water-drop-btn" style={{ padding: '10px 24px', textDecoration: 'none' }}>
            🏠 返回首页登录
          </Link>
        </div>
        <style jsx global>{`
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

  const handleInitSeedData = async () => {
    if (loading) return;
    setLoading(true);
    setError('');

    try {
      const res = await fetch('/api/user/unlock-action', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId,
          reportId: 'seed-action',
        }),
      });

      const data = await res.json();
      if (data.success) {
        // 解锁并初始化种子数据成功，重新载入页面数据以显示图谱
        window.location.reload();
      } else {
        setError(data.error || '生成种子数据失败，请重试');
      }
    } catch (err) {
      console.error(err);
      setError('网络请求失败，请稍后重试');
    } finally {
      setLoading(false);
    }
  };

  const hasData = graphData.nodes && graphData.nodes.length > 0;

  // 动态提取筛选选项
  const markets = hasData ? ['All', ...Array.from(new Set(graphData.nodes.map(n => n.market_region).filter(Boolean)))] : ['All'];
  const products = hasData ? ['All', ...Array.from(new Set(graphData.nodes.flatMap(n => n.products || []).filter(Boolean)))] : ['All'];

  // 过滤数据
  const filteredGraphData = hasData ? filterGraphData(
    graphData.nodes,
    graphData.links,
    selectedMarket,
    selectedProduct,
    focusNodeId
  ) : { nodes: [], links: [] };

  const focusedNode = hasData && focusNodeId ? graphData.nodes.find(n => n.id === focusNodeId) : null;

  return (
    <div style={{
      background: '#f8fafc',
      color: '#0f172a',
      minHeight: '100vh',
      fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, sans-serif',
      display: 'flex',
      flexDirection: 'column',
      position: 'relative',
      overflowX: 'hidden'
    }}>
      {/* 渐变背景 - 清爽浅色淡蓝光晕 */}
      <div style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        height: '100%',
        background: 'radial-gradient(circle at 15% 15%, rgba(37, 99, 235, 0.04) 0%, transparent 50%), radial-gradient(circle at 85% 85%, rgba(37, 99, 235, 0.03) 0%, transparent 50%)',
        pointerEvents: 'none',
        zIndex: 0
      }} />
      
      {/* 头部导航栏 - 漂浮样式 */}
      <div style={{ padding: '20px 40px 10px 40px', flexShrink: 0, zIndex: 10 }}>
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
          boxShadow: '0 10px 30px rgba(15, 23, 42, 0.04)',
          maxWidth: '1400px',
          margin: '0 auto',
          width: '100%'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ fontSize: '1.5rem' }}>🕸️</span>
            <span style={{
              fontSize: '1.25rem',
              fontWeight: 400,
              color: '#0f172a',
              letterSpacing: '-0.5px'
            }}>
              个人外贸知识拓扑网络
            </span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '24px', fontSize: '0.9rem' }}>
            <Link 
              href="/" 
              className="water-drop-btn"
              style={{
                textDecoration: 'none',
                fontWeight: 400,
                padding: '8px 20px',
                fontSize: '0.85rem'
              }}
            >
              🌐 返回平台报告大厅
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

      {/* 主体内容区（分左右两栏） */}
      <main style={{
        flex: 1,
        display: 'flex',
        padding: '10px 40px 24px 40px',
        gap: '24px',
        overflow: 'hidden',
        maxWidth: '1480px',
        margin: '0 auto',
        width: '100%',
        zIndex: 10
      }}>
        {/* 左栏：图谱面板 */}
        <div style={{ flex: 1, minWidth: 0, height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          {hasData && (
            <>
              {/* 顶部筛选栏 */}
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '16px',
                padding: '12px 24px',
                background: 'rgba(255, 255, 255, 0.45)',
                backdropFilter: 'blur(16px)',
                borderRadius: '16px',
                border: '1px solid rgba(15, 23, 42, 0.08)',
                marginBottom: '16px',
                boxShadow: '0 4px 20px rgba(15, 23, 42, 0.02)',
                flexWrap: 'wrap'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontSize: '0.85rem', color: '#475569', fontWeight: 500 }}>🌎 国家/市场</span>
                    <select
                      value={selectedMarket}
                      onChange={(e) => setSelectedMarket(e.target.value)}
                      style={{
                        padding: '6px 12px',
                        borderRadius: '10px',
                        border: '1px solid rgba(15, 23, 42, 0.12)',
                        background: 'rgba(255, 255, 255, 0.8)',
                        fontSize: '0.85rem',
                        outline: 'none',
                        cursor: 'pointer',
                        color: '#0f172a'
                      }}
                    >
                      {markets.map(m => <option key={m} value={m}>{m}</option>)}
                    </select>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontSize: '0.85rem', color: '#475569', fontWeight: 500 }}>📦 产品品类</span>
                    <select
                      value={selectedProduct}
                      onChange={(e) => setSelectedProduct(e.target.value)}
                      style={{
                        padding: '6px 12px',
                        borderRadius: '10px',
                        border: '1px solid rgba(15, 23, 42, 0.12)',
                        background: 'rgba(255, 255, 255, 0.8)',
                        fontSize: '0.85rem',
                        outline: 'none',
                        cursor: 'pointer',
                        color: '#0f172a'
                      }}
                    >
                      {products.map(p => <option key={p} value={p}>{p}</option>)}
                    </select>
                  </div>
                </div>

                <button
                  onClick={() => {
                    setSelectedMarket('All');
                    setSelectedProduct('All');
                    setFocusNodeId(null);
                    setSelectedNode(null);
                  }}
                  className="water-drop-btn"
                  style={{
                    padding: '6px 18px',
                    fontSize: '0.8rem',
                    cursor: 'pointer',
                    fontWeight: 500
                  }}
                >
                  🔄 重置筛选与聚焦
                </button>
              </div>

              {/* 聚焦提醒横幅 */}
              {focusNodeId && focusedNode && (
                <div style={{
                  padding: '10px 20px',
                  background: 'rgba(37, 99, 235, 0.08)',
                  border: '1px solid rgba(37, 99, 235, 0.15)',
                  borderRadius: '12px',
                  color: '#1d4ed8',
                  fontSize: '0.85rem',
                  marginBottom: '16px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center'
                }}>
                  <span>📍 正在聚焦报告：<strong>{focusedNode.title}</strong> (只展示其一阶关联节点)</span>
                  <span
                    onClick={() => setFocusNodeId(null)}
                    style={{
                      cursor: 'pointer',
                      fontWeight: 600,
                      textDecoration: 'underline'
                    }}
                  >
                    [清除聚焦]
                  </span>
                </div>
              )}
            </>
          )}

          {hasData ? (
            <div style={{ flex: 1, minHeight: 0 }}>
              <ObsidianGraph
                data={filteredGraphData}
                onNodeSelect={(node) => {
                  setSelectedNode(node as any);
                  setActiveTab('profile');
                }}
                onNodeDoubleClick={(node) => {
                  setFocusNodeId(node.id);
                }}
              />
            </div>
          ) : (
            <div style={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'center',
              alignItems: 'center',
              background: 'rgba(255, 255, 255, 0.85)',
              borderRadius: '24px',
              border: '1px solid rgba(15, 23, 42, 0.08)',
              backdropFilter: 'blur(30px)',
              padding: '40px',
              textAlign: 'center',
              boxShadow: '0 12px 40px 0 rgba(15, 23, 42, 0.03)'
            }}>
              <div 
                className="floating-planet"
                style={{
                  fontSize: '4.5rem',
                  marginBottom: '28px',
                  background: 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                  fontWeight: 800,
                  cursor: 'default',
                  userSelect: 'none'
                }}
              >
                🪐
              </div>
              <h2 style={{
                fontSize: '1.7rem',
                fontWeight: 300,
                marginBottom: '16px',
                color: '#0f172a',
                letterSpacing: '-0.5px'
              }}>
                开启您的外贸星空知识网络
              </h2>
              <p style={{
                maxWidth: '520px',
                fontSize: '0.95rem',
                color: '#475569',
                lineHeight: 1.6,
                marginBottom: '36px'
              }}>
                您的个人知识拓扑网络目前还是空的。在这里，您可以通过在报告大厅解锁和阅读行业客户与品类报告，自动生成互相关联的实体知识卡片网络，帮您洞察跨区域客户之间的隐藏商机。
              </p>
              
              <button
                onClick={handleInitSeedData}
                disabled={loading}
                className="water-drop-btn"
                style={{
                  padding: '14px 32px',
                  fontSize: '0.95rem',
                  fontWeight: 500,
                  opacity: loading ? 0.7 : 1,
                  cursor: loading ? 'not-allowed' : 'pointer'
                }}
              >
                {loading ? '⚡ 正在生成专属知识节点...' : '🔌 快速生成演示图谱并解锁首批报告'}
              </button>

              {error && (
                <div style={{ marginTop: '16px', color: '#ef4444', fontSize: '0.85rem', fontWeight: 600 }}>
                  ⚠️ {error}
                </div>
              )}
            </div>
          )}
        </div>

        {/* 右栏：外贸便捷小工具面板 */}
        <div style={{
          width: '450px',
          background: 'rgba(255, 255, 255, 0.75)',
          borderRadius: '24px',
          border: '1px solid rgba(15, 23, 42, 0.08)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          backdropFilter: 'blur(20px)',
          boxShadow: '0 10px 30px rgba(15, 23, 42, 0.03)'
        }}>
          {/* Tab 头部 */}
          <div style={{
            display: 'flex',
            borderBottom: '1px solid rgba(15, 23, 42, 0.06)',
            background: 'rgba(15, 23, 42, 0.02)',
            padding: '4px 8px 0 8px'
          }}>
            <button
              onClick={() => setActiveTab('profile')}
              style={{
                flex: 1,
                padding: '12px 8px',
                background: 'none',
                border: 'none',
                borderBottom: activeTab === 'profile' ? '2px solid #2563eb' : '2px solid transparent',
                color: activeTab === 'profile' ? '#2563eb' : '#475569',
                fontWeight: activeTab === 'profile' ? 600 : 400,
                fontSize: '0.85rem',
                cursor: 'pointer',
                transition: 'all 0.2s'
              }}
            >
              📁 商业画像看板
            </button>
            <button
              onClick={() => setActiveTab('tools')}
              style={{
                flex: 1,
                padding: '12px 8px',
                background: 'none',
                border: 'none',
                borderBottom: activeTab === 'tools' ? '2px solid #2563eb' : '2px solid transparent',
                color: activeTab === 'tools' ? '#2563eb' : '#475569',
                fontWeight: activeTab === 'tools' ? 600 : 400,
                fontSize: '0.85rem',
                cursor: 'pointer',
                transition: 'all 0.2s'
              }}
            >
              🛠️ 外贸快捷工具箱
            </button>
          </div>

          {/* Tab 内容区 */}
          {activeTab === 'profile' ? (
            <div style={{ flex: 1, padding: '20px', overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>
              {selectedNode ? (
                <div style={{
                  background: 'rgba(255, 255, 255, 0.65)',
                  backdropFilter: 'blur(10px)',
                  borderRadius: '20px',
                  border: '1px solid rgba(15, 23, 42, 0.06)',
                  padding: '24px',
                  boxShadow: '0 8px 32px 0 rgba(31, 38, 135, 0.04)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '16px'
                }}>
                  <div>
                    <h4 style={{ margin: '0 0 6px 0', fontSize: '1.1rem', color: '#0f172a', fontWeight: 600, lineHeight: 1.4 }}>
                      {selectedNode.title}
                    </h4>
                    <span style={{ fontSize: '0.8rem', color: '#64748b' }}>报告 ID: {selectedNode.id.substring(0, 8)}...</span>
                  </div>

                  {/* 国家/市场 */}
                  <div>
                    <div style={{ fontSize: '0.8rem', color: '#475569', fontWeight: 600, marginBottom: '6px' }}>🌍 所涉国家/市场</div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                      {selectedNode.market_region ? (
                        <span style={{
                          background: 'rgba(37, 99, 235, 0.08)',
                          color: '#2563eb',
                          border: '1px solid rgba(37, 99, 235, 0.15)',
                          padding: '4px 10px',
                          borderRadius: '12px',
                          fontSize: '0.75rem',
                          fontWeight: 500
                        }}>
                          {selectedNode.market_region}
                        </span>
                      ) : (
                        <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>暂无</span>
                      )}
                    </div>
                  </div>

                  {/* 经营玩家/品牌 */}
                  <div>
                    <div style={{ fontSize: '0.8rem', color: '#475569', fontWeight: 600, marginBottom: '6px' }}>🏢 经营玩家/品牌</div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                      {selectedNode.companies && selectedNode.companies.length > 0 ? (
                        selectedNode.companies.map((c, i) => (
                          <span key={i} style={{
                            background: 'rgba(16, 185, 129, 0.08)',
                            color: '#10b981',
                            border: '1px solid rgba(16, 185, 129, 0.15)',
                            padding: '4px 10px',
                            borderRadius: '12px',
                            fontSize: '0.75rem',
                            fontWeight: 500
                          }}>
                            {c}
                          </span>
                        ))
                      ) : (
                        <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>暂无</span>
                      )}
                    </div>
                  </div>

                  {/* 涉及品类 */}
                  <div>
                    <div style={{ fontSize: '0.8rem', color: '#475569', fontWeight: 600, marginBottom: '6px' }}>📦 涉及品类</div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                      {selectedNode.products && selectedNode.products.length > 0 ? (
                        selectedNode.products.map((p, i) => (
                          <span key={i} style={{
                            background: 'rgba(249, 115, 22, 0.08)',
                            color: '#ea580c',
                            border: '1px solid rgba(249, 115, 22, 0.15)',
                            padding: '4px 10px',
                            borderRadius: '12px',
                            fontSize: '0.75rem',
                            fontWeight: 500
                          }}>
                            {p}
                          </span>
                        ))
                      ) : (
                        <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>暂无</span>
                      )}
                    </div>
                  </div>

                  {/* 覆盖渠道 */}
                  <div>
                    <div style={{ fontSize: '0.8rem', color: '#475569', fontWeight: 600, marginBottom: '6px' }}>🛣️ 覆盖渠道</div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                      {selectedNode.channels && selectedNode.channels.length > 0 ? (
                        selectedNode.channels.map((ch, i) => (
                          <span key={i} style={{
                            background: 'rgba(147, 51, 234, 0.08)',
                            color: '#9333ea',
                            border: '1px solid rgba(147, 51, 234, 0.15)',
                            padding: '4px 10px',
                            borderRadius: '12px',
                            fontSize: '0.75rem',
                            fontWeight: 500
                          }}>
                            {ch}
                          </span>
                        ))
                      ) : (
                        <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>暂无</span>
                      )}
                    </div>
                  </div>

                  {/* 简要概述 */}
                  <div style={{ borderTop: '1px solid rgba(15, 23, 42, 0.06)', paddingTop: '12px' }}>
                    <div style={{ fontSize: '0.8rem', color: '#475569', fontWeight: 600, marginBottom: '6px' }}>📝 报告概述</div>
                    <p style={{
                      margin: 0,
                      fontSize: '0.85rem',
                      color: '#475569',
                      lineHeight: 1.6,
                      whiteSpace: 'pre-line'
                    }}>
                      {selectedNode.summary || '暂无概述'}
                    </p>
                  </div>

                  <Link
                    href={`/reports/${selectedNode.id}`}
                    className="water-drop-btn"
                    style={{
                      padding: '10px 0',
                      fontSize: '0.85rem',
                      width: '100%',
                      textDecoration: 'none',
                      fontWeight: 500,
                      marginTop: '8px'
                    }}
                  >
                    📖 阅读报告详情
                  </Link>
                </div>
              ) : (
                <div style={{
                  flex: 1,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: '40px 20px',
                  textAlign: 'center',
                  color: '#64748b'
                }}>
                  <span style={{ fontSize: '2.5rem', marginBottom: '16px' }}>💡</span>
                  <p style={{ margin: 0, fontSize: '0.85rem', lineHeight: 1.6, color: '#64748b' }}>
                    点击图谱中的任意报告节点，即可在此查看该报告的智能商业画像与核心供需实体线索。
                  </p>
                </div>
              )}
            </div>
          ) : (
            <div style={{ flex: 1, padding: '10px 0', overflowY: 'auto' }}>
              <ToolsPanel />
            </div>
          )}
        </div>

      </main>

      {/* 简单的关键帧动画定义 */}
      <style jsx global>{`
        .floating-planet {
          animation: float 4s infinite ease-in-out;
        }
        @keyframes float {
          0% { transform: translateY(0px) rotate(0deg); }
          50% { transform: translateY(-10px) rotate(5deg); }
          100% { transform: translateY(0px) rotate(0deg); }
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

function parseCookies(cookieHeader?: string) {
  const list: Record<string, string> = {};
  if (!cookieHeader) return list;
  cookieHeader.split(';').forEach((cookie) => {
    const parts = cookie.split('=');
    list[parts.shift()!.trim()] = decodeURI(parts.join('='));
  });
  return list;
}

// SSR 加载个人知识图谱数据
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

    if (userId) {
      if (userRole === 'admin') {
        const reportsRes = await dbClient.query(`SELECT id, title, category, market_region FROM reports`);
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
      } else {
        graphData = await getUserGraph(userId, dbClient);
      }
    }

    return {
      props: {
        graphData,
        userId: userId || '',
        userRole,
        freeQuota
      }
    };
  } catch (err) {
    console.error('SSR 加载个人图谱失败，原因:', err);
    return {
      props: {
        graphData: { nodes: [], links: [] },
        userId: '',
        userRole: 'guest',
        freeQuota: 0
      }
    };
  } finally {
    dbClient.release();
  }
};
