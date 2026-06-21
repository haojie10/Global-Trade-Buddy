import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { GraphNode } from '../lib/graph-helpers';

interface NodeProfilePanelProps {
  selectedNode: GraphNode | null;
  userRole: string;
  entityDetail: any;
  onRefreshGraph: () => Promise<void>;
  onNodeSelectUpdate: (node: any) => void;
  onFetchEntityDetail: (entityId: string) => Promise<void>;
  onDeleteNodeSuccess: () => void;
}

export default function NodeProfilePanel({
  selectedNode,
  userRole,
  entityDetail,
  onRefreshGraph,
  onNodeSelectUpdate,
  onFetchEntityDetail,
  onDeleteNodeSuccess
}: NodeProfilePanelProps) {
  const [newAlias, setNewAlias] = useState('');
  const [newCompetitor, setNewCompetitor] = useState('');
  const [newSupplier, setNewSupplier] = useState('');
  const [marketRegion, setMarketRegion] = useState('');

  const [newReportCompany, setNewReportCompany] = useState('');
  const [newReportProduct, setNewReportProduct] = useState('');
  const [newReportChannel, setNewReportChannel] = useState('');

  // 监听 selectedNode 的变化，清空子组件内部输入状态
  useEffect(() => {
    setNewAlias('');
    setNewCompetitor('');
    setNewSupplier('');
    setMarketRegion('');
    setNewReportCompany('');
    setNewReportProduct('');
    setNewReportChannel('');
  }, [selectedNode]);

  if (!selectedNode) {
    return (
      <div style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '40px 20px',
        textAlign: 'center',
        color: 'var(--color-muted)'
      }}>
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="var(--color-accent)" strokeWidth="1.25" strokeLinecap="round" strokeLinejoin="round" style={{ marginBottom: '16px' }}>
          <path d="M15 14c.2-1 .7-1.7 1.5-2.5 1-.9 1.5-2.2 1.5-3.5A5 5 0 0 0 8 8c0 1 .3 2.2 1.5 3.5.7.7 1.3 1.5 1.5 2.5" />
          <line x1="9" y1="18" x2="15" y2="18" />
          <line x1="10" y1="22" x2="14" y2="22" />
        </svg>
        <p style={{ margin: 0, fontSize: '0.85rem', lineHeight: 1.6, color: 'var(--color-muted)' }}>
          点击图谱中的任意报告节点，即可在此查看该报告的智能商业画像与核心供需实体线索。
        </p>
      </div>
    );
  }

  const handleMergeAlias = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAlias.trim()) return;
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
        await onFetchEntityDetail(selectedNode.id);
        await onRefreshGraph();
      } else {
        const data = await res.json();
        alert(data.error || '合并失败');
      }
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleAddRelation = async (e: React.FormEvent, relationType: 'competitor' | 'supplier') => {
    e.preventDefault();
    const relatedName = relationType === 'competitor' ? newCompetitor : newSupplier;
    if (!relatedName.trim()) return;

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
        await onFetchEntityDetail(selectedNode.id);
        await onRefreshGraph();
      } else {
        const data = await res.json();
        alert(data.error || '添加关系失败');
      }
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleTagReport = async (e: React.FormEvent, entityType: 'company' | 'product' | 'channel') => {
    e.preventDefault();
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

        await onRefreshGraph();
        
        // 触发父级状态更新
        const next = { ...selectedNode };
        if (entityType === 'company') {
          next.companies = [...(selectedNode.companies || []), entityName.trim()];
        } else if (entityType === 'product') {
          next.products = [...(selectedNode.products || []), entityName.trim()];
        } else if (entityType === 'channel') {
          next.channels = [...(selectedNode.channels || []), entityName.trim()];
        }
        onNodeSelectUpdate(next);
      } else {
        const data = await res.json();
        alert(data.error || '关联失败');
      }
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleDeleteNode = async () => {
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
        onDeleteNodeSuccess();
        await onRefreshGraph();
      } else {
        const data = await res.json();
        alert(data.error || '删除失败');
      }
    } catch (err: any) {
      alert('请求网络失败：' + err.message);
    }
  };

  const isCompany = selectedNode.node_type === 'entity' && selectedNode.entity_type === 'company';

  return (
    <div style={{ flex: 1, padding: '20px', overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>
      {isCompany ? (
        /* 公司/渠道 商业画像面板 */
        <div style={{
          background: 'var(--bg-sub)',
          borderRadius: 'var(--border-radius)',
          border: 'none',
          padding: '24px',
          boxShadow: '0 6px 20px rgba(160, 109, 68, 0.015)',
          display: 'flex',
          flexDirection: 'column',
          gap: '20px'
        }}>
          <div>
            <div style={{ fontSize: '0.75rem', color: 'var(--color-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>商业实体画像</div>
            <h4 style={{ margin: '4px 0 0 0', fontSize: '1.25rem', color: 'var(--color-text)', fontWeight: 700 }}>
              {selectedNode.title}
            </h4>
          </div>

          {/* 1. 同义别称 */}
          <div style={{ borderTop: '1px solid rgba(160, 109, 68, 0.08)', paddingTop: '14px' }}>
            <div style={{ fontSize: '0.8rem', color: 'var(--color-text)', fontWeight: 600, marginBottom: '8px' }}>同义别称 (别名)</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '12px' }}>
              {entityDetail?.aliases && entityDetail.aliases.length > 0 ? (
                entityDetail.aliases.map((a: string, i: number) => (
                  <span key={i} style={{
                    background: 'var(--bg-main)',
                    color: 'var(--color-muted)',
                    border: 'none',
                    padding: '4px 10px',
                    borderRadius: '12px',
                    fontSize: '0.75rem',
                    fontWeight: 500
                  }}>
                    {a}
                  </span>
                ))
              ) : (
                <span style={{ fontSize: '0.75rem', color: 'var(--color-muted)', fontStyle: 'italic' }}>暂无其他别名</span>
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
                  padding: '8px 14px',
                  fontSize: '0.8rem',
                  border: 'none',
                  borderRadius: '12px',
                  outline: 'none',
                  background: 'var(--bg-main)',
                  color: 'var(--color-text)',
                  boxShadow: '0 2px 8px rgba(160, 109, 68, 0.015)'
                }}
              />
              <button type="submit" className="water-drop-btn" style={{ padding: '6px 12px', fontSize: '0.75rem', fontWeight: 600 }}>绑定别名</button>
            </form>
          </div>

          {/* 2. 竞争对手 */}
          <div style={{ borderTop: '1px solid rgba(160, 109, 68, 0.08)', paddingTop: '14px' }}>
            <div style={{ fontSize: '0.8rem', color: 'var(--color-text)', fontWeight: 600, marginBottom: '8px' }}>竞争对手关系网</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '12px' }}>
              {entityDetail?.competitors && entityDetail.competitors.length > 0 ? (
                entityDetail.competitors.map((c: any, i: number) => (
                  <span key={i} style={{
                    background: 'var(--bg-main)',
                    color: 'var(--color-muted)',
                    border: 'none',
                    padding: '4px 10px',
                    borderRadius: '12px',
                    fontSize: '0.75rem',
                    fontWeight: 500
                  }}>
                    {c.name} {c.market ? `(${c.market})` : ''}
                  </span>
                ))
              ) : (
                <span style={{ fontSize: '0.75rem', color: 'var(--color-muted)', fontStyle: 'italic' }}>暂无竞争对手记录</span>
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
                    padding: '8px 14px',
                    fontSize: '0.8rem',
                    border: 'none',
                    borderRadius: '12px',
                    outline: 'none',
                    background: 'var(--bg-main)',
                    color: 'var(--color-text)',
                    boxShadow: '0 2px 8px rgba(160, 109, 68, 0.015)'
                  }}
                />
                <input
                  type="text"
                  placeholder="地区 (可选)"
                  value={marketRegion}
                  onChange={(e) => setMarketRegion(e.target.value)}
                  style={{
                    width: '100px',
                    padding: '8px 14px',
                    fontSize: '0.8rem',
                    border: 'none',
                    borderRadius: '12px',
                    outline: 'none',
                    background: 'var(--bg-main)',
                    color: 'var(--color-text)',
                    boxShadow: '0 2px 8px rgba(160, 109, 68, 0.015)'
                  }}
                />
              </div>
              <button type="submit" className="water-drop-btn" style={{ padding: '6px 12px', fontSize: '0.75rem', fontWeight: 600, background: 'var(--color-accent)', border: 'none', color: '#fff', alignSelf: 'flex-end', boxShadow: '0 4px 12px rgba(255, 100, 30, 0.15)' }}>添加竞争对手</button>
            </form>
          </div>

          {/* 3. 供应商与合作伙伴 */}
          <div style={{ borderTop: '1px solid rgba(160, 109, 68, 0.08)', paddingTop: '14px' }}>
            <div style={{ fontSize: '0.8rem', color: 'var(--color-text)', fontWeight: 600, marginBottom: '8px' }}>合作商与供应商</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '12px' }}>
              {entityDetail?.suppliers && entityDetail.suppliers.length > 0 ? (
                entityDetail.suppliers.map((s: any, i: number) => (
                  <span key={i} style={{
                    background: 'var(--bg-main)',
                    color: 'var(--color-muted)',
                    border: 'none',
                    padding: '4px 10px',
                    borderRadius: '12px',
                    fontSize: '0.75rem',
                    fontWeight: 500
                  }}>
                    {s.name} {s.market ? `(${s.market})` : ''}
                  </span>
                ))
              ) : (
                <span style={{ fontSize: '0.75rem', color: 'var(--color-muted)', fontStyle: 'italic' }}>暂无合作伙伴记录</span>
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
                    padding: '8px 14px',
                    fontSize: '0.8rem',
                    border: 'none',
                    borderRadius: '12px',
                    outline: 'none',
                    background: 'var(--bg-main)',
                    color: 'var(--color-text)',
                    boxShadow: '0 2px 8px rgba(160, 109, 68, 0.015)'
                  }}
                />
                <input
                  type="text"
                  placeholder="地区 (可选)"
                  value={marketRegion}
                  onChange={(e) => setMarketRegion(e.target.value)}
                  style={{
                    width: '100px',
                    padding: '8px 14px',
                    fontSize: '0.8rem',
                    border: 'none',
                    borderRadius: '12px',
                    outline: 'none',
                    background: 'var(--bg-main)',
                    color: 'var(--color-text)',
                    boxShadow: '0 2px 8px rgba(160, 109, 68, 0.015)'
                  }}
                />
              </div>
              <button type="submit" className="water-drop-btn" style={{ padding: '6px 12px', fontSize: '0.75rem', fontWeight: 600, alignSelf: 'flex-end', background: 'var(--color-accent)', border: 'none', color: '#fff', boxShadow: '0 4px 12px rgba(255, 100, 30, 0.15)' }}>添加合作伙伴</button>
            </form>
          </div>

          {/* 管理员专有删除 */}
          {userRole === 'admin' && (
            <div style={{ borderTop: '1px solid rgba(239, 68, 68, 0.1)', paddingTop: '16px', marginTop: '8px', display: 'flex', justifyContent: 'flex-end' }}>
              <button
                onClick={handleDeleteNode}
                style={{
                  background: 'rgba(239, 68, 68, 0.08)',
                  color: '#ef4444',
                  border: 'none',
                  borderRadius: '22px',
                  padding: '10px 16px',
                  fontSize: '0.8rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  width: '100%'
                }}
              >
                永久删除此公司实体
              </button>
            </div>
          )}
        </div>
      ) : (
        /* 报告 详情面板 */
        <div style={{
          background: 'var(--bg-sub)',
          borderRadius: 'var(--border-radius)',
          border: 'none',
          padding: '24px',
          boxShadow: '0 6px 20px rgba(160, 109, 68, 0.015)',
          display: 'flex',
          flexDirection: 'column',
          gap: '16px'
        }}>
          <div>
            <h4 style={{ margin: '0 0 6px 0', fontSize: '1.1rem', color: 'var(--color-text)', fontWeight: 600, lineHeight: 1.4 }}>
              {selectedNode.title}
            </h4>
            <span style={{ fontSize: '0.8rem', color: 'var(--color-muted)' }}>报告 ID: {selectedNode.id.substring(0, 8)}...</span>
          </div>

          {/* 国家/市场 */}
          <div>
            <div style={{ fontSize: '0.8rem', color: 'var(--color-text)', fontWeight: 600, marginBottom: '6px' }}>所涉国家/市场</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
              {selectedNode.market_region ? (
                <span style={{
                  background: 'var(--bg-main)',
                  color: 'var(--color-muted)',
                  border: 'none',
                  padding: '4px 10px',
                  borderRadius: '12px',
                  fontSize: '0.75rem',
                  fontWeight: 500
                }}>
                  {selectedNode.market_region}
                </span>
              ) : (
                <span style={{ fontSize: '0.75rem', color: 'var(--color-muted)' }}>暂无</span>
              )}
            </div>
          </div>

          {/* 经营玩家/品牌 */}
          <div>
            <div style={{ fontSize: '0.8rem', color: 'var(--color-text)', fontWeight: 600, marginBottom: '6px' }}>经营玩家/品牌</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '8px' }}>
              {selectedNode.companies && selectedNode.companies.length > 0 ? (
                selectedNode.companies.map((c, i) => (
                  <span key={i} style={{
                    background: 'var(--bg-main)',
                    color: 'var(--color-muted)',
                    border: 'none',
                    padding: '4px 10px',
                    borderRadius: '12px',
                    fontSize: '0.75rem',
                    fontWeight: 500
                  }}>
                    {c}
                  </span>
                ))
              ) : (
                <span style={{ fontSize: '0.75rem', color: 'var(--color-muted)' }}>暂无</span>
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
                  padding: '8px 14px',
                  fontSize: '0.8rem',
                  border: 'none',
                  borderRadius: '12px',
                  outline: 'none',
                  background: 'var(--bg-main)',
                  color: 'var(--color-text)',
                  boxShadow: '0 2px 8px rgba(160, 109, 68, 0.015)'
                }}
              />
              <button type="submit" className="water-drop-btn" style={{ padding: '6px 12px', fontSize: '0.75rem', fontWeight: 600 }}>关联</button>
            </form>
          </div>

          {/* 涉及品类 */}
          <div>
            <div style={{ fontSize: '0.8rem', color: 'var(--color-text)', fontWeight: 600, marginBottom: '6px' }}>涉及品类</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '8px' }}>
              {selectedNode.products && selectedNode.products.length > 0 ? (
                selectedNode.products.map((p, i) => (
                  <span key={i} style={{
                    background: 'var(--bg-main)',
                    color: 'var(--color-muted)',
                    border: 'none',
                    padding: '4px 10px',
                    borderRadius: '12px',
                    fontSize: '0.75rem',
                    fontWeight: 500
                  }}>
                    {p}
                  </span>
                ))
              ) : (
                <span style={{ fontSize: '0.75rem', color: 'var(--color-muted)' }}>暂无</span>
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
                  padding: '8px 14px',
                  fontSize: '0.8rem',
                  border: 'none',
                  borderRadius: '12px',
                  outline: 'none',
                  background: 'var(--bg-main)',
                  color: 'var(--color-text)',
                  boxShadow: '0 2px 8px rgba(160, 109, 68, 0.015)'
                }}
              />
              <button type="submit" className="water-drop-btn" style={{ padding: '6px 12px', fontSize: '0.75rem', fontWeight: 600 }}>关联</button>
            </form>
          </div>

          {/* 覆盖渠道 */}
          <div>
            <div style={{ fontSize: '0.8rem', color: 'var(--color-text)', fontWeight: 600, marginBottom: '6px' }}>覆盖渠道</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '8px' }}>
              {selectedNode.channels && selectedNode.channels.length > 0 ? (
                selectedNode.channels.map((ch, i) => (
                  <span key={i} style={{
                    background: 'var(--bg-main)',
                    color: 'var(--color-muted)',
                    border: 'none',
                    padding: '4px 10px',
                    borderRadius: '12px',
                    fontSize: '0.75rem',
                    fontWeight: 500
                  }}>
                    {ch}
                  </span>
                ))
              ) : (
                <span style={{ fontSize: '0.75rem', color: 'var(--color-muted)' }}>暂无</span>
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
                  padding: '8px 14px',
                  fontSize: '0.8rem',
                  border: 'none',
                  borderRadius: '12px',
                  outline: 'none',
                  background: 'var(--bg-main)',
                  color: 'var(--color-text)',
                  boxShadow: '0 2px 8px rgba(160, 109, 68, 0.015)'
                }}
              />
              <button type="submit" className="water-drop-btn" style={{ padding: '6px 12px', fontSize: '0.75rem', fontWeight: 600 }}>关联</button>
            </form>
          </div>

          {/* 简要概述 */}
          <div style={{ borderTop: '1px solid rgba(160, 109, 68, 0.08)', paddingTop: '12px' }}>
            <div style={{ fontSize: '0.8rem', color: 'var(--color-text)', fontWeight: 600, marginBottom: '6px' }}>报告概述</div>
            <p style={{
              margin: 0,
              fontSize: '0.85rem',
              color: 'var(--color-muted)',
              lineHeight: 1.6,
              whiteSpace: 'pre-line'
            }}>
              {selectedNode.summary || '暂无概述'}
            </p>
          </div>

          <Link
            href={`/reports/${selectedNode.id}`}
            style={{
              padding: '12px 0',
              fontSize: '0.85rem',
              width: '100%',
              textDecoration: 'none',
              fontWeight: 600,
              marginTop: '8px',
              textAlign: 'center',
              background: 'var(--color-accent)',
              color: '#fff',
              border: 'none',
              borderRadius: '22px',
              boxShadow: '0 4px 12px rgba(255, 100, 30, 0.15)',
              display: 'block',
              transition: 'all 0.3s'
            }}
          >
            阅读报告详情
          </Link>

          {/* 管理员专有删除 */}
          {userRole === 'admin' && (
            <div style={{ borderTop: '1px solid rgba(239, 68, 68, 0.1)', paddingTop: '16px', marginTop: '12px' }}>
              <button
                onClick={handleDeleteNode}
                style={{
                  background: 'rgba(239, 68, 68, 0.08)',
                  color: '#ef4444',
                  border: 'none',
                  borderRadius: '22px',
                  padding: '10px 0',
                  fontSize: '0.85rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  width: '100%'
                }}
              >
                永久删除此报告
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
