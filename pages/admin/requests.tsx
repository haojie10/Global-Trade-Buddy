import React, { useState, useEffect, useCallback } from 'react';
import Head from 'next/head';
import AdminLayout from '../../components/admin/AdminLayout';

interface RequestItem {
  id: string;
  user_id: string | null;
  contact_email: string;
  request_type: 'category_insight' | 'company_insight' | 'feedback';
  payload: any;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  report_id: string | null;
  created_at: string;
  updated_at: string;
  user_nickname?: string;
  user_role?: string;
  linked_report_title?: string;
}

interface RequestStats {
  total: number;
  pending: number;
  processing: number;
  completed: number;
  failed: number;
  feedbackCount: number;
  customCount: number;
}

export default function AdminRequestsPage() {
  const [requests, setRequests] = useState<RequestItem[]>([]);
  const [stats, setStats] = useState<RequestStats>({
    total: 0,
    pending: 0,
    processing: 0,
    completed: 0,
    failed: 0,
    feedbackCount: 0,
    customCount: 0
  });
  const [loading, setLoading] = useState(true);

  // 筛选器
  const [typeFilter, setTypeFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');

  // 详情弹窗
  const [activeItem, setActiveItem] = useState<RequestItem | null>(null);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const fetchRequests = useCallback(async () => {
    setLoading(true);
    try {
      const query = new URLSearchParams();
      if (typeFilter !== 'all') query.set('type', typeFilter);
      if (statusFilter !== 'all') query.set('status', statusFilter);
      if (searchQuery.trim()) query.set('search', searchQuery.trim());

      const res = await fetch(`/api/admin/requests?${query.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setRequests(data.requests || []);
        if (data.stats) {
          setStats(data.stats);
        }
      } else {
        console.error('Failed to fetch requests');
      }
    } catch (err) {
      console.error('Error fetching requests:', err);
    } finally {
      setLoading(false);
    }
  }, [typeFilter, statusFilter, searchQuery]);

  useEffect(() => {
    fetchRequests();
  }, [fetchRequests]);

  const handleUpdateStatus = async (id: string, newStatus: string) => {
    setUpdatingId(id);
    try {
      const res = await fetch('/api/admin/requests', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, status: newStatus })
      });
      if (res.ok) {
        setRequests(prev => prev.map(item => item.id === id ? { ...item, status: newStatus as any } : item));
        if (activeItem && activeItem.id === id) {
          setActiveItem({ ...activeItem, status: newStatus as any });
        }
        // 更新统计数据
        fetchRequests();
      } else {
        alert('更新状态失败，请重试');
      }
    } catch (err) {
      console.error('Error updating status:', err);
      alert('网络连接错误');
    } finally {
      setUpdatingId(null);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return <span style={{ background: 'rgba(245, 158, 11, 0.15)', color: '#f59e0b', border: '1px solid rgba(245, 158, 11, 0.3)', padding: '3px 8px', borderRadius: '6px', fontSize: '0.78rem', fontWeight: 600 }}>⏳ 待处理</span>;
      case 'processing':
        return <span style={{ background: 'rgba(96, 165, 250, 0.15)', color: '#60a5fa', border: '1px solid rgba(96, 165, 250, 0.3)', padding: '3px 8px', borderRadius: '6px', fontSize: '0.78rem', fontWeight: 600 }}>🔄 处理中</span>;
      case 'completed':
        return <span style={{ background: 'rgba(16, 185, 129, 0.15)', color: '#10b981', border: '1px solid rgba(16, 185, 129, 0.3)', padding: '3px 8px', borderRadius: '6px', fontSize: '0.78rem', fontWeight: 600 }}>✅ 已完成</span>;
      case 'failed':
        return <span style={{ background: 'rgba(239, 68, 68, 0.15)', color: '#ef4444', border: '1px solid rgba(239, 68, 68, 0.3)', padding: '3px 8px', borderRadius: '6px', fontSize: '0.78rem', fontWeight: 600 }}>🚫 已忽略</span>;
      default:
        return <span>{status}</span>;
    }
  };

  const getTypeBadge = (type: string) => {
    switch (type) {
      case 'category_insight':
        return <span style={{ background: 'rgba(255, 100, 30, 0.15)', color: '#ff641e', border: '1px solid rgba(255, 100, 30, 0.3)', padding: '3px 8px', borderRadius: '6px', fontSize: '0.78rem', fontWeight: 600 }}>📦 品类调研定制</span>;
      case 'company_insight':
        return <span style={{ background: 'rgba(167, 139, 250, 0.15)', color: '#a78bfa', border: '1px solid rgba(167, 139, 250, 0.3)', padding: '3px 8px', borderRadius: '6px', fontSize: '0.78rem', fontWeight: 600 }}>🏢 企业洞察定制</span>;
      case 'feedback':
        return <span style={{ background: 'rgba(6, 182, 212, 0.15)', color: '#06b6d4', border: '1px solid rgba(6, 182, 212, 0.3)', padding: '3px 8px', borderRadius: '6px', fontSize: '0.78rem', fontWeight: 600 }}>💬 问题建议反馈</span>;
      default:
        return <span>{type}</span>;
    }
  };

  const renderPayloadSummary = (item: RequestItem) => {
    const p = item.payload || {};
    if (item.request_type === 'category_insight') {
      return (
        <div style={{ fontSize: '0.85rem' }}>
          <div><strong style={{ color: '#fff' }}>品类:</strong> {p.product_name || p.productName || '-'}</div>
          <div style={{ color: 'var(--admin-text-secondary)', fontSize: '0.8rem' }}>
            渠道: {p.target_channel || p.channel || '-'} ｜ 市场: {p.category_market || p.market || '-'}
          </div>
        </div>
      );
    } else if (item.request_type === 'company_insight') {
      return (
        <div style={{ fontSize: '0.85rem' }}>
          <div><strong style={{ color: '#fff' }}>企业:</strong> {p.company_name || p.companyName || '-'}</div>
          <div style={{ color: 'var(--admin-text-secondary)', fontSize: '0.8rem' }}>
            市场: {p.company_market || p.market || '-'} {p.company_url ? `｜ 官网: ${p.company_url}` : ''}
          </div>
        </div>
      );
    } else {
      return (
        <div style={{ fontSize: '0.85rem' }}>
          <div><strong style={{ color: '#06b6d4' }}>[{p.category || '反馈'}]</strong> <span style={{ color: '#e0e0e0' }}>{p.content ? (p.content.length > 50 ? p.content.slice(0, 50) + '...' : p.content) : '无详细描述'}</span></div>
        </div>
      );
    }
  };

  return (
    <AdminLayout currentPage="requests">
      <Head>
        <title>定制与反馈管理 | GTB Admin</title>
      </Head>

      <div className="admin-body" style={{ minHeight: '100%' }}>
        {/* 顶部标题区 */}
        <div className="admin-topbar" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
          <div>
            <h1 className="admin-page-title" style={{ fontSize: '1.6rem', fontWeight: 700, margin: 0, color: '#ffffff' }}>
              📨 需求定制与问题反馈管理
            </h1>
            <p style={{ color: 'var(--admin-text-secondary)', fontSize: '0.85rem', margin: '6px 0 0 0' }}>
              集中审阅、跟进与流转用户提交的海外研报定制诉求与平台改善建议
            </p>
          </div>
          <button
            onClick={fetchRequests}
            className="admin-btn"
            style={{
              background: 'rgba(255, 255, 255, 0.08)',
              border: '1px solid var(--admin-border)',
              color: '#fff',
              padding: '8px 16px',
              borderRadius: '8px',
              cursor: 'pointer',
              fontSize: '0.85rem'
            }}
          >
            🔄 刷新数据
          </button>
        </div>

        {/* 统计指标卡片 */}
        <div className="admin-kpi-grid">
          <div className="admin-kpi-card" style={{ borderLeftColor: '#f59e0b' }}>
            <div className="admin-kpi-label">⏳ 待处理需求</div>
            <div className="admin-kpi-value" style={{ color: '#f59e0b' }}>{stats.pending}</div>
            <div className="admin-kpi-trend neutral">需管理员跟进或接单</div>
          </div>

          <div className="admin-kpi-card" style={{ borderLeftColor: '#60a5fa' }}>
            <div className="admin-kpi-label">🔄 处理中任务</div>
            <div className="admin-kpi-value" style={{ color: '#60a5fa' }}>{stats.processing}</div>
            <div className="admin-kpi-trend neutral">AI 调度或人工处理中</div>
          </div>

          <div className="admin-kpi-card" style={{ borderLeftColor: '#10b981' }}>
            <div className="admin-kpi-label">✅ 已完成研报/解决</div>
            <div className="admin-kpi-value" style={{ color: '#10b981' }}>{stats.completed}</div>
            <div className="admin-kpi-trend positive">已通知用户</div>
          </div>

          <div className="admin-kpi-card" style={{ borderLeftColor: '#06b6d4' }}>
            <div className="admin-kpi-label">💬 用户问题反馈</div>
            <div className="admin-kpi-value" style={{ color: '#06b6d4' }}>{stats.feedbackCount}</div>
            <div className="admin-kpi-trend neutral">功能与体验改善</div>
          </div>

          <div className="admin-kpi-card" style={{ borderLeftColor: '#ff641e' }}>
            <div className="admin-kpi-label">📦 定制需求总数</div>
            <div className="admin-kpi-value" style={{ color: '#ff641e' }}>{stats.customCount}</div>
            <div className="admin-kpi-trend neutral">品类与企业洞察总数</div>
          </div>
        </div>

        {/* 筛选与搜索工具栏 */}
        <div className="admin-card" style={{ marginBottom: '24px', padding: '16px 20px' }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '14px', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', alignItems: 'center' }}>
              {/* 类型筛选 */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ fontSize: '0.85rem', color: 'var(--admin-text-secondary)' }}>模块类型:</span>
                <select
                  value={typeFilter}
                  onChange={(e) => setTypeFilter(e.target.value)}
                  style={{
                    background: '#1b1b38',
                    border: '1px solid var(--admin-border)',
                    color: '#fff',
                    padding: '6px 12px',
                    borderRadius: '6px',
                    fontSize: '0.85rem',
                    outline: 'none'
                  }}
                >
                  <option value="all">全部类型</option>
                  <option value="category_insight">品类调研定制</option>
                  <option value="company_insight">企业战略洞察</option>
                  <option value="feedback">问题建议反馈</option>
                </select>
              </div>

              {/* 状态筛选 */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ fontSize: '0.85rem', color: 'var(--admin-text-secondary)' }}>处理状态:</span>
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  style={{
                    background: '#1b1b38',
                    border: '1px solid var(--admin-border)',
                    color: '#fff',
                    padding: '6px 12px',
                    borderRadius: '6px',
                    fontSize: '0.85rem',
                    outline: 'none'
                  }}
                >
                  <option value="all">全部状态</option>
                  <option value="pending">待处理 (Pending)</option>
                  <option value="processing">处理中 (Processing)</option>
                  <option value="completed">已完成 (Completed)</option>
                  <option value="failed">已忽略 (Failed)</option>
                </select>
              </div>
            </div>

            {/* 搜索框 */}
            <div style={{ display: 'flex', gap: '8px', minWidth: '260px' }}>
              <input
                type="text"
                placeholder="搜索邮箱、品类、企业或内容..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && fetchRequests()}
                style={{
                  flex: 1,
                  background: '#1b1b38',
                  border: '1px solid var(--admin-border)',
                  color: '#fff',
                  padding: '6px 12px',
                  borderRadius: '6px',
                  fontSize: '0.85rem',
                  outline: 'none'
                }}
              />
              <button
                onClick={fetchRequests}
                style={{
                  background: 'var(--admin-accent)',
                  border: 'none',
                  color: '#fff',
                  padding: '6px 14px',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontSize: '0.85rem'
                }}
              >
                搜索
              </button>
            </div>
          </div>
        </div>

        {/* 核心列表表格 */}
        <div className="admin-card" style={{ padding: 0, overflow: 'hidden' }}>
          {loading ? (
            <div style={{ padding: '40px', textAlign: 'center', color: 'var(--admin-text-secondary)' }}>
              数据加载中...
            </div>
          ) : requests.length === 0 ? (
            <div style={{ padding: '60px 20px', textAlign: 'center', color: 'var(--admin-text-secondary)' }}>
              <div style={{ fontSize: '2.5rem', marginBottom: '12px' }}>📭</div>
              <div style={{ fontSize: '1rem', color: '#fff', marginBottom: '6px' }}>暂无符合条件的定制或反馈记录</div>
              <div style={{ fontSize: '0.85rem' }}>用户在前台点击「报告定制」或「问题反馈」提交后将在此实时呈现</div>
            </div>
          ) : (
            <div className="admin-table-container">
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.85rem' }}>
                <thead>
                  <tr style={{ background: 'rgba(255, 255, 255, 0.03)', borderBottom: '1px solid var(--admin-border)', color: 'var(--admin-text-secondary)' }}>
                    <th style={{ padding: '14px 18px' }}>提交时间</th>
                    <th style={{ padding: '14px 18px' }}>业务模块</th>
                    <th style={{ padding: '14px 18px' }}>提交用户 / 邮箱</th>
                    <th style={{ padding: '14px 18px', minWidth: '280px' }}>诉求核心内容</th>
                    <th style={{ padding: '14px 18px' }}>处理状态</th>
                    <th style={{ padding: '14px 18px', textAlign: 'right' }}>操作与流转</th>
                  </tr>
                </thead>
                <tbody>
                  {requests.map((item) => (
                    <tr 
                      key={item.id}
                      style={{ 
                        borderBottom: '1px solid var(--admin-border)',
                        transition: 'background 0.2s'
                      }}
                      onMouseOver={(e) => (e.currentTarget.style.background = 'rgba(255, 255, 255, 0.02)')}
                      onMouseOut={(e) => (e.currentTarget.style.background = 'transparent')}
                    >
                      <td style={{ padding: '14px 18px', color: 'var(--admin-text-secondary)', whiteSpace: 'nowrap' }}>
                        {new Date(item.created_at).toLocaleString('zh-CN', {
                          month: '2-digit',
                          day: '2-digit',
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </td>

                      <td style={{ padding: '14px 18px', whiteSpace: 'nowrap' }}>
                        {getTypeBadge(item.request_type)}
                      </td>

                      <td style={{ padding: '14px 18px' }}>
                        <div style={{ fontWeight: 500, color: '#ffffff' }}>{item.contact_email}</div>
                        {item.user_nickname && (
                          <div style={{ color: 'var(--admin-text-secondary)', fontSize: '0.78rem' }}>
                            昵称: {item.user_nickname} {item.user_role === 'admin' ? '(管理员)' : ''}
                          </div>
                        )}
                      </td>

                      <td style={{ padding: '14px 18px' }}>
                        {renderPayloadSummary(item)}
                      </td>

                      <td style={{ padding: '14px 18px', whiteSpace: 'nowrap' }}>
                        {getStatusBadge(item.status)}
                      </td>

                      <td style={{ padding: '14px 18px', textAlign: 'right', whiteSpace: 'nowrap' }}>
                        <div style={{ display: 'inline-flex', gap: '8px', alignItems: 'center' }}>
                          <button
                            onClick={() => setActiveItem(item)}
                            style={{
                              background: 'transparent',
                              border: '1px solid var(--admin-border)',
                              color: 'var(--admin-accent-light)',
                              padding: '4px 10px',
                              borderRadius: '6px',
                              cursor: 'pointer',
                              fontSize: '0.8rem'
                            }}
                          >
                            查看详情
                          </button>

                          {/* 快捷状态操作 */}
                          {item.status === 'pending' && (
                            <button
                              disabled={updatingId === item.id}
                              onClick={() => handleUpdateStatus(item.id, 'processing')}
                              style={{
                                background: 'rgba(96, 165, 250, 0.15)',
                                border: '1px solid rgba(96, 165, 250, 0.4)',
                                color: '#60a5fa',
                                padding: '4px 10px',
                                borderRadius: '6px',
                                cursor: 'pointer',
                                fontSize: '0.8rem'
                              }}
                            >
                              设为处理中
                            </button>
                          )}

                          {item.status === 'processing' && (
                            <button
                              disabled={updatingId === item.id}
                              onClick={() => handleUpdateStatus(item.id, 'completed')}
                              style={{
                                background: 'rgba(16, 185, 129, 0.15)',
                                border: '1px solid rgba(16, 185, 129, 0.4)',
                                color: '#10b981',
                                padding: '4px 10px',
                                borderRadius: '6px',
                                cursor: 'pointer',
                                fontSize: '0.8rem'
                              }}
                            >
                              标记已完成
                            </button>
                          )}

                          {item.status !== 'failed' && item.status !== 'completed' && (
                            <button
                              disabled={updatingId === item.id}
                              onClick={() => handleUpdateStatus(item.id, 'failed')}
                              style={{
                                background: 'transparent',
                                border: '1px solid rgba(239, 68, 68, 0.3)',
                                color: '#ef4444',
                                padding: '4px 8px',
                                borderRadius: '6px',
                                cursor: 'pointer',
                                fontSize: '0.8rem'
                              }}
                              title="标记为忽略或无效需求"
                            >
                              忽略
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* 详情模态弹窗 */}
        {activeItem && (
          <div
            style={{
              position: 'fixed',
              inset: 0,
              backgroundColor: 'rgba(0, 0, 0, 0.75)',
              backdropFilter: 'blur(6px)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 99999,
              padding: '20px'
            }}
            onClick={(e) => {
              if (e.target === e.currentTarget) setActiveItem(null);
            }}
          >
            <div
              style={{
                background: 'var(--admin-bg-card)',
                border: '1px solid var(--admin-border)',
                borderRadius: '16px',
                width: '100%',
                maxWidth: '600px',
                padding: '28px',
                boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)',
                color: '#fff',
                position: 'relative'
              }}
            >
              <button
                onClick={() => setActiveItem(null)}
                style={{
                  position: 'absolute',
                  top: '18px',
                  right: '18px',
                  background: 'none',
                  border: 'none',
                  color: 'var(--admin-text-secondary)',
                  fontSize: '1.2rem',
                  cursor: 'pointer'
                }}
              >
                ✕
              </button>

              <h2 style={{ fontSize: '1.25rem', fontWeight: 600, margin: '0 0 16px 0', display: 'flex', alignItems: 'center', gap: '10px' }}>
                <span>需求详情</span>
                {getTypeBadge(activeItem.request_type)}
                {getStatusBadge(activeItem.status)}
              </h2>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', fontSize: '0.88rem' }}>
                <div style={{ background: 'rgba(255,255,255,0.03)', padding: '12px 16px', borderRadius: '8px' }}>
                  <div style={{ color: 'var(--admin-text-secondary)', fontSize: '0.8rem', marginBottom: '4px' }}>提交用户信息</div>
                  <div><strong>联系邮箱:</strong> {activeItem.contact_email}</div>
                  {activeItem.user_id && <div style={{ fontSize: '0.8rem', color: 'var(--admin-text-secondary)' }}>用户 ID: {activeItem.user_id}</div>}
                  <div style={{ fontSize: '0.8rem', color: 'var(--admin-text-secondary)' }}>
                    提交时间: {new Date(activeItem.created_at).toLocaleString('zh-CN')}
                  </div>
                </div>

                <div style={{ background: 'rgba(255,255,255,0.03)', padding: '12px 16px', borderRadius: '8px' }}>
                  <div style={{ color: 'var(--admin-text-secondary)', fontSize: '0.8rem', marginBottom: '6px' }}>详细表单数据 (Payload)</div>
                  <pre style={{
                    margin: 0,
                    padding: '12px',
                    background: '#0a0a14',
                    borderRadius: '8px',
                    fontSize: '0.82rem',
                    color: '#a78bfa',
                    overflowX: 'auto',
                    fontFamily: 'monospace'
                  }}>
                    {JSON.stringify(activeItem.payload, null, 2)}
                  </pre>
                </div>

                {activeItem.linked_report_title && (
                  <div style={{ background: 'rgba(16, 185, 129, 0.1)', padding: '12px 16px', borderRadius: '8px', border: '1px solid rgba(16, 185, 129, 0.2)' }}>
                    <div style={{ color: '#10b981', fontSize: '0.8rem', marginBottom: '4px' }}>已绑定交付的研报</div>
                    <a href={`/reports/${activeItem.report_id}`} target="_blank" rel="noreferrer" style={{ color: '#34d399', fontWeight: 600 }}>
                      {activeItem.linked_report_title} ➔
                    </a>
                  </div>
                )}

                {/* 状态操作区 */}
                <div style={{ marginTop: '10px', display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
                  {activeItem.status !== 'processing' && (
                    <button
                      onClick={() => handleUpdateStatus(activeItem.id, 'processing')}
                      style={{
                        background: '#60a5fa',
                        color: '#000',
                        border: 'none',
                        padding: '8px 16px',
                        borderRadius: '6px',
                        fontWeight: 600,
                        cursor: 'pointer'
                      }}
                    >
                      设为处理中
                    </button>
                  )}
                  {activeItem.status !== 'completed' && (
                    <button
                      onClick={() => handleUpdateStatus(activeItem.id, 'completed')}
                      style={{
                        background: '#10b981',
                        color: '#fff',
                        border: 'none',
                        padding: '8px 16px',
                        borderRadius: '6px',
                        fontWeight: 600,
                        cursor: 'pointer'
                      }}
                    >
                      标记已交付/已完成
                    </button>
                  )}
                  <button
                    onClick={() => setActiveItem(null)}
                    style={{
                      background: 'rgba(255,255,255,0.1)',
                      color: '#fff',
                      border: 'none',
                      padding: '8px 16px',
                      borderRadius: '6px',
                      cursor: 'pointer'
                    }}
                  >
                    关闭
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
