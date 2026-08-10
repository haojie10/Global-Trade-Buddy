import React, { useState } from 'react';
import Link from 'next/link';
import { STANDARD_CATEGORIES } from '../lib/category-mapper';
import { isNodeInRegion } from '../lib/region-country-mapper';

export interface PlatformReport {
  id: string;
  title: string;
  category: string;
  market_region: string;
  summary: string;
  industries?: string;
  isUnlocked: boolean;
  isFavorited?: boolean;
}

export const FIXED_REGIONS = ['All', '欧洲', '北美洲', '亚洲', '东南亚', '中东', '南美洲', '大洋洲', '非洲'];

export function filterReports(
  reports: PlatformReport[],
  searchQuery: string,
  category: string,
  region: string,
  industry: string = 'All'
): PlatformReport[] {
  const query = searchQuery.trim().toLowerCase();
  return reports.filter(r => {
    const matchQuery = !query || r.title.toLowerCase().includes(query) || (r.summary && r.summary.toLowerCase().includes(query));
    const matchCat = category === 'All' || r.category === category;
    
    // 市场大区智能筛选：选择固定大区（如“欧洲”）时，自动匹配覆盖国家属于该大区的所有报告
    const matchRegion =
      region === 'All' ||
      isNodeInRegion(r.market_region, region) ||
      (region === '欧洲' && (r.title.includes('欧洲') || r.title.includes('欧盟') || (r.summary && (r.summary.includes('欧洲') || r.summary.includes('欧盟'))))) ||
      (region === '北美洲' && (r.title.includes('北美') || r.title.includes('美国') || (r.summary && (r.summary.includes('北美') || r.summary.includes('美国')))));

    // 支持相关行业匹配
    const reportIndustries = r.industries
      ? r.industries.split(',').map(s => s.trim()).filter(Boolean)
      : [];
    const matchIndustry =
      industry === 'All' ||
      reportIndustries.includes(industry) ||
      (r.industries && r.industries.includes(industry)) ||
      r.title.includes(industry) ||
      (r.summary && r.summary.includes(industry));

    return matchQuery && matchCat && matchRegion && matchIndustry;
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
  const [selectedIndustry, setSelectedIndustry] = useState('All');
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 20;

  const filtered = filterReports(reports, searchQuery, selectedCategory, selectedRegion, selectedIndustry);

  // 筛选条件变化时，自动复位到第 1 页
  React.useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, selectedCategory, selectedRegion, selectedIndustry]);

  const totalPages = Math.ceil(filtered.length / pageSize) || 1;
  const paginatedReports = filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  
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
  
  // 固定市场大区选项，不包含具体国家
  const regions = FIXED_REGIONS;

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
    borderRadius: 'var(--border-radius)',
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
          <span style={{ fontSize: '0.85rem', color: 'var(--color-muted)', fontWeight: 500 }}>报告类别</span>
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
          <span style={{ fontSize: '0.85rem', color: 'var(--color-muted)', fontWeight: 500 }}>市场区域</span>
          <select
            value={selectedRegion}
            onChange={(e) => setSelectedRegion(e.target.value)}
            style={{ ...inputStyle, padding: '8px 12px', cursor: 'pointer' }}
          >
            {regions.map(r => (
              <option key={r} value={r}>
                {r === 'All' ? '全部市场区域' : r}
              </option>
            ))}
          </select>
        </div>

        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <span style={{ fontSize: '0.85rem', color: 'var(--color-muted)', fontWeight: 500 }}>相关行业</span>
          <select
            value={selectedIndustry}
            onChange={(e) => setSelectedIndustry(e.target.value)}
            style={{ ...inputStyle, padding: '8px 12px', cursor: 'pointer' }}
          >
            <option value="All">全部行业</option>
            {STANDARD_CATEGORIES.map(ind => (
              <option key={ind} value={ind}>
                {ind}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* 列表网格 */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '24px' }}>
        {paginatedReports.length > 0 ? (
          paginatedReports.map((report) => (
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
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                      <span style={{
                        fontSize: '0.75rem',
                        fontWeight: 'var(--btn-font-weight)',
                        letterSpacing: 'var(--btn-letter-spacing)',
                        color: report.category === 'customer' ? 'var(--color-accent)' : 'var(--color-muted)',
                        background: report.category === 'customer' ? 'rgba(255, 100, 30, 0.05)' : 'rgba(122, 117, 111, 0.08)',
                        padding: '5px 12px',
                        borderRadius: 'var(--border-radius)'
                      }}>
                        {report.category === 'customer' ? '客户洞察' : '品类分析'}
                      </span>
                      {report.industries && (
                        <span style={{
                          fontSize: '0.72rem',
                          color: '#2e5bff',
                          background: 'rgba(46, 91, 255, 0.05)',
                          border: '1px solid rgba(46, 91, 255, 0.12)',
                          padding: '4px 8px',
                          borderRadius: 'var(--border-radius)'
                        }}>
                          {report.industries.split(',')[0].trim()}
                        </span>
                      )}
                    </div>
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
                            borderRadius: 'var(--border-radius)',
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
                        borderRadius: 'var(--border-radius)',
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
                          borderRadius: 'var(--border-radius)',
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

      {/* 分页控制器 */}
      {totalPages > 1 && (
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginTop: '40px',
          padding: '16px 24px',
          background: 'rgba(255, 255, 255, 0.45)',
          backdropFilter: 'blur(15px)',
          WebkitBackdropFilter: 'blur(15px)',
          border: '1px solid rgba(18, 18, 18, 0.05)',
          borderRadius: 'var(--border-radius)',
          boxShadow: '0 6px 20px rgba(0, 0, 0, 0.01)',
          flexWrap: 'wrap',
          gap: '16px'
        }}>
          <span style={{ fontSize: '0.85rem', color: 'var(--color-muted)', fontWeight: 300 }}>
            显示第 <strong style={{ color: 'var(--color-text)', fontWeight: 500 }}>{(currentPage - 1) * pageSize + 1}</strong> 到 <strong style={{ color: 'var(--color-text)', fontWeight: 500 }}>{Math.min(currentPage * pageSize, filtered.length)}</strong> 条，共 <strong style={{ color: 'var(--color-text)', fontWeight: 500 }}>{filtered.length}</strong> 篇报告
          </span>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <button
              onClick={() => {
                if (currentPage > 1) {
                  setCurrentPage(prev => prev - 1);
                  window.scrollTo({ top: 200, behavior: 'smooth' });
                }
              }}
              disabled={currentPage <= 1}
              style={{
                padding: '6px 14px',
                fontSize: '0.85rem',
                borderRadius: 'var(--border-radius)',
                border: '1px solid rgba(18, 18, 18, 0.1)',
                background: currentPage <= 1 ? 'rgba(0, 0, 0, 0.02)' : 'rgba(255, 255, 255, 0.8)',
                color: currentPage <= 1 ? 'rgba(18, 18, 18, 0.25)' : 'var(--color-text)',
                cursor: currentPage <= 1 ? 'not-allowed' : 'pointer',
                transition: 'all 0.2s'
              }}
            >
              上一页
            </button>

            {/* 页码数字按钮 */}
            {Array.from({ length: totalPages }, (_, i) => i + 1)
              .filter(p => p === 1 || p === totalPages || Math.abs(p - currentPage) <= 2)
              .map((p, idx, arr) => {
                const prevPage = arr[idx - 1];
                const showEllipsis = prevPage && p - prevPage > 1;
                return (
                  <React.Fragment key={p}>
                    {showEllipsis && <span style={{ color: 'var(--color-muted)', padding: '0 4px' }}>...</span>}
                    <button
                      onClick={() => {
                        setCurrentPage(p);
                        window.scrollTo({ top: 200, behavior: 'smooth' });
                      }}
                      style={{
                        padding: '6px 12px',
                        fontSize: '0.85rem',
                        borderRadius: 'var(--border-radius)',
                        border: p === currentPage ? '1px solid var(--color-accent)' : '1px solid rgba(18, 18, 18, 0.1)',
                        background: p === currentPage ? 'var(--color-accent)' : 'rgba(255, 255, 255, 0.8)',
                        color: p === currentPage ? '#ffffff' : 'var(--color-text)',
                        fontWeight: p === currentPage ? 500 : 400,
                        cursor: 'pointer',
                        transition: 'all 0.2s'
                      }}
                    >
                      {p}
                    </button>
                  </React.Fragment>
                );
              })}

            <button
              onClick={() => {
                if (currentPage < totalPages) {
                  setCurrentPage(prev => prev + 1);
                  window.scrollTo({ top: 200, behavior: 'smooth' });
                }
              }}
              disabled={currentPage >= totalPages}
              style={{
                padding: '6px 14px',
                fontSize: '0.85rem',
                borderRadius: 'var(--border-radius)',
                border: '1px solid rgba(18, 18, 18, 0.1)',
                background: currentPage >= totalPages ? 'rgba(0, 0, 0, 0.02)' : 'rgba(255, 255, 255, 0.8)',
                color: currentPage >= totalPages ? 'rgba(18, 18, 18, 0.25)' : 'var(--color-text)',
                cursor: currentPage >= totalPages ? 'not-allowed' : 'pointer',
                transition: 'all 0.2s'
              }}
            >
              下一页
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
