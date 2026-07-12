import React, { useState, useEffect } from 'react';
import AdminLayout from '../../components/admin/AdminLayout';
import SimpleChart from '../../components/admin/SimpleChart';

interface TrendData {
  entityHeat: Array<{ id: string; name: string; type: string; report_count: number; view_count: number }>;
  emergingKeywords: Array<{ name: string; value: number }>;
  industryConcern: Array<{ name: string; value: number }>;
}

export default function AdminTrends() {
  const [data, setData] = useState<TrendData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      try {
        const res = await fetch('/api/admin/stats/trends');
        if (res.ok) {
          const stats = await res.json();
          setData(stats);
        }
      } catch (err) {
        console.error('Error fetching trend stats:', err);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, []);

  const translateType = (type: string) => {
    const maps: Record<string, string> = {
      company: '公司',
      product: '品类/产品',
      channel: '渠道',
      competitor: '竞争对手',
      region: '市场区域'
    };
    return maps[type] || type;
  };

  return (
    <AdminLayout currentPage="trends">
      <div className="admin-body">
        <div className="admin-topbar">
          <h1 className="admin-page-title">🔥 趋势洞察</h1>
        </div>

        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '60vh', color: 'var(--admin-text-secondary)' }}>
            正在加载趋势洞察分析中...
          </div>
        ) : data ? (
          <>
            {/* 图表排 */}
            <div className="admin-chart-grid" style={{ marginBottom: '24px' }}>
              <div className="admin-card">
                <h3 className="admin-card-title">📈 行业关注度变动情况 (近30天浏览次数)</h3>
                <SimpleChart type="bar" data={data.industryConcern} color="var(--admin-accent)" />
              </div>
              <div className="admin-card">
                <h3 className="admin-card-title">🚀 最近7天热搜词汇</h3>
                <SimpleChart type="bar" data={data.emergingKeywords} color="var(--admin-accent-light)" />
              </div>
            </div>

            {/* 实体热度明细表 */}
            <div className="admin-card">
              <h3 className="admin-card-title">🔗 关联实体热度排行榜 (包含公司、产品、渠道)</h3>
              <div className="admin-table-container">
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th>实体名称</th>
                      <th>实体类型</th>
                      <th>关联报告数</th>
                      <th>关联报告浏览量</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.entityHeat.map(entity => {
                      let typeColor = 'admin-badge-info';
                      if (entity.type === 'company') typeColor = 'admin-badge-success';
                      if (entity.type === 'product') typeColor = 'admin-badge-info';
                      if (entity.type === 'channel') typeColor = 'admin-badge-warning';

                      return (
                        <tr key={entity.id}>
                          <td style={{ fontWeight: '500' }}>{entity.name}</td>
                          <td>
                            <span className={`admin-badge ${typeColor}`}>
                              {translateType(entity.type)}
                            </span>
                          </td>
                          <td>{entity.report_count} 篇</td>
                          <td>
                            <span style={{ color: 'var(--admin-accent-light)', fontWeight: 'bold' }}>
                              {entity.view_count} 次
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                    {data.entityHeat.length === 0 && (
                      <tr>
                        <td colSpan={4} style={{ textAlign: 'center', color: 'var(--admin-text-secondary)', padding: '20px 0' }}>
                          暂无实体数据，请先上传报告并提取实体
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        ) : null}
      </div>
    </AdminLayout>
  );
}
