import React, { useState, useEffect } from 'react';
import { GetServerSideProps } from 'next';
import Link from 'next/link';
import { getSession } from '../../lib/auth';
import AdminLayout from '../../components/admin/AdminLayout';
import KpiCard from '../../components/admin/KpiCard';
import SimpleChart from '../../components/admin/SimpleChart';

interface StatsData {
  kpi: {
    totalReports: { value: number; change: string; period: string };
    totalUsers: { value: number; change: string; period: string };
    totalViews: { value: number; change: string; period: string };
    avgDuration: { value: string; change: string; period: string };
    unlockRate: { value: string; change: string; period: string };
    expiredReports: { value: number; label: string };
  };
  viewsTrend: Array<{ name: string; value: number }>;
  topReports: Array<{ name: string; value: number; id: string }>;
  searchGaps: Array<{ name: string; value: number }>;
  expiredList: Array<{ id: string; title: string; ageDays: number }>;
  userSegments: Array<{ name: string; value: number }>;
}

export default function AdminDashboard() {
  const [range, setRange] = useState<'7d' | '30d' | '90d'>('7d');
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<StatsData | null>(null);

  useEffect(() => {
    async function fetchData() {
      setLoading(true);
      try {
        const res = await fetch(`/api/admin/stats/overview?range=${range}`);
        if (res.ok) {
          const stats = await res.json();
          setData(stats);
        } else {
          console.error('Failed to fetch dashboard stats');
        }
      } catch (err) {
        console.error('Error fetching stats:', err);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, [range]);

  return (
    <AdminLayout currentPage="overview">
      <div className="admin-body">
        {/* 顶部栏 */}
        <div className="admin-topbar">
          <h1 className="admin-page-title">📊 数据总览</h1>
          
          <div className="admin-time-filter">
            <button 
              className={`admin-time-btn ${range === '7d' ? 'active' : ''}`}
              onClick={() => setRange('7d')}
            >
              近 7 天
            </button>
            <button 
              className={`admin-time-btn ${range === '30d' ? 'active' : ''}`}
              onClick={() => setRange('30d')}
            >
              近 30 天
            </button>
            <button 
              className={`admin-time-btn ${range === '90d' ? 'active' : ''}`}
              onClick={() => setRange('90d')}
            >
              近 90 天
            </button>
          </div>
        </div>

        {loading && !data ? (
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '60vh', color: 'var(--admin-text-secondary)' }}>
            正在加载图表与指标数据...
          </div>
        ) : data ? (
          <>
            {/* KPI 指标卡片 */}
            <div className="admin-kpi-grid">
              <KpiCard 
                label="总报告数" 
                value={data.kpi.totalReports.value} 
                change={data.kpi.totalReports.change}
                changeLabel={data.kpi.totalReports.period}
                accentColor="var(--admin-accent)"
              />
              <KpiCard 
                label="注册用户" 
                value={data.kpi.totalUsers.value} 
                change={data.kpi.totalUsers.change}
                changeLabel={data.kpi.totalUsers.period}
                accentColor="var(--admin-success)"
              />
              <KpiCard 
                label="总浏览次数" 
                value={data.kpi.totalViews.value} 
                change={data.kpi.totalViews.change}
                changeLabel={data.kpi.totalViews.period}
                accentColor="var(--admin-warning)"
              />
              <KpiCard 
                label="平均停留时长" 
                value={data.kpi.avgDuration.value} 
                change={data.kpi.avgDuration.change}
                changeLabel={data.kpi.avgDuration.period}
                accentColor="var(--admin-info)"
              />
              <KpiCard 
                label="报告解锁率" 
                value={data.kpi.unlockRate.value} 
                change={data.kpi.unlockRate.change}
                changeLabel={data.kpi.unlockRate.period}
                accentColor="var(--admin-accent-light)"
              />
              <KpiCard 
                label="老化报告" 
                value={data.kpi.expiredReports.value} 
                change={data.kpi.expiredReports.label}
                accentColor="var(--admin-error)"
              />
            </div>

            {/* 中间图表区 */}
            <div className="admin-chart-grid">
              {/* 浏览量趋势 */}
              <div className="admin-card">
                <h3 className="admin-card-title">
                  📈 浏览量趋势
                  <span style={{ fontSize: '0.75rem', fontWeight: 'normal', color: 'var(--admin-text-secondary)' }}>
                    {range === '7d' ? '近7天每日浏览统计' : range === '30d' ? '近30天每日浏览统计' : '近90天每日浏览统计'}
                  </span>
                </h3>
                <SimpleChart type="line" data={data.viewsTrend} color="var(--admin-accent)" />
              </div>

              {/* 热门排行 */}
              <div className="admin-card">
                <h3 className="admin-card-title">🏆 热门报告 Top 5</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {data.topReports && data.topReports.length > 0 ? (
                    data.topReports.map((report, idx) => (
                      <div key={report.id} className="admin-list-item">
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          <span style={{
                            color: idx === 0 ? '#ffd700' : idx === 1 ? '#c0c0c0' : idx === 2 ? '#cd7f32' : 'var(--admin-text-secondary)',
                            fontWeight: 'bold',
                            width: '16px'
                          }}>
                            {idx + 1}
                          </span>
                          <Link href={`/reports/${report.id}`} target="_blank" style={{ color: 'var(--admin-text)', textDecoration: 'none' }}>
                            <span style={{ fontSize: '0.85rem' }}>{report.name}</span>
                          </Link>
                        </div>
                        <span className="admin-badge admin-badge-info">{report.value} 次浏览</span>
                      </div>
                    ))
                  ) : (
                    <div style={{ color: 'var(--admin-text-secondary)', fontSize: '0.85rem', textAlign: 'center', padding: '40px 0' }}>
                      暂无浏览行为记录
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* 底部预警三栏区 */}
            <div className="admin-alert-grid">
              {/* 搜索缺口 */}
              <div className="admin-card">
                <h3 className="admin-card-title" style={{ color: 'var(--admin-warning)' }}>
                  🔍 搜索缺口 (无结果 Top 5)
                </h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {data.searchGaps && data.searchGaps.length > 0 ? (
                    data.searchGaps.map((gap, idx) => (
                      <div key={idx} className="admin-list-item">
                        <span style={{ fontSize: '0.85rem', color: 'var(--admin-text)' }}>
                          {gap.name}
                        </span>
                        <span className="admin-badge admin-badge-warning">{gap.value} 次搜索</span>
                      </div>
                    ))
                  ) : (
                    <div style={{ color: 'var(--admin-text-secondary)', fontSize: '0.85rem', textAlign: 'center', padding: '20px 0' }}>
                      暂无搜索缺口记录
                    </div>
                  )}
                </div>
              </div>

              {/* 过期报告 */}
              <div className="admin-card">
                <h3 className="admin-card-title" style={{ color: 'var(--admin-error)' }}>
                  ⚠️ 老化报告预警
                </h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {data.expiredList && data.expiredList.length > 0 ? (
                    data.expiredList.map((rep) => (
                      <div key={rep.id} className="admin-list-item">
                        <Link href={`/reports/${rep.id}`} target="_blank" style={{ color: 'var(--admin-text)', textDecoration: 'none', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '180px' }}>
                          <span style={{ fontSize: '0.85rem' }}>{rep.title}</span>
                        </Link>
                        <span className="admin-badge admin-badge-error">{rep.ageDays} 天未更新</span>
                      </div>
                    ))
                  ) : (
                    <div style={{ color: 'var(--admin-text-secondary)', fontSize: '0.85rem', textAlign: 'center', padding: '20px 0' }}>
                      当前没有超过 90 天未更新的报告
                    </div>
                  )}
                </div>
              </div>

              {/* 用户分层 */}
              <div className="admin-card">
                <h3 className="admin-card-title" style={{ color: 'var(--admin-success)' }}>
                  👥 用户活跃度分层
                </h3>
                {data.userSegments && data.userSegments.some(s => s.value > 0) ? (
                  <SimpleChart 
                    type="pie" 
                    data={data.userSegments} 
                    colors={['var(--admin-success)', 'var(--admin-warning)', 'var(--admin-error)']}
                    height={180}
                  />
                ) : (
                  <div style={{ color: 'var(--admin-text-secondary)', fontSize: '0.85rem', textAlign: 'center', padding: '40px 0' }}>
                    暂无用户活跃数据
                  </div>
                )}
              </div>
            </div>
          </>
        ) : null}
      </div>
    </AdminLayout>
  );
}

export const getServerSideProps: GetServerSideProps = async (context) => {
  const session = getSession(context.req as any);
  
  if (!session || session.role !== 'admin') {
    return {
      redirect: {
        destination: '/',
        permanent: false,
      },
    };
  }

  return {
    props: {}
  };
};
