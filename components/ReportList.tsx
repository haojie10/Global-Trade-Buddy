import React, { useState } from 'react';
import Link from 'next/link';

export interface PlatformReport {
  id: string;
  title: string;
  category: string;
  market_region: string;
  summary: string;
  isUnlocked: boolean;
  isFavorited?: boolean;
}

export function filterReports(
  reports: PlatformReport[],
  searchQuery: string,
  category: string,
  region: string
): PlatformReport[] {
  const query = searchQuery.trim().toLowerCase();
  return reports.filter(r => {
    const matchQuery = !query || r.title.toLowerCase().includes(query) || r.summary.toLowerCase().includes(query);
    const matchCat = category === 'All' || r.category === category;
    
    // 支持逗号分割的国家/地区匹配，如果包含选中的地区或“全球”，即代表匹配
    const reportRegions = r.market_region
      ? r.market_region.split(',').map(s => s.trim()).filter(Boolean)
      : [];
    const matchRegion =
      region === 'All' ||
      reportRegions.includes(region) ||
      reportRegions.includes('全球') ||
      r.market_region === '全球';

    return matchQuery && matchCat && matchRegion;
  });
}

interface ReportListProps {
  reports: PlatformReport[];
  userId: string;
  userRole: string;
  quota: number;
  onUnlockSuccess: (newQuota: number, unlockedReportId: string) => void;
  onDeleteReport?: (reportId: string) => void;
  onFavoriteToggle?: (reportId: string, isFavorited: boolean) => void;
}

