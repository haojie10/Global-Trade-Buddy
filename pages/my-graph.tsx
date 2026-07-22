import { GetServerSideProps } from 'next';
import Head from 'next/head';
import React, { useState } from 'react';
import pool from '../lib/db';
import { resolveSsrAuth } from '../lib/ssr-auth';
import { getGraphData } from './api/user/graph';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { filterGraphData, GraphNode, GraphLink } from '../lib/graph-helpers';
const ObsidianGraph = dynamic(() => import('../components/ObsidianGraph'), {
  ssr: false,
  loading: () => <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--color-muted)' }}>图谱加载中...</div>
});
const NodeProfilePanel = dynamic(() => import('../components/NodeProfilePanel'), { ssr: false });
import ReportList from '../components/ReportList';
import { DEMO_GRAPH_DATA } from '../lib/demo-data';
import Navbar from '../components/Navbar';
import AuthModal from '../components/AuthModal';


interface MyGraphProps {
  graphData: {
    nodes: GraphNode[];
    links: GraphLink[];
  };
  userId: string;
  userRole: string;
  freeQuota: number;
  unlockedReports: any[];
  nickname?: string;
}

export default function MyGraphPage({ graphData, userId, userRole, freeQuota, unlockedReports: initialUnlockedReports, nickname }: MyGraphProps) {
  const [quota, setQuota] = useState(freeQuota);
  const [showAuthModal, setShowAuthModal] = useState(false);

  // 演示模式及样式微调状态
  // 去掉模拟演示，默认直接加载已解锁真实数据
  const [isDemoMode, setIsDemoMode] = useState(false);
  const [nodeSizeScale, setNodeSizeScale] = useState(0.5);
  const [lineWidthScale, setLineWidthScale] = useState(1.9);
  const [speedScale, setSpeedScale] = useState(0.0);
  const [customColors, setCustomColors] = useState<Record<string, string>>({
    competitor: '#ff641e',
    supplier: '#ff641e',
    operation: '#525252', // 深灰色实线 (经营关系)
    mention: '#a09b95'    // 浅灰色虚线 (涉及关系)
  });
  const [activeRelations, setActiveRelations] = useState<string[]>(['competitor', 'supplier', 'operation', 'mention']);

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
          border: '1px solid rgba(18, 18, 18, 0.08)',
          padding: '40px',
          borderRadius: 'var(--border-radius)',
          maxWidth: '480px',
          boxShadow: '0 10px 40px rgba(0, 0, 0, 0.01)'
        }}>
          <h2 style={{ fontSize: '1.5rem', fontWeight: 300, marginBottom: '16px' }}>暂未登录</h2>
          <p style={{ color: 'var(--color-muted)', fontSize: '0.9rem', marginBottom: '24px', lineHeight: 1.6 }}>
            游客模式下无法查看个人知识拓扑网图。请返回首页登录或注册账号后体验！
          </p>
          <Link 
            href="/" 
            className="sand-btn" 
            style={{ 
              padding: '10px 24px', 
              textDecoration: 'none', 
              display: 'flex', 
              alignItems: 'center', 
              gap: '6px', 
              justifyContent: 'center',
              background: 'transparent',
              border: '1px solid var(--color-accent)',
              color: 'var(--color-accent)',
              borderRadius: 'var(--border-radius)',
              transition: 'all 0.2s'
            }}
            onMouseOver={(e) => {
              e.currentTarget.style.background = 'rgba(255, 100, 30, 0.05)';
            }}
            onMouseOut={(e) => {
              e.currentTarget.style.background = 'transparent';
            }}
          >
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

  const activeGraphData = isDemoMode ? DEMO_GRAPH_DATA : currentGraphData;
  const hasData = activeGraphData.nodes && activeGraphData.nodes.length > 0;

  // 动态提取筛选选项
  // 动态提取筛选选项：对地区按逗号分割、扁平化提取，并过滤掉英文，只保留纯中文国家/地区选项
  const markets = hasData 
    ? [
        'All', 
        ...Array.from(
          new Set(
            activeGraphData.nodes
              .map(n => n.market_region)
              .filter(Boolean)
              .flatMap(rStr => rStr.split(',').map(r => r.trim()).filter(Boolean))
              .filter(region => /^[\u4e00-\u9fa5]+$/.test(region))
          )
        )
      ] 
    : ['All'];
  const products = hasData ? ['All', ...Array.from(new Set(activeGraphData.nodes.flatMap(n => n.products || []).filter(Boolean)))] : ['All'];

  // 过滤数据
  const filteredGraphData = hasData ? filterGraphData(
    activeGraphData.nodes,
    activeGraphData.links,
    selectedMarket,
    selectedProduct,
    focusNodeId
  ) : { nodes: [], links: [] };

  const focusedNode = hasData && focusNodeId ? activeGraphData.nodes.find(n => n.id === focusNodeId) : null;

  return (
    <div style={{
      background: 'transparent',
      color: 'var(--color-text)',
      minHeight: '100vh',
      display: 'flex',
      flexDirection: 'column',
      position: 'relative'
    }}>
      <Head>
        <title>个人知识图谱 | Market Graphic</title>
      </Head>
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
      />

      {/* 主体内容区（分左右两栏） */}
      <main className="graph-main-container">
        {/* 左栏：图谱面板 */}
        <div className="graph-left-col">
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
                backdropFilter: 'blur(15px)',
                WebkitBackdropFilter: 'blur(15px)',
                border: '1px solid rgba(18, 18, 18, 0.05)',
                borderRadius: 'var(--border-radius)',
                marginBottom: '16px',
                boxShadow: '0 6px 20px rgba(0, 0, 0, 0.01)',
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
                        borderRadius: 'var(--border-radius)',
                        border: '1px solid rgba(18, 18, 18, 0.08)',
                        background: 'rgba(255, 255, 255, 0.65)',
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
                        borderRadius: 'var(--border-radius)',
                        border: '1px solid rgba(18, 18, 18, 0.08)',
                        background: 'rgba(255, 255, 255, 0.65)',
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
                  borderRadius: 'var(--border-radius)',
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
            <div style={{ flex: 1, minHeight: 0, position: 'relative' }}>
              <ObsidianGraph
                data={filteredGraphData}
                onNodeSelect={(node) => {
                  setSelectedNode(node as any);
                }}
                onNodeDoubleClick={(node) => {
                  setFocusNodeId(node.id);
                }}
                nodeSizeScale={nodeSizeScale}
                lineWidthScale={lineWidthScale}
                speedScale={speedScale}
                customColors={customColors}
                activeRelations={activeRelations}
              />


            </div>
          ) : (
            <div style={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'center',
              alignItems: 'center',
              background: 'rgba(246, 246, 246, 0.85)',
              borderRadius: 'var(--border-radius)',
              border: '1px solid rgba(18, 18, 18, 0.08)',
              backdropFilter: 'blur(30px)',
              padding: '40px',
              textAlign: 'center',
              boxShadow: '0 12px 40px 0 rgba(0, 0, 0, 0.01)'
            }}>
              <div 
                style={{
                  width: '72px',
                  height: '72px',
                  marginBottom: '28px',
                  background: 'linear-gradient(135deg, var(--color-accent) 0%, #ff884d 100%)',
                  borderRadius: 'var(--border-radius)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  boxShadow: '0 8px 24px rgba(255, 100, 30, 0.15)'
                }}
              >
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M4.5 16.5c-1.5 1.26-2.5 3.19-2.5 5.5h20c0-2.31-1-4.24-2.5-5.5" />
                  <circle cx="12" cy="12" r="2" />
                  <circle cx="12" cy="2" r="1" />
                  <circle cx="4" cy="16" r="1" />
                  <circle cx="20" cy="16" r="1" />
                </svg>
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
                marginBottom: '0px'
              }}>
                您的个人知识拓扑网络目前还是空的。在这里，您可以通过在报告大厅解锁和阅读行业客户与品类报告，自动生成互相关联的实体知识卡片网络，帮您洞察跨区域客户之间的隐藏商机。
              </p>
            </div>
          )}
        </div>

        {/* 右栏：外贸便捷小工具面板 */}
        <div className="graph-right-col">
          <NodeProfilePanel
            selectedNode={selectedNode}
            userRole={userRole}
            entityDetail={entityDetail}
            onRefreshGraph={refreshGraphData}
            onNodeSelectUpdate={(node) => setSelectedNode(node)}
            onFetchEntityDetail={fetchEntityDetail}
            onDeleteNodeSuccess={() => setSelectedNode(null)}
            allNodes={activeGraphData.nodes}
            userId={userId}
            quota={quota}
            onQuotaChange={(q) => setQuota(q)}
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
            你的报告
          </h3>
          <ReportList
            reports={unlockedReports}
            userId={userId}
            userRole={userRole}
            quota={quota}
            onUnlockSuccess={() => {}}
            onDeleteReport={(reportId) => {
              setUnlockedReports(prev => prev.filter(r => r.id !== reportId));
            }}
            onFavoriteToggle={(reportId, isFavorited) => {
              setUnlockedReports(prev => prev.map(r => r.id === reportId ? { ...r, isFavorited } : r));
            }}
          />
        </section>
      )}
      <AuthModal
        isOpen={showAuthModal}
        onClose={() => setShowAuthModal(false)}
      />
    </div>
  );
}

