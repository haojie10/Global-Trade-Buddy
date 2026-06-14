import React, { useState } from 'react';
import Link from 'next/link';

export interface PlatformReport {
  id: string;
  title: string;
  category: string;
  market_region: string;
  summary: string;
  isUnlocked: boolean;
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
    const matchRegion = region === 'All' || r.market_region === region || r.market_region === '全球';
    return matchQuery && matchCat && matchRegion;
  });
}

interface ReportListProps {
  reports: PlatformReport[];
  userId: string;
  userRole: string;
  quota: number;
  onUnlockSuccess: (newQuota: number, unlockedReportId: string) => void;
}

export default function ReportList({ reports, userId, userRole, quota, onUnlockSuccess }: ReportListProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [selectedRegion, setSelectedRegion] = useState('All');

  const filtered = filterReports(reports, searchQuery, selectedCategory, selectedRegion);
  const regions = ['All', ...Array.from(new Set(reports.map(r => r.market_region).filter(Boolean)))];

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

  const inputStyle = {
    background: 'rgba(255, 255, 255, 0.65)',
    border: '1px solid rgba(15, 23, 42, 0.08)',
    borderRadius: '12px',
    padding: '12px 16px',
    fontSize: '0.85rem',
    color: '#0f172a',
    outline: 'none',
    transition: 'border-color 0.3s ease',
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
        backdropFilter: 'blur(16px)',
        padding: '16px 24px',
        borderRadius: '20px',
        border: '1px solid rgba(15, 23, 42, 0.08)',
        boxShadow: '0 4px 20px rgba(15, 23, 42, 0.02)'
      }}>
        <input
          type="text"
          placeholder="🔍 搜索报告标题或摘要内容..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          style={{ ...inputStyle, flex: 1, minWidth: '240px' }}
        />
        
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <span style={{ fontSize: '0.85rem', color: '#475569', fontWeight: 500 }}>类别</span>
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            style={{ ...inputStyle, padding: '8px 12px', cursor: 'pointer' }}
          >
            <option value="All">全部类别</option>
            <option value="customer">👥 客户洞察</option>
            <option value="product">📈 品类分析</option>
          </select>
        </div>

        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <span style={{ fontSize: '0.85rem', color: '#475569', fontWeight: 500 }}>市场</span>
          <select
            value={selectedRegion}
            onChange={(e) => setSelectedRegion(e.target.value)}
            style={{ ...inputStyle, padding: '8px 12px', cursor: 'pointer' }}
          >
            {regions.map(r => (
              <option key={r} value={r}>
                {r === 'All' ? '全部地区' : `🎯 ${r}`}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* 列表网格 */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: '24px' }}>
        {filtered.length > 0 ? (
          filtered.map((report) => (
            <Link 
              href={`/reports/${report.id}`} 
              key={report.id} 
              style={{ textDecoration: 'none' }}
            >
              <div style={{
                border: '1px solid rgba(15, 23, 42, 0.08)',
                borderRadius: '24px',
                padding: '28px',
                background: 'rgba(255, 255, 255, 0.75)',
                backdropFilter: 'blur(20px)',
                cursor: 'pointer',
                transition: 'all 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                height: '260px',
                boxShadow: '0 8px 30px rgba(15, 23, 42, 0.03)'
              }}
              onMouseOver={(e) => {
                e.currentTarget.style.borderColor = 'rgba(37, 99, 235, 0.4)';
                e.currentTarget.style.transform = 'translateY(-6px)';
                e.currentTarget.style.boxShadow = '0 20px 40px rgba(37, 99, 235, 0.08)';
                e.currentTarget.style.background = 'rgba(255, 255, 255, 0.95)';
              }}
              onMouseOut={(e) => {
                e.currentTarget.style.borderColor = 'rgba(15, 23, 42, 0.08)';
                e.currentTarget.style.transform = 'none';
                e.currentTarget.style.boxShadow = '0 8px 30px rgba(15, 23, 42, 0.03)';
                e.currentTarget.style.background = 'rgba(255, 255, 255, 0.75)';
              }}
              >
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                    <span style={{
                      fontSize: '0.75rem',
                      fontWeight: 500,
                      color: report.category === 'customer' ? '#2563eb' : '#b45309',
                      background: report.category === 'customer' ? 'rgba(37, 99, 235, 0.06)' : 'rgba(217, 119, 6, 0.06)',
                      padding: '5px 12px',
                      borderRadius: '8px'
                    }}>
                      {report.category === 'customer' ? '👥 客户洞察' : '📈 品类分析'}
                    </span>
                    <span style={{ fontSize: '0.8rem', color: '#475569', fontWeight: 500 }}>
                      🎯 {report.market_region}
                    </span>
                  </div>
                  <h4 style={{
                    margin: '0 0 10px 0',
                    fontSize: '1.05rem',
                    color: '#0f172a',
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
                    color: '#475569',
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
                  borderTop: '1px solid rgba(15, 23, 42, 0.06)',
                  paddingTop: '16px'
                }}>
                  {report.isUnlocked ? (
                    <span style={{
                      fontSize: '0.75rem',
                      fontWeight: 500,
                      padding: '4px 10px',
                      borderRadius: '8px',
                      background: 'rgba(16, 185, 129, 0.08)',
                      color: '#059669'
                    }}>
                      ✅ 已解锁
                    </span>
                  ) : (
                    <button
                      onClick={(e) => handleUnlock(e, report.id)}
                      style={{
                        background: 'rgba(217, 119, 6, 0.08)',
                        border: 'none',
                        color: '#b45309',
                        fontSize: '0.75rem',
                        fontWeight: 500,
                        padding: '4px 10px',
                        borderRadius: '8px',
                        cursor: 'pointer',
                        transition: 'background 0.2s'
                      }}
                      onMouseOver={(e) => e.currentTarget.style.background = 'rgba(217, 119, 6, 0.15)'}
                      onMouseOut={(e) => e.currentTarget.style.background = 'rgba(217, 119, 6, 0.08)'}
                    >
                      🔒 未解锁 (点击解锁)
                    </button>
                  )}
                  <span style={{ fontSize: '0.8rem', color: '#2563eb', fontWeight: 500 }}>
                    立即预览与解锁 →
                  </span>
                </div>
              </div>
            </Link>
          ))
        ) : (
          <div style={{ gridColumn: '1 / -1', padding: '80px 40px', textAlign: 'center', color: '#64748b', fontWeight: 300 }}>
            📭 没有符合筛选条件的报告。
          </div>
        )}
      </div>
    </div>
  );
}