export default function ReportList({ reports, userId, userRole, quota, onUnlockSuccess, onDeleteReport, onFavoriteToggle }: ReportListProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [selectedRegion, setSelectedRegion] = useState('All');

  const filtered = filterReports(reports, searchQuery, selectedCategory, selectedRegion);
  
  // 搜索日志追踪（防抖，用户停止输入 1 秒后且 query 不为空时上报）
  React.useEffect(() => {
    if (!searchQuery.trim()) return;

    const timer = setTimeout(() => {
      fetch('/api/track/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: searchQuery,
          results_count: filtered.length
        })
      }).catch(err => console.error('Error tracking search:', err));
    }, 1000);

    return () => clearTimeout(timer);
  }, [searchQuery, filtered.length]);
  
  // 对地区进行分割、扁平化，过滤掉非中文并去重，对齐图谱页面
  const regions = [
    'All',
    ...Array.from(
      new Set(
        reports
          .map(r => r.market_region)
          .filter(Boolean)
          .flatMap(rStr => rStr.split(',').map(r => r.trim()).filter(Boolean))
          .filter(region => /^[\u4e00-\u9fa5]+$/.test(region))
      )
    )
  ];

  const handleUnlock = async (e: React.MouseEvent, reportId: string) => {
    e.preventDefault();
    if (!userId) {
      alert('请先登录后再解锁！');
      return;
    }
    try {
      const res = await fetch('/api/user/unlock-action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, reportId }),
      });
      const data = await res.json();
      if (data.success) {
        alert('解锁成功！');
        onUnlockSuccess(quota - 1, reportId);
      } else {
        alert(data.error || '解锁失败，请充值额度');
      }
    } catch (err) {
      alert('连接支付网关失败');
    }
  };

  const handleDelete = async (e: React.MouseEvent, reportId: string, reportTitle: string) => {
    e.preventDefault();
    e.stopPropagation();
    if (!window.confirm(`确定要彻底删除报告《${reportTitle}》吗？\n删除后所有用户的解锁记录和该报告的图谱拓扑关系将自动被一并清理，此操作不可撤销。`)) {
      return;
    }
    try {
      const res = await fetch('/api/admin/reports/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reportId }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        alert('报告删除成功！');
        if (onDeleteReport) {
          onDeleteReport(reportId);
        }
      } else {
        alert(data.error || '删除失败，请重试');
      }
    } catch (err) {
      alert('连接删除服务失败');
    }
  };

  const handleToggleFavorite = async (e: React.MouseEvent, reportId: string, currentFav: boolean) => {
    e.preventDefault();
    e.stopPropagation();
    if (!userId) {
      alert('请先登录后收藏报告');
      return;
    }
    try {
      const res = await fetch('/api/user/favorite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reportId }),
      });
      const data = await res.json();
      if (res.ok && (data.status === 'added' || data.status === 'removed')) {
        const isNowFav = data.status === 'added';
        if (onFavoriteToggle) {
          onFavoriteToggle(reportId, isNowFav);
        }
      } else {
        alert(data.error || '收藏操作失败');
      }
    } catch (err) {
      alert('连接收藏服务失败');
    }
  };

  const inputStyle = {
    background: 'rgba(255, 255, 255, 0.65)',
    border: '1px solid rgba(18, 18, 18, 0.08)',
    borderRadius: '0px',
    padding: '12px 16px',
    fontSize: '0.85rem',
    color: 'var(--color-text)',
    outline: 'none',
    transition: 'box-shadow 0.3s ease',
  };

  return (
    <div>
      {/* 筛选栏 */}
      <div style={{
        display: 'flex',
        gap: '16px',
        marginBottom: '40px',
        alignItems: 'center',
        flexWrap: 'wrap',
        background: 'rgba(255, 255, 255, 0.45)',
        backdropFilter: 'blur(15px)',
        WebkitBackdropFilter: 'blur(15px)',
        border: '1px solid rgba(18, 18, 18, 0.05)',
        padding: '16px 24px',
        borderRadius: 'var(--border-radius)',
        boxShadow: '0 10px 40px rgba(0, 0, 0, 0.01)'
      }}>
        <input
          type="text"
          placeholder="搜索报告标题或摘要内容..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          style={{ ...inputStyle, flex: 1, minWidth: '240px' }}
        />
        
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <span style={{ fontSize: '0.85rem', color: 'var(--color-muted)', fontWeight: 500 }}>类别</span>
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            style={{ ...inputStyle, padding: '8px 12px', cursor: 'pointer' }}
          >
            <option value="All">全部类别</option>
            <option value="customer">客户洞察</option>
            <option value="product">品类分析</option>
          </select>
        </div>

        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <span style={{ fontSize: '0.85rem', color: 'var(--color-muted)', fontWeight: 500 }}>市场</span>
          <select
            value={selectedRegion}
            onChange={(e) => setSelectedRegion(e.target.value)}
            style={{ ...inputStyle, padding: '8px 12px', cursor: 'pointer' }}
          >
            {regions.map(r => (
              <option key={r} value={r}>
                {r === 'All' ? '全部地区' : r}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* 列表网格 */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '24px' }}>
        {filtered.length > 0 ? (
          filtered.map((report) => (
            <Link 
              href={`/reports/${report.id}`} 
              key={report.id} 
              style={{ textDecoration: 'none' }}
            >
              <div 
                className="report-card"
                style={{
                  border: '1px solid rgba(18, 18, 18, 0.05)',
                  borderRadius: 'var(--border-radius)',
                  padding: '28px',
                  cursor: 'pointer',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  height: '260px',
                  boxShadow: '0 6px 20px rgba(0, 0, 0, 0.01)'
                }}
              >
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                    <span style={{
                      fontSize: '0.75rem',
                      fontWeight: 'var(--btn-font-weight)',
                      letterSpacing: 'var(--btn-letter-spacing)',
                      color: report.category === 'customer' ? 'var(--color-accent)' : 'var(--color-muted)',
                      background: report.category === 'customer' ? 'rgba(255, 100, 30, 0.05)' : 'rgba(122, 117, 111, 0.08)',
                      padding: '5px 12px',
                      borderRadius: '0px'
                    }}>
                      {report.category === 'customer' ? '客户洞察' : '品类分析'}
                    </span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      {/* 收藏按钮（星星样式） */}
                      <button
                        onClick={(e) => handleToggleFavorite(e, report.id, !!report.isFavorited)}
                        title={report.isFavorited ? '取消收藏' : '收藏报告'}
                        style={{
                          background: 'none',
                          border: 'none',
                          padding: '4px',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          color: report.isFavorited ? '#eab308' : 'rgba(18, 18, 18, 0.3)',
                          borderRadius: '4px',
                          transition: 'all 0.2s',
                          outline: 'none'
                        }}
                        onMouseOver={(e) => {
                          if (!report.isFavorited) {
                            e.currentTarget.style.color = '#eab308';
                          }
                        }}
                        onMouseOut={(e) => {
                          if (!report.isFavorited) {
                            e.currentTarget.style.color = 'rgba(18, 18, 18, 0.3)';
                          }
                        }}
                      >
                        <svg 
                          width="14" 
                          height="14" 
                          viewBox="0 0 24 24" 
                          fill={report.isFavorited ? 'currentColor' : 'none'} 
                          stroke="currentColor" 
                          strokeWidth="1.8" 
                          strokeLinecap="round" 
                          strokeLinejoin="round"
                        >
                          <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                        </svg>
                      </button>

                      <span style={{ fontSize: '0.8rem', color: 'var(--color-muted)', fontWeight: 300, display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
                          <circle cx="12" cy="10" r="3" />
                        </svg>
                        {report.market_region}
                      </span>
                      {userRole === 'admin' && (
                        <button
                          onClick={(e) => handleDelete(e, report.id, report.title)}
                          title="删除此报告"
                          style={{
                            background: 'none',
                            border: 'none',
                            padding: '4px',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: 'rgba(18, 18, 18, 0.4)',
                            borderRadius: '4px',
                            transition: 'all 0.2s',
                            outline: 'none'
                          }}
                          onMouseOver={(e) => {
                            e.currentTarget.style.color = '#ef4444';
                            e.currentTarget.style.background = 'rgba(239, 68, 68, 0.08)';
                          }}
                          onMouseOut={(e) => {
                            e.currentTarget.style.color = 'rgba(18, 18, 18, 0.4)';
                            e.currentTarget.style.background = 'none';
                          }}
                        >
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="3 6 5 6 21 6" />
                            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                            <line x1="10" y1="11" x2="10" y2="17" />
                            <line x1="14" y1="11" x2="14" y2="17" />
                          </svg>
                        </button>
                      )}
                    </div>
                  </div>
                  <h4 style={{
                    margin: '0 0 10px 0',
                    fontSize: '1.05rem',
                    color: 'var(--color-text)',
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
                    color: 'var(--color-muted)',
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
                  borderTop: '1px solid rgba(18, 18, 18, 0.05)',
                  paddingTop: '16px'
                }}>
                  {report.isUnlocked ? (
                    <>
                      <span className="unlocked-tag" style={{
                        fontSize: '0.75rem',
                        fontWeight: 300,
                        padding: '4px 10px',
                        borderRadius: '0px',
                        background: 'rgba(18, 18, 18, 0.05)',
                        color: '#555555',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px',
                        transition: 'all 0.3s'
                      }}>
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="20 6 9 17 4 12" />
                        </svg>
                        已解锁
                      </span>
                      <span className="read-now-label" style={{ fontSize: '0.8rem', color: '#555555', fontWeight: 'var(--btn-font-weight)', letterSpacing: 'var(--btn-letter-spacing)', transition: 'all 0.2s' }}>
                        立即阅读 →
                      </span>
                    </>
                  ) : (
                    <>
                      <button
                        onClick={(e) => handleUnlock(e, report.id)}
                        style={{
                          background: 'transparent',
                          border: '1px solid rgba(18, 18, 18, 0.15)',
                          color: '#555555',
                          fontSize: '0.75rem',
                          fontWeight: 300,
                          padding: '4px 10px',
                          borderRadius: '0px',
                          cursor: 'pointer',
                          transition: 'all 0.2s',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '4px'
                        }}
                        onMouseOver={(e) => {
                          e.currentTarget.style.borderColor = 'var(--color-accent)';
                          e.currentTarget.style.color = 'var(--color-accent)';
                          e.currentTarget.style.background = 'rgba(255, 100, 30, 0.05)';
                        }}
                        onMouseOut={(e) => {
                          e.currentTarget.style.borderColor = 'rgba(18, 18, 18, 0.15)';
                          e.currentTarget.style.color = '#555555';
                          e.currentTarget.style.background = 'transparent';
                        }}
                      >
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round">
                          <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                          <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                        </svg>
                        未解锁
                      </button>
                      <span className="preview-unlock-label" style={{ fontSize: '0.8rem', color: '#555555', fontWeight: 'var(--btn-font-weight)', letterSpacing: 'var(--btn-letter-spacing)', transition: 'all 0.2s' }}>
                        立即预览与解锁 →
                      </span>
                    </>
                  )}
                </div>
              </div>
            </Link>
          ))
        ) : (
          <div style={{ gridColumn: '1 / -1', padding: '80px 40px', textAlign: 'center', color: 'var(--color-muted)', fontWeight: 300 }}>
            没有符合筛选条件的报告。
          </div>
        )}
      </div>
    </div>
  );
}
