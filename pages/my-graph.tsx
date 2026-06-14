import { GetServerSideProps } from 'next';
import React, { useState } from 'react';
import pool from '../lib/db';
import { parseCookies } from '../lib/cookies';
import { getUserGraph, getGraphData } from './api/user/graph';
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

  // 新增：实体详情、关系输入状态及图谱动态数据源
  const [currentGraphData, setCurrentGraphData] = useState(graphData);
  const [entityDetail, setEntityDetail] = useState<any>(null);
  const [newAlias, setNewAlias] = useState('');
  const [newCompetitor, setNewCompetitor] = useState('');
  const [newSupplier, setNewSupplier] = useState('');
  const [marketRegion, setMarketRegion] = useState('');

  // 报告关联实体表单输入状态
  const [newReportCompany, setNewReportCompany] = useState('');
  const [newReportProduct, setNewReportProduct] = useState('');
  const [newReportChannel, setNewReportChannel] = useState('');

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

  // 3. 处理添加/合并别名
  const handleMergeAlias = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAlias.trim() || !selectedNode) return;
    try {
      const res = await fetch('/api/admin/entities/merge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          targetEntityId: selectedNode.id,
          aliasName: newAlias.trim()
        })
      });
      if (res.ok) {
        alert('别名合并成功！');
        setNewAlias('');
        await fetchEntityDetail(selectedNode.id);
        await refreshGraphData();
      } else {
        const data = await res.json();
        alert(data.error || '合并失败');
      }
    } catch (err: any) {
      alert(err.message);
    }
  };

  // 4. 处理添加关系（竞争对手、合作伙伴）
  const handleAddRelation = async (e: React.FormEvent, relationType: 'competitor' | 'supplier') => {
    e.preventDefault();
    const relatedName = relationType === 'competitor' ? newCompetitor : newSupplier;
    if (!relatedName.trim() || !selectedNode) return;

    try {
      const res = await fetch('/api/admin/entities/relation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          entityIdA: selectedNode.id,
          relatedEntityName: relatedName.trim(),
          relationType,
          marketRegion: marketRegion.trim() || null
        })
      });
      if (res.ok) {
        alert('关系添加成功！');
        if (relationType === 'competitor') setNewCompetitor('');
        else setNewSupplier('');
        setMarketRegion('');
        await fetchEntityDetail(selectedNode.id);
        await refreshGraphData();
      } else {
        const data = await res.json();
        alert(data.error || '添加关系失败');
      }
    } catch (err: any) {
      alert(err.message);
    }
  };

  // 5. 处理报告打标（关联品牌、品类和渠道）
  const handleTagReport = async (e: React.FormEvent, entityType: 'company' | 'product' | 'channel') => {
    e.preventDefault();
    if (!selectedNode) return;

    let entityName = '';
    if (entityType === 'company') entityName = newReportCompany;
    else if (entityType === 'product') entityName = newReportProduct;
    else if (entityType === 'channel') entityName = newReportChannel;

    if (!entityName.trim()) return;

    try {
      const res = await fetch('/api/admin/reports/tag', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reportId: selectedNode.id,
          entityName: entityName.trim(),
          entityType
        })
      });

      if (res.ok) {
        alert('关联实体成功！');
        if (entityType === 'company') setNewReportCompany('');
        else if (entityType === 'product') setNewReportProduct('');
        else if (entityType === 'channel') setNewReportChannel('');

        await refreshGraphData();
        
        // 动态更新 selectedNode state，让右侧详情列表立刻呈现已绑定的实体
        setSelectedNode((prev: any) => {
          if (!prev) return null;
          const next = { ...prev };
          if (entityType === 'company') {
            next.companies = [...(prev.companies || []), entityName.trim()];
          } else if (entityType === 'product') {
            next.products = [...(prev.products || []), entityName.trim()];
          } else if (entityType === 'channel') {
            next.channels = [...(prev.channels || []), entityName.trim()];
          }
          return next;
        });
      } else {
        const data = await res.json();
        alert(data.error || '关联失败');
      }
    } catch (err: any) {
      alert(err.message);
    }
  };

  // 6. 处理管理员删除图谱节点（报告/公司等实体）
  const handleDeleteNode = async () => {
    if (!selectedNode) return;
    const isReport = selectedNode.node_type === 'report';
    const confirmMsg = isReport 
      ? `⚠️ 您确定要永久删除报告【${selectedNode.title}】吗？\n删除后该报告的所有解锁数据、笔记、收藏以及关联边线都将随之丢失，此操作不可恢复！`
      : `⚠️ 您确定要永久删除该实体【${selectedNode.title}】吗？\n删除后该实体的别名、关联线、竞争或供应商关系都将一并删除，此操作不可恢复！`;

    if (!window.confirm(confirmMsg)) return;

    try {
      const res = await fetch('/api/admin/delete-node', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: selectedNode.id,
          nodeType: selectedNode.node_type
        })
      });

      if (res.ok) {
        alert('删除成功！');
        setSelectedNode(null); // 清理选中状态以关闭侧边栏
        await refreshGraphData(); // 立即重新拉取并更新图谱
      } else {
        const data = await res.json();
        alert(data.error || '删除失败');
      }
    } catch (err: any) {
      alert('请求网络失败：' + err.message);
    }
  };

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
                selectedNode.node_type === 'entity' && selectedNode.entity_type === 'company' ? (
                  /* 🏢 公司/渠道 商业画像面板 */
                  <div style={{
                    background: 'rgba(255, 255, 255, 0.65)',
                    backdropFilter: 'blur(10px)',
                    borderRadius: '20px',
                    border: '1px solid rgba(15, 23, 42, 0.06)',
                    padding: '24px',
                    boxShadow: '0 8px 32px 0 rgba(31, 38, 135, 0.04)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '20px'
                  }}>
                    <div>
                      <div style={{ fontSize: '0.75rem', color: '#3b82f6', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>🏢 商业实体画像</div>
                      <h4 style={{ margin: '4px 0 0 0', fontSize: '1.25rem', color: '#0f172a', fontWeight: 700 }}>
                        {selectedNode.title}
                      </h4>
                    </div>

                    {/* 1. 同义别称 (Aliases) */}
                    <div style={{ borderTop: '1px solid rgba(15, 23, 42, 0.06)', paddingTop: '14px' }}>
                      <div style={{ fontSize: '0.8rem', color: '#475569', fontWeight: 600, marginBottom: '8px' }}>🏷️ 同义别称 (别名)</div>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '12px' }}>
                        {entityDetail?.aliases && entityDetail.aliases.length > 0 ? (
                          entityDetail.aliases.map((a: string, i: number) => (
                            <span key={i} style={{
                              background: 'rgba(148, 163, 184, 0.08)',
                              color: '#64748b',
                              border: '1px solid rgba(148, 163, 184, 0.15)',
                              padding: '4px 10px',
                              borderRadius: '12px',
                              fontSize: '0.75rem',
                              fontWeight: 500
                            }}>
                              {a}
                            </span>
                          ))
                        ) : (
                          <span style={{ fontSize: '0.75rem', color: '#94a3b8', fontStyle: 'italic' }}>暂无其他别名</span>
                        )}
                      </div>
                      <form onSubmit={handleMergeAlias} style={{ display: 'flex', gap: '8px' }}>
                        <input
                          type="text"
                          placeholder="输入新别称，如：儿童世界"
                          value={newAlias}
                          onChange={(e) => setNewAlias(e.target.value)}
                          style={{
                            flex: 1,
                            padding: '6px 12px',
                            fontSize: '0.8rem',
                            border: '1px solid rgba(15, 23, 42, 0.1)',
                            borderRadius: '8px',
                            outline: 'none',
                            background: 'rgba(255,255,255,0.8)'
                          }}
                        />
                        <button type="submit" className="water-drop-btn" style={{ padding: '6px 12px', fontSize: '0.75rem', fontWeight: 600 }}>绑定别名</button>
                      </form>
                    </div>

                    {/* 2. ⚡ 竞争对手 */}
                    <div style={{ borderTop: '1px solid rgba(15, 23, 42, 0.06)', paddingTop: '14px' }}>
                      <div style={{ fontSize: '0.8rem', color: '#ef4444', fontWeight: 600, marginBottom: '8px' }}>⚡ 竞争对手关系网</div>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '12px' }}>
                        {entityDetail?.competitors && entityDetail.competitors.length > 0 ? (
                          entityDetail.competitors.map((c: any, i: number) => (
                            <span key={i} style={{
                              background: 'rgba(239, 68, 68, 0.06)',
                              color: '#ef4444',
                              border: '1px solid rgba(239, 68, 68, 0.15)',
                              padding: '4px 10px',
                              borderRadius: '12px',
                              fontSize: '0.75rem',
                              fontWeight: 500
                            }}>
                              {c.name} {c.market ? `(${c.market})` : ''}
                            </span>
                          ))
                        ) : (
                          <span style={{ fontSize: '0.75rem', color: '#94a3b8', fontStyle: 'italic' }}>暂无竞争对手记录</span>
                        )}
                      </div>
                      <form onSubmit={(e) => handleAddRelation(e, 'competitor')} style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        <div style={{ display: 'flex', gap: '8px' }}>
                          <input
                            type="text"
                            placeholder="输入竞争对手，如：Wildberries"
                            value={newCompetitor}
                            onChange={(e) => setNewCompetitor(e.target.value)}
                            style={{
                              flex: 1,
                              padding: '6px 12px',
                              fontSize: '0.8rem',
                              border: '1px solid rgba(15, 23, 42, 0.1)',
                              borderRadius: '8px',
                              outline: 'none',
                              background: 'rgba(255,255,255,0.8)'
                            }}
                          />
                          <input
                            type="text"
                            placeholder="地区 (可选)"
                            value={marketRegion}
                            onChange={(e) => setMarketRegion(e.target.value)}
                            style={{
                              width: '100px',
                              padding: '6px 12px',
                              fontSize: '0.8rem',
                              border: '1px solid rgba(15, 23, 42, 0.1)',
                              borderRadius: '8px',
                              outline: 'none',
                              background: 'rgba(255,255,255,0.8)'
                            }}
                          />
                        </div>
                        <button type="submit" className="water-drop-btn" style={{ padding: '6px 12px', fontSize: '0.75rem', fontWeight: 600, background: '#ef4444', border: '1px solid #ef4444', color: '#fff', alignSelf: 'flex-end' }}>添加竞争对手</button>
                      </form>
                    </div>

                    {/* 3. 🤝 供应商与合作伙伴 */}
                    <div style={{ borderTop: '1px solid rgba(15, 23, 42, 0.06)', paddingTop: '14px' }}>
                      <div style={{ fontSize: '0.8rem', color: '#2563eb', fontWeight: 600, marginBottom: '8px' }}>🤝 合作商与供应商</div>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '12px' }}>
                        {entityDetail?.suppliers && entityDetail.suppliers.length > 0 ? (
                          entityDetail.suppliers.map((s: any, i: number) => (
                            <span key={i} style={{
                              background: 'rgba(37, 99, 235, 0.06)',
                              color: '#2563eb',
                              border: '1px solid rgba(37, 99, 235, 0.15)',
                              padding: '4px 10px',
                              borderRadius: '12px',
                              fontSize: '0.75rem',
                              fontWeight: 500
                            }}>
                              {s.name} {s.market ? `(${s.market})` : ''}
                            </span>
                          ))
                        ) : (
                          <span style={{ fontSize: '0.75rem', color: '#94a3b8', fontStyle: 'italic' }}>暂无合作伙伴记录</span>
                        )}
                      </div>
                      <form onSubmit={(e) => handleAddRelation(e, 'supplier')} style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        <div style={{ display: 'flex', gap: '8px' }}>
                          <input
                            type="text"
                            placeholder="输入供应商，如：A公司"
                            value={newSupplier}
                            onChange={(e) => setNewSupplier(e.target.value)}
                            style={{
                              flex: 1,
                              padding: '6px 12px',
                              fontSize: '0.8rem',
                              border: '1px solid rgba(15, 23, 42, 0.1)',
                              borderRadius: '8px',
                              outline: 'none',
                              background: 'rgba(255,255,255,0.8)'
                            }}
                          />
                          <input
                            type="text"
                            placeholder="地区 (可选)"
                            value={marketRegion}
                            onChange={(e) => setMarketRegion(e.target.value)}
                            style={{
                              width: '100px',
                              padding: '6px 12px',
                              fontSize: '0.8rem',
                              border: '1px solid rgba(15, 23, 42, 0.1)',
                              borderRadius: '8px',
                              outline: 'none',
                              background: 'rgba(255,255,255,0.8)'
                            }}
                          />
                        </div>
                        <button type="submit" className="water-drop-btn" style={{ padding: '6px 12px', fontSize: '0.75rem', fontWeight: 600, alignSelf: 'flex-end' }}>添加合作伙伴</button>
                      </form>
                    </div>

                    {/* 管理员专有删除按钮 */}
                    {userRole === 'admin' && (
                      <div style={{ borderTop: '1px solid rgba(239, 68, 68, 0.1)', paddingTop: '16px', marginTop: '8px', display: 'flex', justifyContent: 'flex-end' }}>
                        <button
                          onClick={handleDeleteNode}
                          style={{
                            background: 'rgba(239, 68, 68, 0.08)',
                            color: '#ef4444',
                            border: '1px solid rgba(239, 68, 68, 0.25)',
                            borderRadius: '20px',
                            padding: '6px 16px',
                            fontSize: '0.8rem',
                            fontWeight: 600,
                            cursor: 'pointer',
                            transition: 'all 0.2s',
                            width: '100%'
                          }}
                          onMouseOver={(e) => { e.currentTarget.style.background = '#ef4444'; e.currentTarget.style.color = '#fff'; }}
                          onMouseOut={(e) => { e.currentTarget.style.background = 'rgba(239, 68, 68, 0.08)'; e.currentTarget.style.color = '#ef4444'; }}
                        >
                          🗑️ 永久删除此公司实体
                        </button>
                      </div>
                    )}
                  </div>
                ) : (
                  /* 📄 报告 详情面板（原逻辑） */
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
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '8px' }}>
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
                      <form onSubmit={(e) => handleTagReport(e, 'company')} style={{ display: 'flex', gap: '8px' }}>
                        <input
                          type="text"
                          placeholder="关联新品牌，如：Wildberries"
                          value={newReportCompany}
                          onChange={(e) => setNewReportCompany(e.target.value)}
                          style={{
                            flex: 1,
                            padding: '6px 12px',
                            fontSize: '0.8rem',
                            border: '1px solid rgba(15, 23, 42, 0.1)',
                            borderRadius: '8px',
                            outline: 'none',
                            background: 'rgba(255,255,255,0.8)'
                          }}
                        />
                        <button type="submit" className="water-drop-btn" style={{ padding: '6px 12px', fontSize: '0.75rem', fontWeight: 600 }}>关联</button>
                      </form>
                    </div>

                    {/* 涉及品类 */}
                    <div>
                      <div style={{ fontSize: '0.8rem', color: '#475569', fontWeight: 600, marginBottom: '6px' }}>📦 涉及品类</div>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '8px' }}>
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
                      <form onSubmit={(e) => handleTagReport(e, 'product')} style={{ display: 'flex', gap: '8px' }}>
                        <input
                          type="text"
                          placeholder="关联新品类，如：刹车片"
                          value={newReportProduct}
                          onChange={(e) => setNewReportProduct(e.target.value)}
                          style={{
                            flex: 1,
                            padding: '6px 12px',
                            fontSize: '0.8rem',
                            border: '1px solid rgba(15, 23, 42, 0.1)',
                            borderRadius: '8px',
                            outline: 'none',
                            background: 'rgba(255,255,255,0.8)'
                          }}
                        />
                        <button type="submit" className="water-drop-btn" style={{ padding: '6px 12px', fontSize: '0.75rem', fontWeight: 600 }}>关联</button>
                      </form>
                    </div>

                    {/* 覆盖渠道 */}
                    <div>
                      <div style={{ fontSize: '0.8rem', color: '#475569', fontWeight: 600, marginBottom: '6px' }}>🛣️ 覆盖渠道</div>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '8px' }}>
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
                      <form onSubmit={(e) => handleTagReport(e, 'channel')} style={{ display: 'flex', gap: '8px' }}>
                        <input
                          type="text"
                          placeholder="关联新渠道，如：配件超市"
                          value={newReportChannel}
                          onChange={(e) => setNewReportChannel(e.target.value)}
                          style={{
                            flex: 1,
                            padding: '6px 12px',
                            fontSize: '0.8rem',
                            border: '1px solid rgba(15, 23, 42, 0.1)',
                            borderRadius: '8px',
                            outline: 'none',
                            background: 'rgba(255,255,255,0.8)'
                          }}
                        />
                        <button type="submit" className="water-drop-btn" style={{ padding: '6px 12px', fontSize: '0.75rem', fontWeight: 600 }}>关联</button>
                      </form>
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

                    {/* 管理员专有删除按钮 */}
                    {userRole === 'admin' && (
                      <div style={{ borderTop: '1px solid rgba(239, 68, 68, 0.1)', paddingTop: '16px', marginTop: '12px' }}>
                        <button
                          onClick={handleDeleteNode}
                          style={{
                            background: 'rgba(239, 68, 68, 0.08)',
                            color: '#ef4444',
                            border: '1px solid rgba(239, 68, 68, 0.25)',
                            borderRadius: '20px',
                            padding: '10px 0',
                            fontSize: '0.85rem',
                            fontWeight: 600,
                            cursor: 'pointer',
                            transition: 'all 0.2s',
                            width: '100%'
                          }}
                          onMouseOver={(e) => { e.currentTarget.style.background = '#ef4444'; e.currentTarget.style.color = '#fff'; }}
                          onMouseOut={(e) => { e.currentTarget.style.background = 'rgba(239, 68, 68, 0.08)'; e.currentTarget.style.color = '#ef4444'; }}
                        >
                          🗑️ 永久删除此报告
                        </button>
                      </div>
                    )}
                  </div>
                )
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

    if (userId) {
      graphData = await getGraphData(userId, userRole, dbClient);
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
