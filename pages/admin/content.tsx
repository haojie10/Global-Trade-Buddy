import React, { useState, useEffect } from 'react';
import AdminLayout from '../../components/admin/AdminLayout';
import SimpleChart from '../../components/admin/SimpleChart';

interface ContentData {
  industryDist: Array<{ name: string; value: number }>;
  regionDist: Array<{ name: string; value: number }>;
  countryDist: Array<{ name: string; region: string; value: number }>;
  matrix: Array<{ industry: string; region: string; count: number }>;
  freshness: Array<{ name: string; value: number }>;
  gaps: Array<{ name: string; count: number }>;
  topicRecommendations: Array<{
    title: string;
    region: string;
    industry: string;
    reason: string;
    urgency: 'high' | 'medium';
  }>;
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

  // 渲染行业区域热力图矩阵
  const renderMatrix = () => {
    if (!data || !data.matrix) return null;

    // 从行业分布或矩阵中获取所有独立行业
    const industriesFromDist = data.industryDist.map(i => i.name).filter(Boolean);
    const industriesFromMatrix = data.matrix.map(m => m.industry).filter(Boolean);
    const industries = Array.from(new Set([...industriesFromDist, ...industriesFromMatrix]));
    const regions = ['北美', '欧洲', '亚太', '东南亚', '中东', '南美', '非洲'];

    if (industries.length === 0) {
      return (
        <div style={{ color: 'var(--admin-text-secondary)', fontSize: '0.85rem', padding: '20px 0' }}>
          暂无行业数据，请先为报告添加标准行业标签
        </div>
      );
    }

    return (
      <div className="admin-table-container" style={{ marginTop: '12px' }}>
        <table className="admin-table">
          <thead>
            <tr>
              <th style={{ minWidth: '160px' }}>行业品类 \ 目标大区</th>
              {regions.map(r => (
                <th key={r} style={{ textAlign: 'center', minWidth: '80px' }}>{r}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {industries.map(ind => {
              return (
                <tr key={ind}>
                  <td style={{ fontWeight: '500', color: 'var(--admin-text)' }}>{ind}</td>
                  {regions.map(reg => {
                    const match = data.matrix.find(m => m.industry === ind && m.region === reg);
                    const count = match ? match.count : 0;
                    
                    // 根据数量大小计算背景色深度
                    let cellStyle: React.CSSProperties = {};
                    if (count > 0) {
                      const alpha = Math.min(0.15 + (count * 0.15), 0.85);
                      cellStyle = {
                        backgroundColor: `rgba(99, 102, 241, ${alpha})`,
                        color: alpha > 0.4 ? '#ffffff' : 'var(--admin-text)',
                        fontWeight: 'bold',
                        textAlign: 'center',
                        borderRadius: '4px'
                      };
                    } else {
                      cellStyle = {
                        textAlign: 'center',
                        color: 'rgba(255,255,255,0.15)'
                      };
                    }

                    return (
                      <td key={reg} style={cellStyle}>
                        {count > 0 ? (
                          <span>{count} 篇</span>
                        ) : (
                          <span style={{ fontSize: '0.75rem' }}>-</span>
                        )}
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
        {/* 顶部标题 */}
        <div className="admin-topbar">
          <div>
            <h1 className="admin-page-title">📋 内容分析与选题指挥部</h1>
            <p style={{ color: 'var(--admin-text-secondary)', fontSize: '0.85rem', margin: '4px 0 0 0' }}>
              全平台研报结构大盘、地域覆盖热力图与基于真实用户搜索行为的智能选题建议。
            </p>
          </div>
        </div>

        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '60vh', color: 'var(--admin-text-secondary)' }}>
            正在加载内容数据分析中...
          </div>
        ) : data ? (
          <>
            {/* 第一排：分布图表（行业分布 + 报告新鲜度） */}
            <div className="admin-chart-grid" style={{ marginBottom: '24px' }}>
              <div className="admin-card">
                <h3 className="admin-card-title">🏭 行业研报覆盖大盘</h3>
                <SimpleChart type="bar" data={data.industryDist} color="var(--admin-accent)" />
              </div>
              <div className="admin-card">
                <h3 className="admin-card-title">🕒 报告时效与保鲜度体检</h3>
                <SimpleChart 
                  type="pie" 
                  data={data.freshness} 
                  colors={['var(--admin-success)', 'var(--admin-warning)', 'var(--admin-error)']}
                />
              </div>
            </div>

            {/* 第二排：行业 × 区域 热力图矩阵 */}
            <div className="admin-card" style={{ marginBottom: '24px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h3 className="admin-card-title" style={{ margin: 0 }}>🗺️ 行业 × 区域 全球内容火力地图</h3>
                <span style={{ fontSize: '0.75rem', color: 'var(--admin-text-secondary)' }}>
                  💡 颜色越深代表该大区研报沉淀越深，空白区域为核心拓品机会
                </span>
              </div>
              {renderMatrix()}
            </div>

            {/* 第三排：重点放大 —— 💡 缺口与内容倾斜建议看板 */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: '20px' }}>
              {/* 左侧：搜索缺口雷达 */}
              <div className="admin-card">
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
                  <span style={{ fontSize: '1.4rem' }}>🔍</span>
                  <div>
                    <h3 className="admin-card-title" style={{ margin: 0, color: 'var(--admin-warning)' }}>
                      搜索缺口雷达（热门未命中词）
                    </h3>
                    <p style={{ margin: '2px 0 0 0', fontSize: '0.75rem', color: 'var(--admin-text-secondary)' }}>
                      统计近 30 天用户主动检索但平台无匹配结果的关键词
                    </p>
                  </div>
                </div>

                {data.gaps && data.gaps.length > 0 ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    {data.gaps.map((gap, i) => (
                      <div
                        key={i}
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          padding: '12px 16px',
                          background: 'rgba(245, 158, 11, 0.04)',
                          border: '1px solid rgba(245, 158, 11, 0.15)',
                          borderRadius: '8px'
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <span style={{
                            width: '24px',
                            height: '24px',
                            borderRadius: '50%',
                            background: i < 3 ? 'var(--admin-warning)' : 'rgba(255,255,255,0.1)',
                            color: i < 3 ? '#000' : 'var(--admin-text-secondary)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: '0.75rem',
                            fontWeight: 700
                          }}>
                            {i + 1}
                          </span>
                          <span style={{ fontWeight: 600, color: 'var(--admin-text)', fontSize: '0.9rem' }}>
                            {gap.name}
                          </span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <span style={{ fontSize: '0.8rem', color: 'var(--admin-text-secondary)' }}>用户未命中搜索:</span>
                          <span className="admin-badge admin-badge-warning" style={{ fontWeight: 600 }}>
                            {gap.count} 次
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div style={{
                    padding: '30px',
                    textAlign: 'center',
                    background: 'rgba(255,255,255,0.02)',
                    borderRadius: '8px',
                    border: '1px dashed var(--admin-border)',
                    color: 'var(--admin-text-secondary)',
                    fontSize: '0.85rem'
                  }}>
                    🎉 近期暂无未命中搜索记录，现有研报能良好覆盖用户检索需求！
                  </div>
                )}
              </div>

              {/* 右侧：智能选题与采编建议 */}
              <div className="admin-card">
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
                  <span style={{ fontSize: '1.4rem' }}>🎯</span>
                  <div>
                    <h3 className="admin-card-title" style={{ margin: 0, color: 'var(--admin-accent-light)' }}>
                      智能选题与采编建议
                    </h3>
                    <p style={{ margin: '2px 0 0 0', fontSize: '0.75rem', color: 'var(--admin-text-secondary)' }}>
                      结合用户搜索盲区与全球热力图缺口自动推导
                    </p>
                  </div>
                </div>

                {data.topicRecommendations && data.topicRecommendations.length > 0 ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    {data.topicRecommendations.map((topic, i) => (
                      <div
                        key={i}
                        style={{
                          padding: '12px 16px',
                          background: 'rgba(99, 102, 241, 0.05)',
                          border: '1px solid rgba(99, 102, 241, 0.18)',
                          borderRadius: '8px',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '6px'
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '10px' }}>
                          <div style={{ fontWeight: 600, color: 'var(--admin-text)', fontSize: '0.9rem', lineHeight: '1.4' }}>
                            {topic.title}
                          </div>
                          {topic.urgency === 'high' ? (
                            <span className="admin-badge admin-badge-error" style={{ flexShrink: 0 }}>
                              🔥 紧缺需求
                            </span>
                          ) : (
                            <span className="admin-badge admin-badge-info" style={{ flexShrink: 0 }}>
                              ⚡ 盲区填补
                            </span>
                          )}
                        </div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--admin-text-secondary)', display: 'flex', gap: '16px' }}>
                          <span>🎯 目标大区: <strong style={{ color: 'var(--admin-accent-light)' }}>{topic.region}</strong></span>
                          <span>🏭 品类行业: <strong style={{ color: 'var(--admin-accent-light)' }}>{topic.industry}</strong></span>
                        </div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--admin-text-secondary)', background: 'rgba(0,0,0,0.2)', padding: '6px 10px', borderRadius: '4px', marginTop: '2px' }}>
                          💡 推荐依据: {topic.reason}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div style={{
                    padding: '30px',
                    textAlign: 'center',
                    background: 'rgba(255,255,255,0.02)',
                    borderRadius: '8px',
                    border: '1px dashed var(--admin-border)',
                    color: 'var(--admin-text-secondary)',
                    fontSize: '0.85rem'
                  }}>
                    数据正在持续积累中，将自动为您生成选题建议。
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
