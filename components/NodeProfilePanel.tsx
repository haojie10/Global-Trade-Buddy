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
  userId?: string;
  quota?: number;
  onQuotaChange?: (newQuota: number) => void;
}

export default function NodeProfilePanel({
  selectedNode,
  userRole,
  entityDetail,
  onRefreshGraph,
  onNodeSelectUpdate,
  onFetchEntityDetail,
  onDeleteNodeSuccess,
  allNodes,
  userId,
  quota,
  onQuotaChange
}: NodeProfilePanelProps) {
  const [newAlias, setNewAlias] = useState('');
  const [newCompetitor, setNewCompetitor] = useState('');
  const [newSupplier, setNewSupplier] = useState('');
  const [marketRegion, setMarketRegion] = useState('');



  const [description, setDescription] = useState('');
  const [website, setWebsite] = useState('');
  const [headquarters, setHeadquarters] = useState('');
  const [employeeCount, setEmployeeCount] = useState('');

  // 报告节点的收藏与笔记交互状态
  const [panelIsFav, setPanelIsFav] = useState(false);
  const [panelNoteText, setPanelNoteText] = useState('');
  const [panelIsSavingNote, setPanelIsSavingNote] = useState(false);
  const [panelIsUnlocked, setPanelIsUnlocked] = useState(false);

  // 邀请码与测试充值状态
  const [inviteCodeInput, setInviteCodeInput] = useState('');
  const [isInviting, setIsInviting] = useState(false);

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

  // 异步获取报告属性（解锁状态、收藏状态与笔记）
  useEffect(() => {
    const fetchReportStatus = async () => {
      if (!selectedNode || selectedNode.node_type !== 'report' || !userId) return;
      try {
        const detailRes = await fetch(`/api/user/report-detail?reportId=${selectedNode.id}`);
        if (detailRes.ok) {
          const detail = await detailRes.json();
          setPanelIsUnlocked(detail.isUnlocked);
          setPanelIsFav(detail.isFavorite);
        }
        const noteRes = await fetch(`/api/user/note?reportId=${selectedNode.id}`);
        if (noteRes.ok) {
          const noteData = await noteRes.json();
          setPanelNoteText(noteData.note?.content || '');
        }
      } catch (err) {
        console.error('获取报告状态失败', err);
      }
    };
    fetchReportStatus();
  }, [selectedNode, userId]);

  // 监听 selectedNode 的变化，清空子组件内部输入状态
  useEffect(() => {
    setNewAlias('');
    setNewCompetitor('');
    setNewSupplier('');
    setMarketRegion('');
  }, [selectedNode]);

  const handlePanelToggleFavorite = async () => {
    if (!selectedNode || !userId) return;
    try {
      const res = await fetch('/api/user/favorite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reportId: selectedNode.id })
      });
      const data = await res.json();
      if (res.ok && data.status) {
        setPanelIsFav(data.status === 'added');
        // 刷新图谱以应用过滤
        await onRefreshGraph();
      } else {
        alert(data.error || '收藏失败');
      }
    } catch (err) {
      alert('连接服务网关失败');
    }
  };

  const handlePanelSaveNote = async () => {
    if (!selectedNode || !userId) return;
    setPanelIsSavingNote(true);
    try {
      const res = await fetch(`/api/user/note?reportId=${selectedNode.id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: panelNoteText })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        alert('备备忘笔记保存成功！');
      } else {
        alert(data.error || '保存失败');
      }
    } catch (err) {
      alert('连接服务网关失败');
    } finally {
      setPanelIsSavingNote(false);
    }
  };

  const handleExchangeInviteCode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteCodeInput.trim()) return;
    setIsInviting(true);
    try {
      const res = await fetch('/api/user/invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ referrerId: inviteCodeInput.trim() })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        alert('兑换成功！双方各获得 3 次解锁额度奖励。');
        setInviteCodeInput('');
        if (onQuotaChange && quota !== undefined) {
          onQuotaChange(quota + 3);
        }
      } else {
        alert(data.error || '兑换失败，请检查邀请码，或您已经兑换过。');
      }
    } catch (err) {
      alert('连接服务网关失败');
    } finally {
      setIsInviting(false);
    }
  };

  const handleTestRecharge = async () => {
    try {
      const res = await fetch('/api/user/test-recharge', { method: 'POST' });
      const data = await res.json();
      if (res.ok && data.success) {
        alert(data.message);
        if (onQuotaChange) {
          onQuotaChange(data.newQuota);
        }
      } else {
        alert(data.error || '充值失败');
      }
    } catch (err) {
      alert('连接服务器失败');
    }
  };

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

        {/* 💡 知识拓扑管理指南 */}
        <div style={{
          background: 'rgba(255, 100, 30, 0.04)',
          border: '1px dashed rgba(255, 100, 30, 0.25)',
          borderRadius: '16px',
          padding: '16px',
          fontSize: '0.8rem',
          lineHeight: 1.5,
          color: 'var(--color-text)'
        }}>
          <strong style={{ color: 'var(--color-accent)', display: 'block', marginBottom: '6px' }}>💡 知识拓扑管理指南：</strong>
          为了保持图谱结构清晰，当前的图谱节点仅针对您<strong>已收藏</strong>的报告绘制。
          系统已在您解锁新报告时默认自动将其加入收藏。如果后续报告数量过多，您可以在列表页中取消收藏不常用的报告，它们将自动从图谱中隐藏。
        </div>

        {/* ✉️ 邀请裂变区域 */}
        {userId && (
          <div style={{
            background: 'rgba(160, 109, 68, 0.03)',
            border: '1px solid rgba(160, 109, 68, 0.08)',
            borderRadius: '16px',
            padding: '20px',
            display: 'flex',
            flexDirection: 'column',
            gap: '12px'
          }}>
            <div style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--color-muted)' }}>邀请好友送解锁额度</div>
            <div style={{ fontSize: '0.75rem', color: 'var(--color-muted)' }}>
              您的专属邀请ID（点击可复制）：
              <code 
                onClick={() => {
                  navigator.clipboard.writeText(userId);
                  alert('邀请ID已复制到剪贴板！');
                }}
                style={{ 
                  display: 'block', 
                  background: 'rgba(18, 18, 18, 0.05)', 
                  padding: '6px', 
                  borderRadius: '4px', 
                  marginTop: '4px', 
                  cursor: 'pointer',
                  textAlign: 'center',
                  fontFamily: 'monospace',
                  color: 'var(--color-accent)'
                }}
              >
                {userId}
              </code>
            </div>
            
            <form onSubmit={handleExchangeInviteCode} style={{ display: 'flex', gap: '8px', marginTop: '4px' }}>
              <input
                type="text"
                placeholder="输入好友的邀请 ID"
                value={inviteCodeInput}
                onChange={e => setInviteCodeInput(e.target.value)}
                style={{
                  flex: 1,
                  padding: '8px 12px',
                  fontSize: '0.8rem',
                  border: '1px solid rgba(18, 18, 18, 0.08)',
                  borderRadius: '8px',
                  outline: 'none',
                  background: '#ffffff'
                }}
              />
              <button 
                type="submit" 
                disabled={isInviting}
                className="sand-btn" 
                style={{ padding: '8px 16px', fontSize: '0.8rem', cursor: 'pointer' }}
              >
                {isInviting ? '兑换中...' : '兑换'}
              </button>
            </form>
          </div>
        )}

        {/* ⚡ 测试充值区域 */}
        {userId && (
          <div style={{ display: 'flex', justifyContent: 'center', marginTop: '12px' }}>
            <button
              onClick={handleTestRecharge}
              style={{
                background: 'rgba(18, 18, 18, 0.05)',
                border: '1px dashed rgba(18, 18, 18, 0.15)',
                color: 'var(--color-muted)',
                fontSize: '0.75rem',
                padding: '6px 16px',
                borderRadius: '20px',
                cursor: 'pointer',
                transition: 'all 0.2s'
              }}
              onMouseOver={(e) => {
                e.currentTarget.style.background = 'rgba(255, 100, 30, 0.05)';
                e.currentTarget.style.borderColor = 'var(--color-accent)';
                e.currentTarget.style.color = 'var(--color-accent)';
              }}
              onMouseOut={(e) => {
                e.currentTarget.style.background = 'rgba(18, 18, 18, 0.05)';
                e.currentTarget.style.borderColor = 'rgba(18, 18, 18, 0.15)';
                e.currentTarget.style.color = 'var(--color-muted)';
              }}
            >
              ⚡ 开发测试专用：一键充值 10 次额度
            </button>
          </div>
        )}
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
            <div style={{ fontSize: '0.75rem', color: '#3b82f6', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>商业实体画像</div>
            <h4 style={{ margin: '4px 0 0 0', fontSize: '1.25rem', color: '#0f172a', fontWeight: 700 }}>
              {selectedNode.title}
            </h4>
          </div>

          {/* 公司基本情况展示 & 修改 */}
          {userRole === 'admin' ? (
            /* 管理员编辑模式 */
            <div style={{ borderTop: '1px solid rgba(15, 23, 42, 0.06)', paddingTop: '14px' }}>
              <div style={{ fontSize: '0.8rem', color: '#475569', fontWeight: 600, marginBottom: '8px' }}>公司基本情况 (管理员编辑)</div>
              <form onSubmit={handleUpdateDetails} style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <div style={{ flex: 1 }}>
                    <label style={{ fontSize: '0.7rem', color: '#64748b', display: 'block', marginBottom: '4px' }}>总部地点</label>
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
                    <label style={{ fontSize: '0.7rem', color: '#64748b', display: 'block', marginBottom: '4px' }}>员工规模</label>
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
                  <label style={{ fontSize: '0.7rem', color: '#64748b', display: 'block', marginBottom: '4px' }}>官方网站</label>
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
                  <label style={{ fontSize: '0.7rem', color: '#64748b', display: 'block', marginBottom: '4px' }}>企业简介</label>
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
                  保存公司基本情况
                </button>
              </form>
            </div>
          ) : (
            /* 普通用户只读展示 */
            <div style={{ borderTop: '1px solid rgba(15, 23, 42, 0.06)', paddingTop: '14px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <div style={{ fontSize: '0.8rem', color: '#475569', fontWeight: 600 }}>公司基本情况</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <span style={{ fontSize: '0.75rem', color: '#64748b', display: 'block' }}>总部地点</span>
                  <span style={{ fontSize: '0.8rem', color: '#0f172a', fontWeight: 500 }}>{headquarters || '暂无信息'}</span>
                </div>
                <div>
                  <span style={{ fontSize: '0.75rem', color: '#64748b', display: 'block' }}>员工规模</span>
                  <span style={{ fontSize: '0.8rem', color: '#0f172a', fontWeight: 500 }}>{employeeCount || '暂无信息'}</span>
                </div>
              </div>
              <div>
                <span style={{ fontSize: '0.75rem', color: '#64748b', display: 'block' }}>官方网站</span>
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
            <div style={{ fontSize: '0.8rem', color: '#475569', fontWeight: 600, marginBottom: '8px' }}>同义别称</div>
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
            <div style={{ fontSize: '0.8rem', color: '#ef4444', fontWeight: 600, marginBottom: '8px' }}>竞争对手关系网</div>
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
            <div style={{ fontSize: '0.8rem', color: '#2563eb', fontWeight: 600, marginBottom: '8px' }}>合作商与供应商</div>
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
                永久删除此公司实体
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
          </div>



          {/* 简要概述 */}
          <div style={{ borderTop: '1px solid rgba(15, 23, 42, 0.06)', paddingTop: '12px' }}>
            <div style={{ fontSize: '0.8rem', color: '#475569', fontWeight: 600, marginBottom: '6px' }}>报告概述</div>
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

          {/* 选中报告节点时的收藏与笔记交互 */}
          {userId && (
            <div style={{ borderTop: '1px solid rgba(15, 23, 42, 0.06)', paddingTop: '12px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '0.8rem', color: '#475569', fontWeight: 600 }}>图谱与收藏控制</span>
                <button
                  onClick={handlePanelToggleFavorite}
                  style={{
                    background: 'transparent',
                    border: panelIsFav ? '1px solid var(--color-accent)' : '1px solid rgba(18, 18, 18, 0.15)',
                    color: panelIsFav ? 'var(--color-accent)' : 'var(--color-muted)',
                    fontSize: '0.75rem',
                    padding: '4px 10px',
                    borderRadius: 'var(--border-radius)',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                    transition: 'all 0.2s'
                  }}
                >
                  <svg width="10" height="10" viewBox="0 0 24 24" fill={panelIsFav ? 'var(--color-accent)' : 'none'} stroke="currentColor" strokeWidth="1.5">
                    <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                  </svg>
                  {panelIsFav ? '在图谱上显示(已收藏)' : '在图谱上隐藏(取消收藏)'}
                </button>
              </div>

              {panelIsUnlocked && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginTop: '4px' }}>
                  <div style={{ fontSize: '0.75rem', color: 'var(--color-muted)', fontWeight: 500 }}>修改备忘笔记:</div>
                  <textarea
                    placeholder="在此编辑该报告的备忘笔记..."
                    value={panelNoteText}
                    onChange={(e) => setPanelNoteText(e.target.value)}
                    style={{
                      width: '100%',
                      height: '70px',
                      background: 'rgba(255, 255, 255, 0.8)',
                      border: '1px solid rgba(18, 18, 18, 0.08)',
                      borderRadius: '8px',
                      padding: '8px 12px',
                      fontSize: '0.8rem',
                      color: 'var(--color-text)',
                      outline: 'none',
                      resize: 'none',
                      fontFamily: 'inherit',
                      boxSizing: 'border-box'
                    }}
                  />
                  <button
                    onClick={handlePanelSaveNote}
                    disabled={panelIsSavingNote}
                    className="sand-btn"
                    style={{
                      padding: '6px 12px',
                      fontSize: '0.75rem',
                      alignSelf: 'flex-end',
                      cursor: panelIsSavingNote ? 'not-allowed' : 'pointer',
                      opacity: panelIsSavingNote ? 0.7 : 1
                    }}
                  >
                    {panelIsSavingNote ? '保存中...' : '保存笔记'}
                  </button>
                </div>
              )}
            </div>
          )}

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
                  border: '1px solid rgba(239, 68, 68, 0.25)',
                  borderRadius: '20px',
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
