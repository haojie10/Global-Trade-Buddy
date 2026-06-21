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
  const [newReportCompetitor, setNewReportCompetitor] = useState('');
  const [newReportProduct, setNewReportProduct] = useState('');
  const [newReportChannel, setNewReportChannel] = useState('');

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
        color: '#64748b'
      }}>
        <span style={{ fontSize: '2.5rem', marginBottom: '16px' }}>💡</span>
        <p style={{ margin: 0, fontSize: '0.85rem', lineHeight: 1.6, color: '#64748b' }}>
          点击图谱中的任意报告节点，即可在此查看该报告的智能商业画像与核心供需实体线索。
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

  const handleTagReport = async (e: React.FormEvent, entityType: 'company' | 'competitor' | 'product' | 'channel') => {
    e.preventDefault();
    let entityName = '';
    if (entityType === 'company') entityName = newReportCompany;
    else if (entityType === 'competitor') entityName = newReportCompetitor;
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
        else if (entityType === 'competitor') setNewReportCompetitor('');
        else if (entityType === 'product') setNewReportProduct('');
        else if (entityType === 'channel') setNewReportChannel('');

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

          {/* 公司基本情况展示 & 修改 */}
          {userRole === 'admin' ? (
            /* 管理员编辑模式 */
            <div style={{ borderTop: '1px solid rgba(15, 23, 42, 0.06)', paddingTop: '14px' }}>
              <div style={{ fontSize: '0.8rem', color: '#475569', fontWeight: 600, marginBottom: '8px' }}>📝 公司基本情况 (管理员编辑)</div>
              <form onSubmit={handleUpdateDetails} style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <div style={{ flex: 1 }}>
                    <label style={{ fontSize: '0.7rem', color: '#64748b', display: 'block', marginBottom: '4px' }}>🌍 总部地点</label>
                    <input
                      type="text"
                      placeholder="如: 美国加州"
                      value={headquarters}
                      onChange={(e) => setHeadquarters(e.target.value)}
                      style={{
                        width: '100%',
                        padding: '6px 10px',
                        fontSize: '0.8rem',
                        border: '1px solid rgba(15, 23, 42, 0.1)',
                        borderRadius: '8px',
                        outline: 'none',
                        boxSizing: 'border-box'
                      }}
                    />
                  </div>
                  <div style={{ flex: 1 }}>
                    <label style={{ fontSize: '0.7rem', color: '#64748b', display: 'block', marginBottom: '4px' }}>👥 员工规模</label>
                    <input
                      type="text"
                      placeholder="如: 100-500人"
                      value={employeeCount}
                      onChange={(e) => setEmployeeCount(e.target.value)}
                      style={{
                        width: '100%',
                        padding: '6px 10px',
                        fontSize: '0.8rem',
                        border: '1px solid rgba(15, 23, 42, 0.1)',
                        borderRadius: '8px',
                        outline: 'none',
                        boxSizing: 'border-box'
                      }}
                    />
                  </div>
                </div>
                <div>
                  <label style={{ fontSize: '0.7rem', color: '#64748b', display: 'block', marginBottom: '4px' }}>🔗 官方网站</label>
                  <input
                    type="text"
                    placeholder="如: https://tesla.com"
                    value={website}
                    onChange={(e) => setWebsite(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '6px 10px',
                      fontSize: '0.8rem',
                      border: '1px solid rgba(15, 23, 42, 0.1)',
                      borderRadius: '8px',
                      outline: 'none',
                      boxSizing: 'border-box'
                    }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: '0.7rem', color: '#64748b', display: 'block', marginBottom: '4px' }}>📖 企业简介</label>
                  <textarea
                    placeholder="请输入公司简介描述..."
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    rows={3}
                    style={{
                      width: '100%',
                      padding: '6px 10px',
                      fontSize: '0.8rem',
                      border: '1px solid rgba(15, 23, 42, 0.1)',
                      borderRadius: '8px',
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
                    padding: '8px 16px', 
                    fontSize: '0.8rem', 
                    fontWeight: 600, 
                    background: '#2563eb', 
                    border: '1px solid #2563eb', 
                    color: '#fff', 
                    alignSelf: 'flex-end',
                    cursor: 'pointer'
                  }}
                >
                  💾 保存公司基本情况
                </button>
              </form>
            </div>
          ) : (
            /* 普通用户只读展示 */
            <div style={{ borderTop: '1px solid rgba(15, 23, 42, 0.06)', paddingTop: '14px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <div style={{ fontSize: '0.8rem', color: '#475569', fontWeight: 600 }}>📝 公司基本情况</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <span style={{ fontSize: '0.75rem', color: '#64748b', display: 'block' }}>🌍 总部地点</span>
                  <span style={{ fontSize: '0.8rem', color: '#0f172a', fontWeight: 500 }}>{headquarters || '暂无信息'}</span>
                </div>
                <div>
                  <span style={{ fontSize: '0.75rem', color: '#64748b', display: 'block' }}>👥 员工规模</span>
                  <span style={{ fontSize: '0.8rem', color: '#0f172a', fontWeight: 500 }}>{employeeCount || '暂无信息'}</span>
                </div>
              </div>
              <div>
                <span style={{ fontSize: '0.75rem', color: '#64748b', display: 'block' }}>🔗 官方网站</span>
                {website ? (
                  <a href={website.startsWith('http') ? website : `https://${website}`} target="_blank" rel="noopener noreferrer" style={{ fontSize: '0.8rem', color: '#2563eb', textDecoration: 'underline' }}>
                    {website}
                  </a>
                ) : (
                  <span style={{ fontSize: '0.8rem', color: '#94a3b8', fontStyle: 'italic' }}>暂无官网</span>
                )}
              </div>
              <div>
                <span style={{ fontSize: '0.75rem', color: '#64748b', display: 'block', marginBottom: '4px' }}>企业简介</span>
                <p style={{ margin: 0, fontSize: '0.8rem', color: '#475569', lineHeight: 1.5, background: 'rgba(15, 23, 42, 0.02)', padding: '10px', borderRadius: '8px', whiteSpace: 'pre-wrap' }}>
                  {description || '暂无公司简介描述。'}
                </p>
              </div>
            </div>
          )}

          {/* 1. 同义别称 */}
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

          {/* 2. 竞争对手 */}
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

          {/* 3. 供应商与合作伙伴 */}
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

          {/* 管理员专有删除 */}
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
                  width: '100%'
                }}
              >
                🗑️ 永久删除此公司实体
              </button>
            </div>
          )}
        </div>
      ) : (
        /* 📄 报告 详情面板 */
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

          {/* 竞争对手 */}
          <div>
            <div style={{ fontSize: '0.8rem', color: '#475569', fontWeight: 600, marginBottom: '6px' }}>👥 竞争对手 (Competitor)</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '8px' }}>
              {selectedNode.competitors && selectedNode.competitors.length > 0 ? (
                selectedNode.competitors.map((comp, i) => (
                  <span key={i} style={{
                    background: 'rgba(59, 130, 246, 0.08)',
                    color: '#3b82f6',
                    border: '1px solid rgba(59, 130, 246, 0.15)',
                    padding: '4px 10px',
                    borderRadius: '12px',
                    fontSize: '0.75rem',
                    fontWeight: 500
                  }}>
                    {comp}
                  </span>
                ))
              ) : (
                <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>暂无</span>
              )}
            </div>
            <form onSubmit={(e) => handleTagReport(e, 'competitor')} style={{ display: 'flex', gap: '8px' }}>
              <input
                type="text"
                placeholder="关联新竞争对手，如：Wildberries"
                value={newReportCompetitor}
                onChange={(e) => setNewReportCompetitor(e.target.value)}
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
              marginTop: '8px',
              textAlign: 'center'
            }}
          >
            📖 阅读报告详情
          </Link>

          {/* 管理员专有删除 */}
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
                  width: '100%'
                }}
              >
                🗑️ 永久删除此报告
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
