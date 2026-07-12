import React, { useState, useEffect } from 'react';
import AdminLayout from '../../components/admin/AdminLayout';
import SimpleChart from '../../components/admin/SimpleChart';

interface UserData {
  userGrowth: Array<{ name: string; value: number }>;
  userLeaderboard: Array<{ id: string; name: string; email: string; views: number; unlocks: number }>;
  searchTerms: Array<{ name: string; value: number }>;
  userList: Array<{ id: string; email: string; nickname: string; created_at: string; last_seen: string | null; segment: string }>;
}

export default function AdminUserAnalysis() {
  const [data, setData] = useState<UserData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      try {
        const res = await fetch('/api/admin/stats/users');
        if (res.ok) {
          const stats = await res.json();
          setData(stats);
        }
      } catch (err) {
        console.error('Error fetching user stats:', err);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, []);

  return (
    <AdminLayout currentPage="users">
      <div className="admin-body">
        <div className="admin-topbar">
          <h1 className="admin-page-title">👥 用户分析</h1>
        </div>

        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '60vh', color: 'var(--admin-text-secondary)' }}>
            正在加载用户行为数据中...
          </div>
        ) : data ? (
          <>
            {/* 图表排 */}
            <div className="admin-chart-grid" style={{ marginBottom: '24px' }}>
              <div className="admin-card">
                <h3 className="admin-card-title">📈 用户注册增长曲线</h3>
                <SimpleChart type="line" data={data.userGrowth} color="var(--admin-success)" />
              </div>
              <div className="admin-card">
                <h3 className="admin-card-title">🔍 高频搜索关键词排行</h3>
                <SimpleChart type="bar" data={data.searchTerms} color="var(--admin-warning)" />
              </div>
            </div>

            {/* 用户列表和活跃度排行 */}
            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '20px' }}>
              {/* 详细用户列表 */}
              <div className="admin-card">
                <h3 className="admin-card-title">👥 注册用户列表及状态</h3>
                <div className="admin-table-container">
                  <table className="admin-table">
                    <thead>
                      <tr>
                        <th>昵称 / 邮箱</th>
                        <th>注册时间</th>
                        <th>最后活跃</th>
                        <th>活跃状态</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.userList.map(user => {
                        const regDate = new Date(user.created_at).toLocaleDateString('zh-CN');
                        const lastSeenDate = user.last_seen 
                          ? new Date(user.last_seen).toLocaleDateString('zh-CN') 
                          : '从无行为';
                        
                        let badgeClass = 'admin-badge-success';
                        if (user.segment === '中活跃') badgeClass = 'admin-badge-warning';
                        if (user.segment === '沉默') badgeClass = 'admin-badge-error';

                        return (
                          <tr key={user.id}>
                            <td>
                              <div style={{ fontWeight: '500' }}>{user.nickname || '未设置昵称'}</div>
                              <div style={{ fontSize: '0.75rem', color: 'var(--admin-text-secondary)' }}>{user.email}</div>
                            </td>
                            <td>{regDate}</td>
                            <td>{lastSeenDate}</td>
                            <td>
                              <span className={`admin-badge ${badgeClass}`}>{user.segment}</span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* 用户行为排行榜 */}
              <div className="admin-card">
                <h3 className="admin-card-title">🔥 活跃行为排行榜 Top 15</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {data.userLeaderboard.map((user, idx) => (
                    <div key={user.id} className="admin-list-item">
                      <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '180px' }}>
                        <span style={{ color: 'var(--admin-text-secondary)', marginRight: '6px', fontWeight: 'bold' }}>
                          {idx + 1}
                        </span>
                        <span style={{ fontSize: '0.85rem', fontWeight: '500' }}>{user.name}</span>
                      </div>
                      <div style={{ display: 'flex', gap: '6px' }}>
                        <span className="admin-badge admin-badge-info">{user.views} 浏览</span>
                        <span className="admin-badge admin-badge-success">{user.unlocks} 解锁</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </>
        ) : null}
      </div>
    </AdminLayout>
  );
}
