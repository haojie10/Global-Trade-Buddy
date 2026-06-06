import { GetServerSideProps } from 'next';
import React, { useState } from 'react';
import { Client } from 'pg';
import { getReportDetail } from '../../api/user/report-detail';
import WatermarkContainer from '../../../components/WatermarkContainer';
import Link from 'next/link';

interface RelatedReport {
  id: string;
  title: string;
  category: string;
  market_region: string;
}

interface ReportDetailProps {
  report: {
    id: string;
    title: string;
    category: string;
    market_region: string;
    summary: string;
    isUnlocked: boolean;
    content_html: string | null;
  };
  related: RelatedReport[];
  userId: string;
}

export default function ReportDetailPage({ report, related, userId }: ReportDetailProps) {
  const [unlocked, setUnlocked] = useState(report.isUnlocked);
  const [content, setContent] = useState(report.content_html);

  // 模拟微信/支付宝扫码解锁功能
  const handleUnlock = async () => {
    try {
      const res = await fetch(`/api/user/unlock-action`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, reportId: report.id }),
      });
      const data = await res.json();
      if (data.success) {
        setUnlocked(true);
        setContent(data.content_html);
      } else {
        alert(data.error || '解锁失败，请充值额度');
      }
    } catch (err) {
      alert('连接支付网关失败');
    }
  };

  return (
    <WatermarkContainer text={`外贸智友 - 用户A (已授权)`}>
      <div style={{ maxWidth: '900px', margin: '0 auto', padding: '40px 20px', fontFamily: 'system-ui, sans-serif' }}>
        
        {/* 面包屑 */}
        <div style={{ marginBottom: '20px', fontSize: '0.85rem' }}>
          <Link href="/" style={{ color: '#0071e3', textDecoration: 'none' }}>🏠 知识图谱主页</Link>
          <span style={{ color: '#86868b', margin: '0 8px' }}>/</span>
          <span style={{ color: '#86868b' }}>
            {report.category === 'customer' ? '👥 客户 360 度洞察' : '📈 品类分析'}
          </span>
        </div>

        {/* 标题 */}
        <h1 style={{ fontSize: '2rem', fontWeight: 700, color: '#1d1d1f', marginBottom: '12px' }}>
          {report.title}
        </h1>

        {/* 标签 */}
        <div style={{ display: 'flex', gap: '10px', marginBottom: '30px' }}>
          <span style={{ background: '#e8f4fd', color: '#0071e3', fontSize: '0.75rem', padding: '4px 10px', borderRadius: '4px', fontWeight: 600 }}>
            {report.category === 'customer' ? '客户洞察' : '品类分析'}
          </span>
          <span style={{ background: '#f5f5f7', color: '#86868b', fontSize: '0.75rem', padding: '4px 10px', borderRadius: '4px' }}>
            🎯 目标市场: {report.market_region}
          </span>
        </div>

        {/* 摘要区 */}
        <div style={{ background: '#f5f5f7', borderRadius: '12px', padding: '20px', marginBottom: '30px', borderLeft: '4px solid #0071e3' }}>
          <h3 style={{ margin: '0 0 8px 0', fontSize: '1rem', color: '#1d1d1f' }}>📖 报告摘要</h3>
          <p style={{ margin: 0, fontSize: '0.9rem', color: '#515154', lineHeight: 1.6 }}>{report.summary}</p>
        </div>

        {/* 内容展示区 */}
        <div style={{ position: 'relative', minHeight: '300px', marginBottom: '50px' }}>
          {unlocked ? (
            // 已解锁：完整渲染大图脱水后的 HTML
            <div 
              className="report-content-body"
              style={{ fontSize: '1rem', color: '#1d1d1f', lineHeight: 1.8 }}
              dangerouslySetInnerHTML={{ __html: content || '' }} 
            />
          ) : (
            // 未解锁：呈现高斯模糊模糊与引导解锁弹窗
            <div>
              <div style={{ filter: 'blur(6px)', userSelect: 'none', pointerEvents: 'none', opacity: 0.35, lineHeight: 1.8 }}>
                <p>这里是高度敏感的外贸客户交易细节及供应链核心数据分析...</p>
                <p>包含该买家在过去三年的采购总量、核心供应商分布、以及针对各大关税政策的应对变化调整。</p>
                <p>在海关数据记录中，该客户具有明显的采购周期性特征，且主要的议价权在以下决策人名下...</p>
              </div>
              
              {/* 解锁弹窗 */}
              <div style={{
                position: 'absolute',
                top: '50px',
                left: '50%',
                transform: 'translateX(-50%)',
                width: '90%',
                maxWidth: '450px',
                background: '#ffffff',
                border: '1px solid #d1d1d6',
                borderRadius: '16px',
                padding: '30px',
                textAlign: 'center',
                boxShadow: '0 10px 30px rgba(0,0,0,0.15)',
                zIndex: 10
              }}>
                <h3 style={{ margin: '0 0 10px 0', fontSize: '1.2rem' }}>🔒 解锁报告阅读全文</h3>
                <p style={{ fontSize: '0.85rem', color: '#86868b', marginBottom: '20px' }}>
                  此报告为付费增值资讯。您可以消耗 1 次免费额度，或通过微信/支付宝扫码付费解锁。
                </p>
                <button 
                  onClick={handleUnlock}
                  style={{
                    background: '#0071e3',
                    color: '#ffffff',
                    border: 'none',
                    borderRadius: '8px',
                    padding: '12px 24px',
                    fontSize: '0.95rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                    width: '100%',
                    transition: 'background 0.2s'
                  }}
                  onMouseOver={(e) => e.currentTarget.style.background = '#0077ed'}
                  onMouseOut={(e) => e.currentTarget.style.background = '#0071e3'}
                >
                  🚀 立即解锁报告 (消耗1次额度)
                </button>
              </div>
            </div>
          )}
        </div>

        {/* 知识跳转链 (强关联延伸推荐) */}
        {unlocked && related.length > 0 && (
          <div style={{ borderTop: '1px solid #d1d1d6', paddingTop: '40px' }}>
            <h3 style={{ fontSize: '1.1rem', fontWeight: 600, color: '#1d1d1f', marginBottom: '20px' }}>
              🔗 延伸知识链条 (顺藤摸瓜探索更多关联报告)
            </h3>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
              {related.map(item => (
                <Link href={`/reports/${item.id}`} key={item.id} style={{ textDecoration: 'none' }}>
                  <div style={{
                    border: '1px solid #d1d1d6',
                    borderRadius: '12px',
                    padding: '16px',
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                    background: '#ffffff'
                  }}
                  onMouseOver={(e) => {
                    e.currentTarget.style.borderColor = '#0071e3';
                    e.currentTarget.style.transform = 'translateY(-2px)';
                  }}
                  onMouseOut={(e) => {
                    e.currentTarget.style.borderColor = '#d1d1d6';
                    e.currentTarget.style.transform = 'none';
                  }}
                  >
                    <span style={{
                      fontSize: '0.65rem',
                      fontWeight: 600,
                      color: item.category === 'customer' ? '#0071e3' : '#ff9f0a',
                      background: item.category === 'customer' ? '#e8f4fd' : '#fee2e2',
                      padding: '2px 6px',
                      borderRadius: '4px',
                      display: 'inline-block',
                      marginBottom: '8px'
                    }}>
                      {item.category === 'customer' ? '👥 客户洞察' : '📈 品类分析'}
                    </span>
                    <h4 style={{ margin: '0 0 6px 0', fontSize: '0.95rem', color: '#1d1d1f' }}>{item.title}</h4>
                    <span style={{ fontSize: '0.75rem', color: '#86868b' }}>🌍 目标地区: {item.market_region}</span>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}

      </div>
    </WatermarkContainer>
  );
}

// 服务端数据预取 (SSR)
export const getServerSideProps: GetServerSideProps = async (context) => {
  const { id } = context.params!;
  
  // 模拟从 cookie / session 获取的当前登录用户 ID，实际应使用 auth session
  const mockUserId = context.query.userId as string || '13800000002'; // 用 User B 作为测试默认

  const dbClient = new Client({
    connectionString: process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/postgres',
  });
  await dbClient.connect();

  try {
    // 1. 获取报告详情和解锁校验
    const report = await getReportDetail(mockUserId, id as string, dbClient);

    // 2. 如果已解锁，获取与之有 relations 关联的其他报告（限制 4 份）
    let related: RelatedReport[] = [];
    if (report.isUnlocked) {
      const relatedRes = await dbClient.query(
        `SELECT r.id, r.title, r.category, r.market_region 
         FROM reports r
         JOIN relations rel ON (r.id = rel.report_id_a AND rel.report_id_b = $1) 
                            OR (r.id = rel.report_id_b AND rel.report_id_a = $1)
         LIMIT 4`,
        [id]
      );
      related = relatedRes.rows;
    }

    return {
      props: {
        report,
        related,
        userId: mockUserId
      }
    };
  } catch (err) {
    return { notFound: true };
  } finally {
    await dbClient.end();
  }
};
