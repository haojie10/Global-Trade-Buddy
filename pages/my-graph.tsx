import { GetServerSideProps } from 'next';
import React, { useState } from 'react';
import pool from '../lib/db';
import { parseCookies } from '../lib/cookies';
import { getUserGraph, getGraphData } from './api/user/graph';
import ObsidianGraph from '../components/ObsidianGraph';
import Link from 'next/link';
import { filterGraphData, GraphNode, GraphLink } from '../lib/graph-helpers';
import NodeProfilePanel from '../components/NodeProfilePanel';
import ReportList from '../components/ReportList';

interface MyGraphProps {
  graphData: {
    nodes: GraphNode[];
    links: GraphLink[];
  };
  userId: string;
  userRole: string;
  freeQuota: number;
  unlockedReports: any[];
}

export default function MyGraphPage({ graphData, userId, userRole, freeQuota, unlockedReports: initialUnlockedReports }: MyGraphProps) {
  const [quota, setQuota] = useState(freeQuota);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 筛选与画像状态管理
  const [selectedMarket, setSelectedMarket] = useState('All');
  const [selectedProduct, setSelectedProduct] = useState('All');
  const [focusNodeId, setFocusNodeId] = useState<string | null>(null);
  const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null);

  // 新增：实体详情及图谱动态数据源
  const [currentGraphData, setCurrentGraphData] = useState(graphData);
  const [entityDetail, setEntityDetail] = useState<any>(null);
  const [unlockedReports, setUnlockedReports] = useState(initialUnlockedReports || []);

  if (!userId) {
    return (
      <div style={{
        background: 'var(--bg-main)',
        color: 'var(--color-text)',
        minHeight: '100vh',
        fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, sans-serif',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        padding: '20px',
        textAlign: 'center'
      }}>
        <div style={{
          background: 'var(--bg-sub)',
          border: 'none',
          padding: '40px',
          borderRadius: 'var(--border-radius)',
          maxWidth: '480px',
          boxShadow: '0 10px 40px rgba(160, 109, 68, 0.04)'
        }}>
          <h2 style={{ fontSize: '1.5rem', fontWeight: 300, marginBottom: '16px' }}>暂未登录</h2>
          <p style={{ color: 'var(--color-muted)', fontSize: '0.9rem', marginBottom: '24px', lineHeight: 1.6 }}>
            游客模式下无法查看个人知识拓扑网图。请返回首页登录或注册账号后体验！
          </p>
          <Link href="/" className="sand-btn" style={{ padding: '10px 24px', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '6px', justifyContent: 'center' }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
              <polyline points="9 22 9 12 15 12 15 22" />
            </svg>
            返回首页登录
          </Link>
        </div>
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

  // 1. 动态刷新图谱核心数据
  const refreshGraphData = async () => {
    try {
      const res = await fetch('/api/user/graph');
      if (res.ok) {
        const data = await res.json();
        setCurrentGraphData(data);
      }
    } catch (err) {
      console.error('刷新图谱失败', err);
    }
  };

  // 2. 动态拉取公司/实体详细别名及关系
  const fetchEntityDetail = async (entityId: string) => {
    try {
      const res = await fetch(`/api/user/entities/detail?id=${entityId}`);
      if (res.ok) {
        const data = await res.json();
        setEntityDetail(data);
      }
    } catch (err) {
      console.error('获取实体详情失败', err);
    }
  };

  // 监听选中节点变化，动态加载详情
  React.useEffect(() => {
    if (selectedNode && selectedNode.node_type === 'entity') {
      fetchEntityDetail(selectedNode.id);
    } else {
      setEntityDetail(null);
    }
  }, [selectedNode]);

  const hasData = currentGraphData.nodes && currentGraphData.nodes.length > 0;

  // 动态提取筛选选项
  const markets = hasData ? ['All', ...Array.from(new Set(currentGraphData.nodes.map(n => n.market_region).filter(Boolean)))] : ['All'];
  const products = hasData ? ['All', ...Array.from(new Set(currentGraphData.nodes.flatMap(n => n.products || []).filter(Boolean)))] : ['All'];

  // 过滤数据
  const filteredGraphData = hasData ? filterGraphData(
    currentGraphData.nodes,
    currentGraphData.links,
    selectedMarket,
    selectedProduct,
    focusNodeId
  ) : { nodes: [], links: [] };

  const focusedNode = hasData && focusNodeId ? currentGraphData.nodes.find(n => n.id === focusNodeId) : null;

  return (
    <div style={{
      background: 'var(--bg-main)',
      color: 'var(--color-text)',
      minHeight: '100vh',
      fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, sans-serif',
      display: 'flex',
      flexDirection: 'column',
      position: 'relative',
      overflowX: 'hidden'
    }}>
      {/* 头部导航栏 - 漂浮样式 */}
      <div style={{ padding: '20px 40px 10px 40px', flexShrink: 0, zIndex: 10 }}>
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
              <path d="M4.5 16.5c-1.5 1.26-2.5 3.19-2.5 5.5h20c0-2.31-1-4.24-2.5-5.5" />
              <circle cx="12" cy="12" r="2" />
              <circle cx="12" cy="2" r="1" />
              <circle cx="4" cy="16" r="1" />
              <circle cx="20" cy="16" r="1" />
            </svg>
            <span style={{
              fontSize: '1.25rem',
              fontWeight: 400,
              color: 'var(--color-text)',
              letterSpacing: '-0.5px'
            }}>
              个人外贸知识拓扑网络
            </span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '24px', fontSize: '0.9rem' }}>
            <Link 
              href="/" 
              className="sand-btn"
              style={{
                textDecoration: 'none',
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
              }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" />
                <line x1="2" y1="12" x2="22" y2="12" />
                <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
              </svg>
              返回平台报告大厅
            </Link>
            <span style={{ color: 'var(--color-muted)', fontWeight: 300, display: 'flex', alignItems: 'center', gap: '4px' }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" strokeLinejoin="round">
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                <circle cx="12" cy="7" r="4" />
              </svg>
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
          </div>
        </header>
      </div>

      {/* 主体内容区（分左右两栏） */}
      <main style={{
        height: '680px',
        display: 'flex',
        padding: '10px 40px 24px 40px',
        gap: '24px',
        overflow: 'hidden',
        maxWidth: '1480px',
        margin: '0 auto',
        width: '100%',
        zIndex: 10,
        boxSizing: 'border-box'
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
                background: 'var(--bg-sub)',
                borderRadius: 'var(--border-radius)',
                marginBottom: '16px',
                boxShadow: '0 6px 20px rgba(160, 109, 68, 0.01)',
                flexWrap: 'wrap'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontSize: '0.85rem', color: 'var(--color-muted)', fontWeight: 500 }}>国家/市场</span>
                    <select
                      value={selectedMarket}
                      onChange={(e) => setSelectedMarket(e.target.value)}
                      style={{
                        padding: '6px 12px',
                        borderRadius: '10px',
                        border: 'none',
                        background: 'var(--bg-main)',
                        fontSize: '0.85rem',
                        outline: 'none',
                        cursor: 'pointer',
                        color: 'var(--color-text)'
                      }}
                    >
                      {markets.map(m => <option key={m} value={m}>{m}</option>)}
                    </select>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontSize: '0.85rem', color: 'var(--color-muted)', fontWeight: 500 }}>产品品类</span>
                    <select
                      value={selectedProduct}
                      onChange={(e) => setSelectedProduct(e.target.value)}
                      style={{
                        padding: '6px 12px',
                        borderRadius: '10px',
                        border: 'none',
                        background: 'var(--bg-main)',
                        fontSize: '0.85rem',
                        outline: 'none',
                        cursor: 'pointer',
                        color: 'var(--color-text)'
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
                  className="sand-btn"
                  style={{
                    padding: '6px 18px',
                    fontSize: '0.8rem',
                    cursor: 'pointer'
                  }}
                >
                  重置筛选与聚焦
                </button>
              </div>

              {/* 聚焦提醒横幅 */}
              {focusNodeId && focusedNode && (
                <div style={{
                  padding: '10px 20px',
                  background: 'rgba(255, 100, 30, 0.05)',
                  borderRadius: '12px',
                  color: 'var(--color-accent)',
                  fontSize: '0.85rem',
                  marginBottom: '16px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center'
                }}>
                  <span>正在聚焦报告：<strong>{focusedNode.title}</strong> (只展示其一阶关联节点)</span>
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
          <NodeProfilePanel
            selectedNode={selectedNode}
            userRole={userRole}
            entityDetail={entityDetail}
            onRefreshGraph={refreshGraphData}
            onNodeSelectUpdate={(node) => setSelectedNode(node)}
            onFetchEntityDetail={fetchEntityDetail}
            onDeleteNodeSuccess={() => setSelectedNode(null)}
          />
        </div>

      </main>

      {/* 底部已解锁报告卡片区域 */}
      {unlockedReports && unlockedReports.length > 0 && (
        <section style={{
          maxWidth: '1400px',
          margin: '40px auto 80px auto',
          padding: '0 40px',
          width: '100%',
          boxSizing: 'border-box',
          zIndex: 10,
          position: 'relative'
        }}>
          <h3 style={{
            fontSize: '1.25rem',
            fontWeight: 400,
            color: '#0f172a',
            marginBottom: '20px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}>
            🔓 最近解锁的报告 (最多显示10篇)
          </h3>
          <ReportList
            reports={unlockedReports}
            userId={userId}
            userRole={userRole}
            quota={quota}
            onUnlockSuccess={() => {}}
          />
        </section>
      )}
    </div>
  );
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
    let unlockedReports: any[] = [];

    if (userId) {
      graphData = await getGraphData(userId, userRole, dbClient);

      if (userRole === 'admin') {
        const reportsRes = await dbClient.query(
          `SELECT id, title, category, market_region, summary, TRUE AS "isUnlocked" 
           FROM reports 
           ORDER BY created_at DESC 
           LIMIT 10`
        );
        unlockedReports = reportsRes.rows;
      } else {
        const reportsRes = await dbClient.query(
          `SELECT r.id, r.title, r.category, r.market_region, r.summary, TRUE AS "isUnlocked"
           FROM reports r
           JOIN unlocks u ON r.id = u.report_id
           WHERE u.user_id = $1
           ORDER BY u.created_at DESC
           LIMIT 10`,
          [userId]
        );
        unlockedReports = reportsRes.rows;
      }
    }

    return {
      props: {
        graphData,
        userId: userId || '',
        userRole,
        freeQuota,
        unlockedReports
      }
    };
  } catch (err) {
    console.error('SSR 加载个人图谱失败，原因:', err);
    return {
      props: {
        graphData: { nodes: [], links: [] },
        userId: '',
        userRole: 'guest',
        freeQuota: 0,
        unlockedReports: []
      }
    };
  } finally {
    dbClient.release();
  }
};
