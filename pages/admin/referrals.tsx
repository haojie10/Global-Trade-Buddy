import React, { useState, useEffect } from 'react';
import AdminLayout from '../../components/admin/AdminLayout';
import SimpleChart from '../../components/admin/SimpleChart';

interface ReferralsData {
  funnelData: Array<{ name: string; value: number }>;
  leaderboard: Array<{ name: string; email: string; value: number }>;
}

export default function AdminReferrals() {
  const [data, setData] = useState<ReferralsData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      try {
        const res = await fetch('/api/admin/stats/referrals');
        if (res.ok) {
          const stats = await res.json();
          setData(stats);
        }
      } catch (err) {
        console.error('Error fetching referrals stats:', err);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, []);

  return (
    <AdminLayout currentPage="referrals">
      <div className="admin-body">
        <div className="admin-topbar">
          <h1 className="admin-page-title">🔗 邀请转化</h1>
        </div>

        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '60vh', color: 'var(--admin-text-secondary)' }}>
            正在加载邀请转化数据分析中...
          </div>
        ) : data ? (
          <>
            {/* 邀请漏斗与排行榜 */}
            <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '20px' }}>
              {/* 漏斗分析 */}
              <div className="admin-card">
                <h3 className="admin-card-title">📊 邀请转化漏斗</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', padding: '10px 0' }}>
                  {data.funnelData.map((step, idx) => {
                    const maxVal = data.funnelData[0]?.value || 1;
                    const percent = maxVal > 0 ? Math.round((step.value / maxVal) * 100) : 0;
                    
                    // 渐进宽度漏斗图
                    return (
                      <div key={idx} style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
                          <span style={{ fontWeight: '500' }}>
                            {idx + 1}. {step.name}
                          </span>
                          <span style={{ color: 'var(--admin-accent-light)', fontWeight: 'bold' }}>
                            {step.value} 人 ({percent}%)
                          </span>
                        </div>
                        <div style={{
                          height: '24px',
                          background: 'rgba(255, 255, 255, 0.03)',
                          border: '1px solid var(--admin-border)',
                          borderRadius: '4px',
                          overflow: 'hidden'
                        }}>
                          <div style={{
                            width: `${percent}%`,
                            height: '100%',
                            background: 'linear-gradient(90deg, var(--admin-accent), var(--admin-accent-light))',
                            transition: 'width 0.5s ease'
                          }}></div>
                        </div>
                      </div>
                    );
                  })}
                  
                  <div style={{
                    background: 'rgba(16, 185, 129, 0.05)',
                    border: '1px solid rgba(16, 185, 129, 0.15)',
                    padding: '14px',
                    borderRadius: '6px',
                    fontSize: '0.85rem',
                    lineHeight: '1.5',
                    marginTop: '10px'
                  }}>
                    <strong>💡 漏斗分析结论:</strong>
                    <p style={{ margin: '6px 0 0 0', color: 'var(--admin-text-secondary)' }}>
                      被邀请注册的用户中，约有 <strong>{
                        data.funnelData[1]?.value > 0 
                          ? Math.round((data.funnelData[2]?.value / data.funnelData[1]?.value) * 100) 
                          : 0
                      }%</strong> 的用户完成了首次报告解锁（即成为了真正的活跃用户）。裂变转化率健康，建议继续保持当前的邀请双向赠送额度政策。
                    </p>
                  </div>
                </div>
              </div>

              {/* 邀请达人排行榜 */}
              <div className="admin-card">
                <h3 className="admin-card-title">👑 邀请裂变达人排行 Top 15</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {data.leaderboard.map((user, idx) => (
                    <div key={idx} className="admin-list-item">
                      <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '240px' }}>
                        <span style={{ color: 'var(--admin-text-secondary)', marginRight: '6px', fontWeight: 'bold' }}>
                          {idx + 1}
                        </span>
                        <span style={{ fontSize: '0.85rem', fontWeight: '500' }}>{user.name}</span>
                      </div>
                      <span className="admin-badge admin-badge-success">成功邀请 {user.value} 人</span>
                    </div>
                  ))}
                  {data.leaderboard.length === 0 && (
                    <div style={{ color: 'var(--admin-text-secondary)', fontSize: '0.85rem', textAlign: 'center', padding: '40px 0' }}>
                      当前暂无邀请成功记录
                    </div>
                  )}
                </div>
              </div>
            </div>
          </>
        ) : null}
      </div>
    </AdminLayout>
  );
}
