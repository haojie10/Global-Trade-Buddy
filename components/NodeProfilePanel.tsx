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
  allNodes?: GraphNode[];
}

export default function NodeProfilePanel({
  selectedNode,
  userRole,
  entityDetail,
  onRefreshGraph,
  onNodeSelectUpdate,
  onFetchEntityDetail,
  onDeleteNodeSuccess,
  allNodes
}: NodeProfilePanelProps) {
  const [activeTab, setActiveTab] = useState<'profile' | 'network' | 'alias'>('profile');
  const [activeTabReport, setActiveTabReport] = useState<'overview' | 'entities'>('overview');

  const [newAlias, setNewAlias] = useState('');
  const [newCompetitor, setNewCompetitor] = useState('');
  const [newSupplier, setNewSupplier] = useState('');
  const [marketRegion, setMarketRegion] = useState('');

  const [newReportCompany, setNewReportCompany] = useState('');
  const [newReportCompetitor, setNewReportCompetitor] = useState('');
  const [newReportProduct, setNewReportProduct] = useState('');
  const [newReportChannel, setNewReportChannel] = useState('');
  const [newReportSupplier, setNewReportSupplier] = useState('');
  const [newReportCustomer, setNewReportCustomer] = useState('');

  const [description, setDescription] = useState('');
  const [website, setWebsite] = useState('');
  const [headquarters, setHeadquarters] = useState('');
  const [employeeCount, setEmployeeCount] = useState('');

  useEffect(() => {
    if (entityDetail) {
      setDescription(entityDetail.description || '');
      setWebsite(entityDetail.website || '');
      setHeadquarters(entityDetail.headquarters || '');
      setEmployeeCount(entityDetail.employee_count || '');
    } else {
      setDescription('');
      setWebsite('');
      setHeadquarters('');
      setEmployeeCount('');
    }
  }, [entityDetail]);

  // 监听 selectedNode 的变化，清空子组件内部输入状态
  useEffect(() => {
    setNewAlias('');
    setNewCompetitor('');
    setNewSupplier('');
    setMarketRegion('');
    setNewReportCompany('');
    setNewReportCompetitor('');
    setNewReportProduct('');
    setNewReportChannel('');
    setNewReportSupplier('');
    setNewReportCustomer('');
    setActiveTab('profile');
    setActiveTabReport('overview');
  }, [selectedNode]);

  if (!selectedNode) {
    const reportNodes = allNodes ? allNodes.filter(n => n.node_type === 'report') : [];
    const totalReports = reportNodes.length;
    const customerReports = reportNodes.filter(n => n.category !== 'product').length;
    const productReports = reportNodes.filter(n => n.category === 'product').length;
    const coveredMarkets = new Set(reportNodes.map(n => n.market_region).filter(Boolean)).size;

    return (
      <div style={{
        flex: 1,
        padding: '24px',
        display: 'flex',
        flexDirection: 'column',
        gap: '24px',
        overflowY: 'auto'
      }}>
        <div style={{
          fontSize: '0.9rem',
          fontWeight: 500,
          color: 'var(--color-muted)',
          borderBottom: '1px solid rgba(160, 109, 68, 0.08)',
          paddingBottom: '12px'
        }}>
          报告整体情况看板
        </div>
        
        <div style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: '16px'
        }}>
          {[
            { label: '已解锁报告数', value: totalReports },
            { label: '客户洞察报告', value: customerReports },
            { label: '品类分析报告', value: productReports },
            { label: '涉及国家/市场', value: coveredMarkets }
          ].map((item, idx) => (
            <div key={idx} style={{
              background: 'rgba(160, 109, 68, 0.03)',
              border: '1px solid rgba(160, 109, 68, 0.08)',
              borderRadius: '16px',
              padding: '16px',
              textAlign: 'center',
              display: 'flex',
              flexDirection: 'column',
              gap: '4px'
            }}>
              <span style={{ fontSize: '0.75rem', color: 'var(--color-muted)' }}>{item.label}</span>
              <span style={{ fontSize: '1.75rem', fontWeight: 600, color: 'var(--color-accent)' }}>{item.value}</span>
            </div>
          ))}
        </div>

        <p style={{ 
          margin: '12px 0 0 0', 
          fontSize: '0.8rem', 
          lineHeight: 1.6, 
          color: 'var(--color-muted)',
          textAlign: 'center'
        }}>
          点击左侧图谱中的任意报告节点，即可在此查看该报告的智能商业画像与核心供需实体线索。
        </p>
      </div>
    );
  }

  const handleUpdateDetails = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/admin/entities/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          entityId: selectedNode.id,
          description,
          website,
          headquarters,
          employee_count: employeeCount
        })
      });
      if (res.ok) {
        alert('公司基本情况保存成功！');
        await onFetchEntityDetail(selectedNode.id);
        await onRefreshGraph();
      } else {
        const data = await res.json();
        alert(data.error || '保存失败');
      }
    } catch (err: any) {
      alert(err.message);
    }
  };

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

  const handleTagReport = async (
    e: React.FormEvent,
    entityType: 'company' | 'competitor' | 'product' | 'channel' | 'supplier' | 'customer'
  ) => {
    e.preventDefault();
    let entityName = '';
    if (entityType === 'company') entityName = newReportCompany;
    else if (entityType === 'competitor') entityName = newReportCompetitor;
    else if (entityType === 'product') entityName = newReportProduct;
    else if (entityType === 'channel') entityName = newReportChannel;
    else if (entityType === 'supplier') entityName = newReportSupplier;
    else if (entityType === 'customer') entityName = newReportCustomer;

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
        else if (entityType === 'competitor') setNewReportCompetitor('');
        else if (entityType === 'product') setNewReportProduct('');
        else if (entityType === 'channel') setNewReportChannel('');
        else if (entityType === 'supplier') setNewReportSupplier('');
        else if (entityType === 'customer') setNewReportCustomer('');

        await onRefreshGraph();
        
        // 触发父级状态更新
        const next = { ...selectedNode };
        if (entityType === 'company') {
          next.companies = [...(selectedNode.companies || []), entityName.trim()];
        } else if (entityType === 'competitor') {
          next.competitors = [...(selectedNode.competitors || []), entityName.trim()];
        } else if (entityType === 'product') {
          next.products = [...(selectedNode.products || []), entityName.trim()];
        } else if (entityType === 'channel') {
          next.channels = [...(selectedNode.channels || []), entityName.trim()];
        } else if (entityType === 'supplier') {
          next.suppliers = [...(selectedNode.suppliers || []), entityName.trim()];
        } else if (entityType === 'customer') {
          next.customers = [...(selectedNode.customers || []), entityName.trim()];
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
      ? `您确定要永久删除报告【${selectedNode.title}】吗？\n删除后该报告的所有解锁数据、笔记、收藏以及关联边线都将随之丢失，此操作不可恢复！`
      : `您确定要永久删除该实体【${selectedNode.title}】吗？\n删除后该实体的别名、关联线、竞争或供应商关系都将一并删除，此操作不可恢复！`;

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
        /* 🏢 公司/渠道 商业画像面板 */
        <div style={{
          background: 'rgba(253, 251, 247, 0.75)',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          borderRadius: '20px',
          border: 'none',
          padding: '24px',
          boxShadow: '0 12px 30px rgba(160, 109, 68, 0.06)',
          display: 'flex',
          flexDirection: 'column',
          gap: '20px'
        }}>
          <div>
            <div style={{ fontSize: '0.75rem', color: 'var(--color-accent)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>商业实体画像</div>
            <h4 style={{ margin: '4px 0 0 0', fontSize: '1.25rem', color: 'var(--color-text)', fontWeight: 600 }}>
              {selectedNode.title}
            </h4>
          </div>

          {/* Pill Tab Switcher */}
          <div style={{
            display: 'flex',
            background: 'var(--bg-main)',
            borderRadius: '12px',
            padding: '4px',
            gap: '4px',
            marginBottom: '4px'
          }}>
            {[
              { key: 'profile', label: '基本画像' },
              { key: 'network', label: '供应链网络' },
              { key: 'alias', label: '同义别称' }
            ].map(tab => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key as any)}
                style={{
                  flex: 1,
                  padding: '8px 12px',
                  fontSize: '0.8rem',
                  borderRadius: '8px',
                  border: 'none',
                  cursor: 'pointer',
                  background: activeTab === tab.key ? 'var(--bg-sub)' : 'transparent',
                  color: activeTab === tab.key ? 'var(--color-accent)' : 'var(--color-muted)',
                  fontWeight: activeTab === tab.key ? 500 : 300,
                  transition: 'all 0.3s ease'
                }}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Tab 1: 基本画像 */}
          {activeTab === 'profile' && (
            <div>
              {userRole === 'admin' ? (
                /* 管理员编辑模式 */
                <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                  <div style={{ fontSize: '0.8rem', color: 'var(--color-muted)', fontWeight: 500 }}>公司基本情况 (管理员编辑)</div>
                  <form onSubmit={handleUpdateDetails} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    <div style={{ display: 'flex', gap: '12px' }}>
                      <div style={{ flex: 1 }}>
                        <label style={{ fontSize: '0.75rem', color: 'var(--color-muted)', display: 'block', marginBottom: '6px' }}>总部地点</label>
                        <input
                          type="text"
                          placeholder="如: 美国加州"
                          value={headquarters}
                          onChange={(e) => setHeadquarters(e.target.value)}
                          style={{
                            width: '100%',
                            padding: '8px 12px',
                            fontSize: '0.8rem',
                            border: 'none',
                            background: 'var(--bg-main)',
                            boxShadow: 'inset 0 1px 3px rgba(160, 109, 68, 0.05)',
                            borderRadius: '10px',
                            color: 'var(--color-text)',
                            outline: 'none',
                            boxSizing: 'border-box'
                          }}
                        />
                      </div>
                      <div style={{ flex: 1 }}>
                        <label style={{ fontSize: '0.75rem', color: 'var(--color-muted)', display: 'block', marginBottom: '6px' }}>员工规模</label>
                        <input
                          type="text"
                          placeholder="如: 100-500人"
                          value={employeeCount}
                          onChange={(e) => setEmployeeCount(e.target.value)}
                          style={{
                            width: '100%',
                            padding: '8px 12px',
                            fontSize: '0.8rem',
                            border: 'none',
                            background: 'var(--bg-main)',
                            boxShadow: 'inset 0 1px 3px rgba(160, 109, 68, 0.05)',
                            borderRadius: '10px',
                            color: 'var(--color-text)',
                            outline: 'none',
                            boxSizing: 'border-box'
                          }}
                        />
                      </div>
                    </div>
                    <div>
                      <label style={{ fontSize: '0.75rem', color: 'var(--color-muted)', display: 'block', marginBottom: '6px' }}>官方网站</label>
                      <input
                        type="text"
                        placeholder="如: https://tesla.com"
                        value={website}
                        onChange={(e) => setWebsite(e.target.value)}
                        style={{
                          width: '100%',
                          padding: '8px 12px',
                          fontSize: '0.8rem',
                          border: 'none',
                          background: 'var(--bg-main)',
                          boxShadow: 'inset 0 1px 3px rgba(160, 109, 68, 0.05)',
                          borderRadius: '10px',
                          color: 'var(--color-text)',
                          outline: 'none',
                          boxSizing: 'border-box'
                        }}
                      />
                    </div>
                    <div>
                      <label style={{ fontSize: '0.75rem', color: 'var(--color-muted)', display: 'block', marginBottom: '6px' }}>企业简介</label>
                      <textarea
                        placeholder="请输入公司简介描述..."
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        rows={3}
                        style={{
                          width: '100%',
                          padding: '8px 12px',
                          fontSize: '0.8rem',
                          border: 'none',
                          background: 'var(--bg-main)',
                          boxShadow: 'inset 0 1px 3px rgba(160, 109, 68, 0.05)',
                          borderRadius: '10px',
                          color: 'var(--color-text)',
                          outline: 'none',
                          resize: 'vertical',
                          boxSizing: 'border-box',
                          fontFamily: 'inherit'
                        }}
                      />
                    </div>
                    <button 
                      type="submit" 
                      className="water-drop-btn" 
                      style={{ 
                        padding: '10px 20px', 
                        fontSize: '0.8rem', 
                        fontWeight: 500, 
                        background: 'var(--color-accent)', 
                        border: 'none', 
                        borderRadius: '12px',
                        color: '#fff', 
                        alignSelf: 'flex-end',
                        cursor: 'pointer'
                      }}
                    >
                      保存基本信息
                    </button>
                  </form>
                </div>
              ) : (
                /* 普通用户只读展示 */
                <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                    <div>
                      <span style={{ fontSize: '0.75rem', color: 'var(--color-muted)', display: 'block', marginBottom: '4px' }}>总部地点</span>
                      <span style={{ fontSize: '0.85rem', color: 'var(--color-text)', fontWeight: 500 }}>{headquarters || '暂无信息'}</span>
                    </div>
                    <div>
                      <span style={{ fontSize: '0.75rem', color: 'var(--color-muted)', display: 'block', marginBottom: '4px' }}>员工规模</span>
                      <span style={{ fontSize: '0.85rem', color: 'var(--color-text)', fontWeight: 500 }}>{employeeCount || '暂无信息'}</span>
                    </div>
                  </div>
                  <div>
                    <span style={{ fontSize: '0.75rem', color: 'var(--color-muted)', display: 'block', marginBottom: '4px' }}>官方网站</span>
                    {website ? (
                      <a href={website.startsWith('http') ? website : `https://${website}`} target="_blank" rel="noopener noreferrer" style={{ fontSize: '0.85rem', color: 'var(--color-accent)', textDecoration: 'underline' }}>
                        {website}
                      </a>
                    ) : (
                      <span style={{ fontSize: '0.85rem', color: 'var(--color-muted)', fontStyle: 'italic' }}>暂无官网</span>
                    )}
                  </div>
                  <div>
                    <span style={{ fontSize: '0.75rem', color: 'var(--color-muted)', display: 'block', marginBottom: '6px' }}>企业简介</span>
                    <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--color-text)', lineHeight: 1.6, background: 'var(--bg-main)', padding: '12px', borderRadius: '12px', whiteSpace: 'pre-wrap' }}>
                      {description || '暂无公司简介描述。'}
                    </p>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Tab 2: 供应链网络 */}
          {activeTab === 'network' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              {/* 竞争对手 */}
              <div>
                <div style={{ fontSize: '0.8rem', color: 'var(--color-accent)', fontWeight: 500, marginBottom: '8px' }}>竞争对手关系网</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '12px' }}>
                  {entityDetail?.competitors && entityDetail.competitors.length > 0 ? (
                    entityDetail.competitors.map((c: any, i: number) => (
                      <span key={i} style={{
                        background: 'rgba(255, 100, 30, 0.05)',
                        color: 'var(--color-accent)',
                        border: '1px solid rgba(255, 100, 30, 0.15)',
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
                {userRole === 'admin' && (
                  <form onSubmit={(e) => handleAddRelation(e, 'competitor')} style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <input
                        type="text"
                        placeholder="输入竞争对手名称"
                        value={newCompetitor}
                        onChange={(e) => setNewCompetitor(e.target.value)}
                        style={{
                          flex: 1,
                          padding: '8px 12px',
                          fontSize: '0.8rem',
                          border: 'none',
                          background: 'var(--bg-main)',
                          boxShadow: 'inset 0 1px 3px rgba(160, 109, 68, 0.05)',
                          borderRadius: '10px',
                          color: 'var(--color-text)',
                          outline: 'none'
                        }}
                      />
                      <input
                        type="text"
                        placeholder="地区 (可选)"
                        value={marketRegion}
                        onChange={(e) => setMarketRegion(e.target.value)}
                        style={{
                          width: '100px',
                          padding: '8px 12px',
                          fontSize: '0.8rem',
                          border: 'none',
                          background: 'var(--bg-main)',
                          boxShadow: 'inset 0 1px 3px rgba(160, 109, 68, 0.05)',
                          borderRadius: '10px',
                          color: 'var(--color-text)',
                          outline: 'none'
                        }}
                      />
                    </div>
                    <button type="submit" className="water-drop-btn" style={{ padding: '8px 14px', fontSize: '0.75rem', fontWeight: 500, background: 'var(--color-accent)', border: 'none', borderRadius: '8px', color: '#fff', alignSelf: 'flex-end' }}>添加对手</button>
                  </form>
                )}
              </div>

              {/* 供应商与合作伙伴 */}
              <div style={{ borderTop: '1px solid rgba(160, 109, 68, 0.05)', paddingTop: '16px' }}>
                <div style={{ fontSize: '0.8rem', color: '#2563eb', fontWeight: 500, marginBottom: '8px' }}>合作商与供应商</div>
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
                    <span style={{ fontSize: '0.75rem', color: 'var(--color-muted)', fontStyle: 'italic' }}>暂无合作伙伴记录</span>
                  )}
                </div>
                {userRole === 'admin' && (
                  <form onSubmit={(e) => handleAddRelation(e, 'supplier')} style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <input
                        type="text"
                        placeholder="输入供应商/合作伙伴"
                        value={newSupplier}
                        onChange={(e) => setNewSupplier(e.target.value)}
                        style={{
                          flex: 1,
                          padding: '8px 12px',
                          fontSize: '0.8rem',
                          border: 'none',
                          background: 'var(--bg-main)',
                          boxShadow: 'inset 0 1px 3px rgba(160, 109, 68, 0.05)',
                          borderRadius: '10px',
                          color: 'var(--color-text)',
                          outline: 'none'
                        }}
                      />
                      <input
                        type="text"
                        placeholder="地区 (可选)"
                        value={marketRegion}
                        onChange={(e) => setMarketRegion(e.target.value)}
                        style={{
                          width: '100px',
                          padding: '8px 12px',
                          fontSize: '0.8rem',
                          border: 'none',
                          background: 'var(--bg-main)',
                          boxShadow: 'inset 0 1px 3px rgba(160, 109, 68, 0.05)',
                          borderRadius: '10px',
                          color: 'var(--color-text)',
                          outline: 'none'
                        }}
                      />
                    </div>
                    <button type="submit" className="water-drop-btn" style={{ padding: '8px 14px', fontSize: '0.75rem', fontWeight: 500, background: '#2563eb', border: 'none', borderRadius: '8px', color: '#fff', alignSelf: 'flex-end' }}>添加伙伴</button>
                  </form>
                )}
              </div>
            </div>
          )}

          {/* Tab 3: 同义别称 */}
          {activeTab === 'alias' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div style={{ fontSize: '0.8rem', color: 'var(--color-muted)', fontWeight: 500, marginBottom: '4px' }}>已知别名/曾用名</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '12px' }}>
                {entityDetail?.aliases && entityDetail.aliases.length > 0 ? (
                  entityDetail.aliases.map((a: string, i: number) => (
                    <span key={i} style={{
                      background: 'rgba(148, 163, 184, 0.08)',
                      color: 'var(--color-muted)',
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
                  <span style={{ fontSize: '0.75rem', color: 'var(--color-muted)', fontStyle: 'italic' }}>暂无其他别名</span>
                )}
              </div>
              {userRole === 'admin' && (
                <form onSubmit={handleMergeAlias} style={{ display: 'flex', gap: '8px' }}>
                  <input
                    type="text"
                    placeholder="输入新别名进行绑定"
                    value={newAlias}
                    onChange={(e) => setNewAlias(e.target.value)}
                    style={{
                      flex: 1,
                      padding: '8px 12px',
                      fontSize: '0.8rem',
                      border: 'none',
                      background: 'var(--bg-main)',
                      boxShadow: 'inset 0 1px 3px rgba(160, 109, 68, 0.05)',
                      borderRadius: '10px',
                      color: 'var(--color-text)',
                      outline: 'none'
                    }}
                  />
                  <button type="submit" className="water-drop-btn" style={{ padding: '8px 14px', fontSize: '0.75rem', fontWeight: 500, borderRadius: '8px' }}>绑定别名</button>
                </form>
              )}
            </div>
          )}

          {/* 管理员专有删除 */}
          {userRole === 'admin' && (
            <div style={{ borderTop: '1px solid rgba(239, 68, 68, 0.1)', paddingTop: '16px', marginTop: '8px', display: 'flex', justifyContent: 'flex-end' }}>
              <button
                onClick={handleDeleteNode}
                style={{
                  background: 'rgba(239, 68, 68, 0.05)',
                  color: '#ef4444',
                  border: 'none',
                  borderRadius: '12px',
                  padding: '10px 0',
                  fontSize: '0.8rem',
                  fontWeight: 500,
                  cursor: 'pointer',
                  width: '100%',
                  transition: 'all 0.3s ease'
                }}
              >
                永久删除此公司实体
              </button>
            </div>
          )}
        </div>
      ) : (
        /* 📄 报告 详情面板 */
        <div style={{
          background: 'rgba(253, 251, 247, 0.75)',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          borderRadius: '20px',
          border: 'none',
          padding: '24px',
          boxShadow: '0 12px 30px rgba(160, 109, 68, 0.06)',
          display: 'flex',
          flexDirection: 'column',
          gap: '16px'
        }}>
          <div>
            <h4 style={{ margin: '0 0 6px 0', fontSize: '1.1rem', color: 'var(--color-text)', fontWeight: 600, lineHeight: 1.4 }}>
              {selectedNode.title}
            </h4>
          </div>

          {/* Pill Tab Switcher */}
          <div style={{
            display: 'flex',
            background: 'var(--bg-main)',
            borderRadius: '12px',
            padding: '4px',
            gap: '4px',
            marginBottom: '4px'
          }}>
            {[
              { key: 'overview', label: '报告概述' },
              { key: 'entities', label: '关联实体管理' }
            ].map(tab => (
              <button
                key={tab.key}
                onClick={() => setActiveTabReport(tab.key as any)}
                style={{
                  flex: 1,
                  padding: '8px 12px',
                  fontSize: '0.8rem',
                  borderRadius: '8px',
                  border: 'none',
                  cursor: 'pointer',
                  background: activeTabReport === tab.key ? 'var(--bg-sub)' : 'transparent',
                  color: activeTabReport === tab.key ? 'var(--color-accent)' : 'var(--color-muted)',
                  fontWeight: activeTabReport === tab.key ? 500 : 300,
                  transition: 'all 0.3s ease'
                }}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Tab 1: 报告概述 */}
          {activeTabReport === 'overview' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <div style={{ fontSize: '0.8rem', color: 'var(--color-muted)', fontWeight: 500, marginBottom: '6px' }}>报告摘要</div>
                <p style={{
                  margin: 0,
                  fontSize: '0.85rem',
                  color: 'var(--color-text)',
                  lineHeight: 1.6,
                  whiteSpace: 'pre-line',
                  background: 'var(--bg-main)',
                  padding: '12px',
                  borderRadius: '12px'
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
                  marginTop: '8px',
                  textAlign: 'center',
                  background: 'var(--color-accent)',
                  color: '#fff',
                  borderRadius: '12px',
                  border: 'none',
                  display: 'block'
                }}
              >
                阅读报告详情
              </Link>
            </div>
          )}

          {/* Tab 2: 关联实体管理 */}
          {activeTabReport === 'entities' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {(() => {
                const tagStyle: React.CSSProperties = {
                  background: 'rgba(160, 109, 68, 0.05)',
                  color: 'var(--color-text)',
                  border: '1px solid rgba(160, 109, 68, 0.15)',
                  padding: '4px 10px',
                  borderRadius: '12px',
                  fontSize: '0.75rem',
                  fontWeight: 500
                };
                const isProduct = selectedNode.category === 'product' || selectedNode.node_type === 'product';

                return (
                  <>
                    {/* 1. 公司名称 (仅公司报告显示) */}
                    {!isProduct && (
                      <div>
                        <div style={{ fontSize: '0.8rem', color: 'var(--color-muted)', fontWeight: 500, marginBottom: '6px' }}>公司名称</div>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '8px' }}>
                          {selectedNode.companies && selectedNode.companies.length > 0 ? (
                            selectedNode.companies.map((c, i) => (
                              <span key={i} style={tagStyle}>
                                {c}
                              </span>
                            ))
                          ) : (
                            <span style={{ fontSize: '0.75rem', color: 'var(--color-muted)', fontStyle: 'italic' }}>暂无关联公司</span>
                          )}
                        </div>
                        {userRole === 'admin' && (
                          <form onSubmit={(e) => handleTagReport(e, 'company')} style={{ display: 'flex', gap: '8px' }}>
                            <input
                              type="text"
                              placeholder="关联新公司，如：Wildberries"
                              value={newReportCompany}
                              onChange={(e) => setNewReportCompany(e.target.value)}
                              style={{
                                flex: 1,
                                padding: '8px 12px',
                                fontSize: '0.8rem',
                                border: 'none',
                                background: 'var(--bg-main)',
                                boxShadow: 'inset 0 1px 3px rgba(160, 109, 68, 0.05)',
                                borderRadius: '10px',
                                color: 'var(--color-text)',
                                outline: 'none'
                              }}
                            />
                            <button type="submit" className="water-drop-btn" style={{ padding: '8px 14px', fontSize: '0.75rem', fontWeight: 500, borderRadius: '8px' }}>关联</button>
                          </form>
                        )}
                      </div>
                    )}

                    {/* 2. 竞争对手 (仅公司报告显示) */}
                    {!isProduct && (
                      <div>
                        <div style={{ fontSize: '0.8rem', color: 'var(--color-muted)', fontWeight: 500, marginBottom: '6px' }}>竞争对手</div>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '8px' }}>
                          {selectedNode.competitors && selectedNode.competitors.length > 0 ? (
                            selectedNode.competitors.map((comp, i) => (
                              <span key={i} style={tagStyle}>
                                {comp}
                              </span>
                            ))
                          ) : (
                            <span style={{ fontSize: '0.75rem', color: 'var(--color-muted)', fontStyle: 'italic' }}>暂无关联对手</span>
                          )}
                        </div>
                        {userRole === 'admin' && (
                          <form onSubmit={(e) => handleTagReport(e, 'competitor')} style={{ display: 'flex', gap: '8px' }}>
                            <input
                              type="text"
                              placeholder="关联新竞争对手"
                              value={newReportCompetitor}
                              onChange={(e) => setNewReportCompetitor(e.target.value)}
                              style={{
                                flex: 1,
                                padding: '8px 12px',
                                fontSize: '0.8rem',
                                border: 'none',
                                background: 'var(--bg-main)',
                                boxShadow: 'inset 0 1px 3px rgba(160, 109, 68, 0.05)',
                                borderRadius: '10px',
                                color: 'var(--color-text)',
                                outline: 'none'
                              }}
                            />
                            <button type="submit" className="water-drop-btn" style={{ padding: '8px 14px', fontSize: '0.75rem', fontWeight: 500, borderRadius: '8px' }}>关联</button>
                          </form>
                        )}
                      </div>
                    )}

                    {/* 3. 产品名称 */}
                    <div>
                      <div style={{ fontSize: '0.8rem', color: 'var(--color-muted)', fontWeight: 500, marginBottom: '6px' }}>产品名称</div>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '8px' }}>
                        {selectedNode.products && selectedNode.products.length > 0 ? (
                          selectedNode.products.map((p, i) => (
                            <span key={i} style={tagStyle}>
                              {p}
                            </span>
                          ))
                        ) : (
                          <span style={{ fontSize: '0.75rem', color: 'var(--color-muted)', fontStyle: 'italic' }}>暂无关联产品</span>
                        )}
                      </div>
                      {userRole === 'admin' && (
                        <form onSubmit={(e) => handleTagReport(e, 'product')} style={{ display: 'flex', gap: '8px' }}>
                          <input
                            type="text"
                            placeholder="关联新产品，如：刹车片"
                            value={newReportProduct}
                            onChange={(e) => setNewReportProduct(e.target.value)}
                            style={{
                              flex: 1,
                              padding: '8px 12px',
                              fontSize: '0.8rem',
                              border: 'none',
                              background: 'var(--bg-main)',
                              boxShadow: 'inset 0 1px 3px rgba(160, 109, 68, 0.05)',
                              borderRadius: '10px',
                              color: 'var(--color-text)',
                              outline: 'none'
                            }}
                          />
                          <button type="submit" className="water-drop-btn" style={{ padding: '8px 14px', fontSize: '0.75rem', fontWeight: 500, borderRadius: '8px' }}>关联</button>
                        </form>
                      )}
                    </div>

                    {/* 4. 销售渠道 */}
                    <div>
                      <div style={{ fontSize: '0.8rem', color: 'var(--color-muted)', fontWeight: 500, marginBottom: '6px' }}>销售渠道</div>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '8px' }}>
                        {selectedNode.channels && selectedNode.channels.length > 0 ? (
                          selectedNode.channels.map((ch, i) => (
                            <span key={i} style={tagStyle}>
                              {ch}
                            </span>
                          ))
                        ) : (
                          <span style={{ fontSize: '0.75rem', color: 'var(--color-muted)', fontStyle: 'italic' }}>暂无关联渠道</span>
                        )}
                      </div>
                      {userRole === 'admin' && (
                        <form onSubmit={(e) => handleTagReport(e, 'channel')} style={{ display: 'flex', gap: '8px' }}>
                          <input
                            type="text"
                            placeholder="关联新渠道，如：配件超市"
                            value={newReportChannel}
                            onChange={(e) => setNewReportChannel(e.target.value)}
                            style={{
                              flex: 1,
                              padding: '8px 12px',
                              fontSize: '0.8rem',
                              border: 'none',
                              background: 'var(--bg-main)',
                              boxShadow: 'inset 0 1px 3px rgba(160, 109, 68, 0.05)',
                              borderRadius: '10px',
                              color: 'var(--color-text)',
                              outline: 'none'
                            }}
                          />
                          <button type="submit" className="water-drop-btn" style={{ padding: '8px 14px', fontSize: '0.75rem', fontWeight: 500, borderRadius: '8px' }}>关联</button>
                        </form>
                      )}
                    </div>

                    {/* 5. 供应商 */}
                    <div>
                      <div style={{ fontSize: '0.8rem', color: 'var(--color-muted)', fontWeight: 500, marginBottom: '6px' }}>供应商</div>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '8px' }}>
                        {selectedNode.suppliers && selectedNode.suppliers.length > 0 ? (
                          selectedNode.suppliers.map((s, i) => (
                            <span key={i} style={tagStyle}>
                              {s}
                            </span>
                          ))
                        ) : (
                          <span style={{ fontSize: '0.75rem', color: 'var(--color-muted)', fontStyle: 'italic' }}>暂无关联供应商</span>
                        )}
                      </div>
                      {userRole === 'admin' && (
                        <form onSubmit={(e) => handleTagReport(e, 'supplier')} style={{ display: 'flex', gap: '8px' }}>
                          <input
                            type="text"
                            placeholder="关联新供应商，如：A公司"
                            value={newReportSupplier}
                            onChange={(e) => setNewReportSupplier(e.target.value)}
                            style={{
                              flex: 1,
                              padding: '8px 12px',
                              fontSize: '0.8rem',
                              border: 'none',
                              background: 'var(--bg-main)',
                              boxShadow: 'inset 0 1px 3px rgba(160, 109, 68, 0.05)',
                              borderRadius: '10px',
                              color: 'var(--color-text)',
                              outline: 'none'
                            }}
                          />
                          <button type="submit" className="water-drop-btn" style={{ padding: '8px 14px', fontSize: '0.75rem', fontWeight: 500, borderRadius: '8px' }}>关联</button>
                        </form>
                      )}
                    </div>

                    {/* 6. 主要客户 (仅公司报告显示) */}
                    {!isProduct && (
                      <div>
                        <div style={{ fontSize: '0.8rem', color: 'var(--color-muted)', fontWeight: 500, marginBottom: '6px' }}>主要客户</div>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '8px' }}>
                          {selectedNode.customers && selectedNode.customers.length > 0 ? (
                            selectedNode.customers.map((c, i) => (
                              <span key={i} style={tagStyle}>
                                {c}
                              </span>
                            ))
                          ) : (
                            <span style={{ fontSize: '0.75rem', color: 'var(--color-muted)', fontStyle: 'italic' }}>暂无关联客户</span>
                          )}
                        </div>
                        {userRole === 'admin' && (
                          <form onSubmit={(e) => handleTagReport(e, 'customer')} style={{ display: 'flex', gap: '8px' }}>
                            <input
                              type="text"
                              placeholder="关联新客户，如：B公司"
                              value={newReportCustomer}
                              onChange={(e) => setNewReportCustomer(e.target.value)}
                              style={{
                                flex: 1,
                                padding: '8px 12px',
                                fontSize: '0.8rem',
                                border: 'none',
                                background: 'var(--bg-main)',
                                boxShadow: 'inset 0 1px 3px rgba(160, 109, 68, 0.05)',
                                borderRadius: '10px',
                                color: 'var(--color-text)',
                                outline: 'none'
                              }}
                            />
                            <button type="submit" className="water-drop-btn" style={{ padding: '8px 14px', fontSize: '0.75rem', fontWeight: 500, borderRadius: '8px' }}>关联</button>
                          </form>
                        )}
                      </div>
                    )}
                  </>
                );
              })()}
            </div>
          )}

          {/* 管理员专有删除 */}
          {userRole === 'admin' && (
            <div style={{ borderTop: '1px solid rgba(239, 68, 68, 0.1)', paddingTop: '16px', marginTop: '12px' }}>
              <button
                onClick={handleDeleteNode}
                style={{
                  background: 'rgba(239, 68, 68, 0.05)',
                  color: '#ef4444',
                  border: 'none',
                  borderRadius: '12px',
                  padding: '10px 0',
                  fontSize: '0.85rem',
                  fontWeight: 500,
                  cursor: 'pointer',
                  width: '100%',
                  transition: 'all 0.3s ease'
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