// SSR 加载个人知识图谱数据
export const getServerSideProps: GetServerSideProps = async (context) => {
  let dbClient: any = null;

  try {
    dbClient = await pool.connect();
    const auth = await resolveSsrAuth(context, dbClient);
    const userId = auth.userId;
    const userRole = auth.userRole;
    const freeQuota = auth.freeQuota;
    const nickname = auth.nickname;

    let graphData: any = { nodes: [], links: [] };
    let unlockedReports: any[] = [];

    if (userId) {
      graphData = await getGraphData(userId, userRole, dbClient);

      if (userRole === 'admin') {
        const reportsRes = await dbClient.query(
          `SELECT r.id, r.title, r.category, r.market_region, r.summary, TRUE AS "isUnlocked",
                  EXISTS(SELECT 1 FROM favorites f WHERE f.user_id = $1 AND f.report_id = r.id) as is_favorited
           FROM reports r
           ORDER BY r.created_at DESC 
           LIMIT 10`,
          [userId]
        );
        unlockedReports = reportsRes.rows.map((row: any) => ({
          id: row.id,
          title: row.title,
          category: row.category,
          market_region: row.market_region,
          summary: row.summary,
          isUnlocked: true,
          isFavorited: row.is_favorited
        }));
      } else {
        const reportsRes = await dbClient.query(
          `SELECT r.id, r.title, r.category, r.market_region, r.summary, TRUE AS "isUnlocked",
                  EXISTS(SELECT 1 FROM favorites f WHERE f.user_id = $1 AND f.report_id = r.id) as is_favorited
           FROM reports r
           JOIN unlocks u ON r.id = u.report_id
           WHERE u.user_id = $1
           ORDER BY u.unlocked_at DESC
           LIMIT 10`,
          [userId]
        );
        unlockedReports = reportsRes.rows.map((row: any) => ({
          id: row.id,
          title: row.title,
          category: row.category,
          market_region: row.market_region,
          summary: row.summary,
          isUnlocked: true,
          isFavorited: row.is_favorited
        }));
      }
    }

    return {
      props: {
        graphData,
        userId: userId || '',
        userRole,
        freeQuota,
        unlockedReports,
        nickname
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
        unlockedReports: [],
        nickname: ''
      }
    };
  } finally {
    if (dbClient) {
      dbClient.release();
    }
  }
};
