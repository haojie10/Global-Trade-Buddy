import React, { useState, useEffect } from 'react';
import AdminLayout from '../../components/admin/AdminLayout';
import SimpleChart from '../../components/admin/SimpleChart';

interface ContentData {
  industryDist: Array<{ name: string; value: number }>;
  regionDist: Array<{ name: string; value: number }>;
  countryDist: Array<{ name: string; region: string; value: number }>;
  matrix: Array<{ industry: string; region: string; count: number }>;
  freshness: Array<{ name: string; value: number }>;
  reportsList: Array<{ id: string; title: string; created_at: string; industries: string; countries: string }>;
  gaps: Array<{ name: string; count: number }>;
}

export default function AdminContentAnalysis() {
  const [data, setData] = useState<ContentData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      try {
        const res = await fetch('/api/admin/stats/content');
        if (res.ok) {
          const stats = await res.json();
          setData(stats);
        }
      } catch (err) {
        console.error('Error fetching content stats:', err);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, []);

  // 渲染行业区域矩阵
  const renderMatrix = () => {
    if (!data || !data.matrix) return null;

    // 获取所有独立行业和区域（安全防御 null/undefined）
    const industries = Array.from(new Set(data.reportsList.flatMap(r => (r.industries || '').split(', ').filter(Boolean))));
    const regions = ['北美', '欧洲', '亚太', '东南亚', '中东', '南美', '非洲'];

    if (industries.length === 0) {
      return <div style={{ color: 'var(--admin-text-secondary)', fontSize: '0.85rem' }}>暂无行业数据，请先为报告打标签</div>;
    }

    return (
      <div className="admin-table-container" style={{ marginTop: '15px' }}>
        <table className="admin-table">
          <thead>
            <tr>
              <th>行业 \ 区域</th>
              {regions.map(r => <th key={r}>{r}</th>)}
            </tr>
          </thead>
          <tbody>
            {industries.map(ind => {
              return (
                <tr key={ind}>
                  <td style={{ fontWeight: '500' }}>{ind}</td>
                  {regions.map(reg => {
                    const match = data.matrix.find(m => m.industry === ind && m.region === reg);
                    const count = match ? match.count : 0;
                    
                    // 根据数量大小计算背景深度度
                    let cellStyle = {};
                    if (count > 0) {
                      const alpha = Math.min(0.1 + (count * 0.15), 0.8);
                      cellStyle = {
                        backgroundColor: `rgba(124, 111, 255, ${alpha})`,
                        color: alpha > 0.5 ? '#ffffff' : 'var(--admin-text)',
                        fontWeight: 'bold',
                        textAlign: 'center' as const
                      };
                    } else {
                      cellStyle = { textAlign: 'center' as const, color: 'rgba(255,255,255,0.15)' };
                    }

                    return (
                      <td key={reg} style={cellStyle}>
                        {count}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    );
  };

  return (
    <AdminLayout currentPage="content">
      <div className="admin-body">
        <div className="admin-topbar">
          <h1 className="admin-page-title">📋 内容分析</h1>
        </div>

        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '60vh', color: 'var(--admin-text-secondary)' }}>
            正在加载内容数据分析中...
          </div>
        ) : data ? (
          <>
            {/* 第一排：分布图表 */}
            <div className="admin-chart-grid" style={{ marginBottom: '24px' }}>
              <div className="admin-card">
                <h3 className="admin-card-title">🏭 行业报告数量分布</h3>
                <SimpleChart type="bar" data={data.industryDist} color="var(--admin-accent)" />
              </div>
              <div className="admin-card">
                <h3 className="admin-card-title">🕒 报告新鲜度分布</h3>
                <SimpleChart 
                  type="pie" 
                  data={data.freshness} 
                  colors={['var(--admin-success)', 'var(--admin-warning)', 'var(--admin-error)']}
                />
              </div>
            </div>

            {/* 第二排：行业区域热力图矩阵 */}
            <div className="admin-card" style={{ marginBottom: '24px' }}>
              <h3 className="admin-card-title">🗺️ 行业 × 区域 热力图矩阵</h3>
              {renderMatrix()}
            </div>

            {/* 第三排：分栏（报告库列表 vs 内容缺口建议） */}
            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '20px' }}>
              {/* 报告明细列表 */}
              <div className="admin-card">
                <h3 className="admin-card-title">📋 现有报告详情 ({data.reportsList.length} 篇)</h3>
                <div className="admin-table-container">
                  <table className="admin-table">
                    <thead>
                      <tr>
                        <th>报告标题</th>
                        <th>相关行业</th>
                        <th>覆盖国家</th>
                        <th>上传时间</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.reportsList.map(rep => {
                        const dateStr = new Date(rep.created_at).toLocaleDateString('zh-CN');
                        return (
                          <tr key={rep.id}>
                            <td>
                              <a href={`/reports/${rep.id}`} target="_blank" rel="noreferrer" style={{ color: 'var(--admin-text)', textDecoration: 'none', fontWeight: '500' }}>
                                {rep.title}
                              </a>
                            </td>
                            <td>{rep.industries || <span style={{ color: 'var(--admin-text-secondary)' }}>-</span>}</td>
                            <td>{rep.countries || <span style={{ color: 'var(--admin-text-secondary)' }}>-</span>}</td>
                            <td>{dateStr}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* 内容缺口建议 */}
              <div className="admin-card">
                <h3 className="admin-card-title" style={{ color: 'var(--admin-warning)' }}>💡 缺口与内容倾斜建议</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <div style={{ background: 'rgba(245, 158, 11, 0.05)', border: '1px solid rgba(245, 158, 11, 0.15)', padding: '12px', borderRadius: '6px', fontSize: '0.85rem' }}>
                    <strong>🔍 热门无结果搜索词</strong>
                    <ul style={{ margin: '8px 0 0 0', paddingLeft: '16px', color: 'var(--admin-text)' }}>
                      {data.gaps.map((gap, i) => (
                        <li key={i} style={{ marginBottom: '4px' }}>
                          {gap.name} (用户检索了 {gap.count} 次)
                        </li>
                      ))}
                      {data.gaps.length === 0 && <li style={{ color: 'var(--admin-text-secondary)' }}>暂无未命中搜索记录</li>}
                    </ul>
                  </div>

                  <div style={{ background: 'rgba(124, 111, 255, 0.05)', border: '1px solid rgba(124, 111, 255, 0.15)', padding: '12px', borderRadius: '6px', fontSize: '0.85rem', lineHeight: '1.5' }}>
                    <strong>📈 选品倾斜建议:</strong>
                    <p style={{ margin: '6px 0 0 0', color: 'var(--admin-text-secondary)' }}>
                      根据最新的“行业 × 区域热力图”，以及无结果的高频搜索词汇，建议您优先补充<strong>东南亚地区</strong>和<strong>汽车零部件行业</strong>的报告。特别是与用户查询高度契合的越南、墨西哥建材相关内容。
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </>
        ) : null}
      </div>
    </AdminLayout>
  );
}
