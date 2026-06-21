import { GetServerSideProps } from 'next';
import React, { useState } from 'react';
import pool from '../../lib/db';
import { parseCookies } from '../../lib/cookies';
import { getReportDetail } from '../api/user/report-detail';
import WatermarkContainer from '../../components/WatermarkContainer';
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
  userRole: string;
}

if (typeof window !== 'undefined') {
  (window as any).switchSection = (sectionId: string) => {
    const sections = document.querySelectorAll('.report-section-content');
    sections.forEach(sec => {
      sec.classList.remove('active');
    });

    const targetSection = document.getElementById(sectionId);
    if (targetSection) {
      targetSection.classList.add('active');
    }

    const buttons = document.querySelectorAll('.nav-tab-btn');
    buttons.forEach(btn => {
      btn.classList.remove('active');
    });

    const activeBtn = document.getElementById('btn-' + sectionId);
    if (activeBtn) {
      activeBtn.classList.add('active');
    }
  };
}

function cleanHtmlBody(rawHtml: string): string {
  if (!rawHtml) return '';
  
  // 1. 提取所有 <style> 标签内容以保留样式
  const styleRegex = /<style[^>]*>([\s\S]*?)<\/style>/gi;
  let stylesStr = '';
  let match;
  while ((match = styleRegex.exec(rawHtml)) !== null) {
    stylesStr += match[0] + '\n';
  }

  // 限制样式只作用于报告容器内，防污染全局 body
  stylesStr = stylesStr.replace(/\bbody\s*(?=[{,])/g, '.report-content-body');

  // 2. 提取 <body> 内部的真实内容
  const bodyMatch = rawHtml.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
  let bodyContent = bodyMatch ? bodyMatch[1] : rawHtml;

  // 3. 移除富文本中的所有 <script>
  bodyContent = bodyContent.replace(/<script[^>]*>([\s\S]*?)<\/script>/gi, '');

  // 4. 强制注入的基础重置样式，以适应 Scheme B 暖乳白图书阅读器风格
  const lightThemeOverrides = `
    <style>
      .report-content-body {
        width: 100%;
        font-family: 'Outfit', 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
        color: #3c3935;
      }
      .report-content-body h1, .report-content-body h2, .report-content-body h3, .report-content-body h4 {
        color: #3c3935 !important;
        font-weight: 400;
        margin-top: 1.5em;
        margin-bottom: 0.6em;
      }
      .report-content-body p, .report-content-body li {
        color: #7a756f !important;
        line-height: 1.7;
        margin-bottom: 1em;
        font-weight: 300;
      }
      .report-content-body a {
        color: #ff641e !important;
        text-decoration: none;
      }
      .report-content-body img {
        max-width: 100%;
        height: auto;
        border-radius: 22px;
        margin: 16px 0;
      }
      .report-content-body table {
        width: 100%;
        border-collapse: collapse;
        margin: 20px 0;
        background: #fdfbf7;
        border-radius: 14px;
        overflow: hidden;
      }
      .report-content-body th {
        background: rgba(255, 100, 30, 0.05);
        color: #3c3935;
        font-weight: 400;
        text-align: left;
        padding: 12px 16px;
      }
      .report-content-body td {
        border-bottom: 1px solid rgba(160, 109, 68, 0.05);
        color: #7a756f;
        padding: 12px 16px;
        font-weight: 300;
      }
      /* 强制重写模板中可能含有的暗色和白色硬编码背景 */
      .report-content-body, 
      .report-content-body div, 
      .report-content-body section,
      .report-content-body article {
        background: transparent !important;
        color: #3c3935 !important;
        border: none !important;
        box-shadow: none !important;
      }
    </style>
  `;

  return `${lightThemeOverrides}\n${stylesStr}\n${bodyContent}`;
}

export default function ReportDetailPage({ report, related, userId, userRole }: ReportDetailProps) {
  const [unlocked, setUnlocked] = useState(report.isUnlocked);
  const [content, setContent] = useState(report.content_html);

  React.useEffect(() => {
    // 挂载原 HTML 模板内联 onclick 所需 JavaScript 全局函数
  }, []);

  // 模拟微信/支付宝扫码解锁功能
  const handleUnlock = async () => {
    if (!userId) {
      alert('请先返回主页登录系统，再解锁报告！');
      return;
    }
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

  // 动态解析并执行 HTML 报告中携带的脚本（用于初始化 ECharts 和 Lucide 图标）
  React.useEffect(() => {
    if (!unlocked || !content) return;

    const scriptRegex = /<script([^>]*)>([\s\S]*?)<\/script>/gi;
    const scriptsToLoad: { src: string | null; content: string }[] = [];
    let match;
    while ((match = scriptRegex.exec(content)) !== null) {
      const attrs = match[1];
      const srcMatch = attrs.match(/src="([^"]*)"/i) || attrs.match(/src=\'([^\']*)\'/i);
      const src = srcMatch ? srcMatch[1] : null;
      const inlineCode = match[2];
      scriptsToLoad.push({ src, content: inlineCode });
    }

    if (scriptsToLoad.length === 0) return;

    const loadExternalScripts = async () => {
      for (const s of scriptsToLoad) {
        if (s.src) {
          const srcUrl = s.src;
          await new Promise((resolve) => {
            if (document.querySelector(`script[src="${srcUrl}"]`)) {
              resolve(true);
              return;
            }
            const script = document.createElement('script');
            script.src = srcUrl;
            script.async = false;
            script.onload = () => resolve(true);
            script.onerror = () => resolve(true);
            document.head.appendChild(script);
          });
        }
      }
    };

    const runInlineScripts = () => {
      setTimeout(() => {
        scriptsToLoad.forEach((s) => {
          if (!s.src && s.content.trim()) {
            try {
              const script = document.createElement('script');
              script.text = s.content;
              document.body.appendChild(script);
              document.body.removeChild(script);
            } catch (err) {
              console.error('执行内联报告脚本出错:', err);
            }
          }
        });
      }, 150);
    };

    loadExternalScripts().then(runInlineScripts);
  }, [unlocked, content]);

  return (
    <WatermarkContainer text={userId ? `外贸智友 - 业务员 ID: ${userId.substring(0, 8)}...` : '外贸智友 - 游客浏览模式'}>
      <div style={{
        background: 'var(--bg-main)',
        color: 'var(--color-text)',
        minHeight: '100vh',
        fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, sans-serif',
        position: 'relative'
      }}>
        {/* 渐变星云背景 - 清爽浅色淡暖色光晕 */}
        <div style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: '100%',
          background: 'radial-gradient(circle at 15% 15%, rgba(255, 100, 30, 0.02) 0%, transparent 50%), radial-gradient(circle at 85% 85%, rgba(255, 100, 30, 0.015) 0%, transparent 50%)',
          pointerEvents: 'none',
          zIndex: 0
        }} />

        <div style={{ 
          maxWidth: unlocked ? '1400px' : '900px', 
          margin: '0 auto', 
          padding: '40px 20px', 
          position: 'relative', 
          zIndex: 5,
          transition: 'max-width 0.4s cubic-bezier(0.16, 1, 0.3, 1)'
        }}>
          
          {/* 面包屑 */}
          <div style={{ marginBottom: '20px', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Link href="/" style={{ color: 'var(--color-accent)', textDecoration: 'none', fontWeight: 300, display: 'flex', alignItems: 'center', gap: '4px' }}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
                <polyline points="9 22 9 12 15 12 15 22" />
              </svg>
              知识图谱主页
            </Link>
            <span style={{ color: 'var(--color-muted)', margin: '0 4px' }}>/</span>
            <span style={{ color: 'var(--color-muted)', fontWeight: 300 }}>
              {report.category === 'customer' ? '客户 360 度洞察' : '品类分析'}
            </span>
          </div>

          {/* 标题 */}
          <h1 style={{ fontSize: '2rem', fontWeight: 300, color: 'var(--color-text)', marginBottom: '16px', lineHeight: 1.3, letterSpacing: '-0.5px' }}>
            {report.title}
          </h1>

          {/* 标签 */}
          <div style={{ display: 'flex', gap: '10px', marginBottom: '30px' }}>
            <span style={{
              background: report.category === 'customer' ? 'rgba(255, 100, 30, 0.05)' : 'rgba(122, 117, 111, 0.08)',
              color: report.category === 'customer' ? 'var(--color-accent)' : 'var(--color-muted)',
              fontSize: '0.75rem',
              padding: '4px 12px',
              borderRadius: '8px',
              fontWeight: 300
            }}>
              {report.category === 'customer' ? '客户洞察' : '品类分析'}
            </span>
            <span style={{
              background: 'var(--bg-sub)',
              color: 'var(--color-muted)',
              border: 'none',
              fontSize: '0.75rem',
              padding: '4px 12px',
              borderRadius: '8px',
              fontWeight: 300
            }}>
              Target: {report.market_region}
            </span>
          </div>

          {/* 摘要区 */}
          <div style={{
            background: 'var(--bg-sub)',
            border: 'none',
            borderRadius: 'var(--border-radius)',
            padding: '24px 30px',
            marginBottom: '30px',
            boxShadow: '0 4px 12px rgba(160, 109, 68, 0.01)'
          }}>
            <h3 style={{ margin: '0 0 10px 0', fontSize: '1rem', color: 'var(--color-text)', fontWeight: 400, display: 'flex', alignItems: 'center', gap: '6px' }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" strokeLinejoin="round">
                <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
                <path d="M4 4.5A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1-2.5-2.5v-15z" />
              </svg>
              报告摘要
            </h3>
            <p style={{ margin: 0, fontSize: '0.9rem', color: 'var(--color-muted)', lineHeight: 1.6, fontWeight: 300 }}>{report.summary}</p>
          </div>

          {/* 内容展示区 */}
          <div style={{ position: 'relative', minHeight: '300px', marginBottom: '50px' }}>
            {unlocked ? (
              // 已解锁：温润图书阅读器风格容器，渲染 HTML
              <div style={{
                background: 'var(--bg-sub)',
                borderRadius: 'var(--border-radius)',
                padding: '40px',
                boxShadow: '0 10px 40px rgba(160, 109, 68, 0.02)',
                border: 'none',
                marginTop: '20px',
                transition: 'all 0.5s ease',
                overflow: 'hidden'
              }}>
                <div 
                  className="report-content-body"
                  style={{ fontSize: '1rem', color: 'var(--color-text)', lineHeight: 1.8 }}
                  dangerouslySetInnerHTML={{ __html: cleanHtmlBody(content || '') }} 
                />
              </div>
            ) : (
              // 未解锁：呈现高斯模糊与引导解锁弹窗
              <div>
                <div style={{ filter: 'blur(8px)', userSelect: 'none', pointerEvents: 'none', opacity: 0.15, lineHeight: 1.8, color: 'var(--color-muted)' }}>
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
                  background: 'var(--bg-sub)',
                  border: 'none',
                  borderRadius: 'var(--border-radius)',
                  padding: '36px 30px',
                  textAlign: 'center',
                  boxShadow: '0 20px 45px rgba(160, 109, 68, 0.06)',
                  zIndex: 10,
                  backdropFilter: 'blur(20px)',
                  color: 'var(--color-text)'
                }}>
                  <h3 style={{ margin: '0 0 10px 0', fontSize: '1.25rem', fontWeight: 300, letterSpacing: '-0.3px' }}>解锁报告阅读全文</h3>
                  <p style={{ fontSize: '0.85rem', color: 'var(--color-muted)', marginBottom: '24px', lineHeight: 1.5, fontWeight: 300 }}>
                    此报告为付费增值资讯。您可以消耗 1 次免费额度，或通过微信/支付宝扫码付费解锁。
                  </p>
                  <button 
                    onClick={handleUnlock}
                    style={{
                      padding: '14px 28px',
                      fontSize: '0.95rem',
                      fontWeight: 300,
                      width: '100%',
                      background: 'var(--color-accent)',
                      color: '#ffffff',
                      border: 'none',
                      borderRadius: 'var(--border-radius)',
                      cursor: 'pointer',
                      boxShadow: 'none'
                    }}
                  >
                    {userId ? '立即解锁报告 (消耗 1 次额度)' : '请先登录后再解锁'}
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* 知识跳转链 (强关联延伸推荐) */}
          {unlocked && related.length > 0 && (
            <div style={{ borderTop: 'none', paddingTop: '40px' }}>
              <h3 style={{ fontSize: '1.1rem', fontWeight: 300, color: 'var(--color-text)', marginBottom: '20px', letterSpacing: '-0.3px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
                  <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
                </svg>
                延伸知识链条 (顺藤摸瓜探索更多关联报告)
              </h3>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                {related.map(item => (
                  <Link href={`/reports/${item.id}`} key={item.id} style={{ textDecoration: 'none' }}>
                    <div style={{
                      border: 'none',
                      borderRadius: 'var(--border-radius)',
                      padding: '20px',
                      background: 'var(--bg-sub)',
                      cursor: 'pointer',
                      transition: 'all 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
                      boxShadow: '0 4px 12px rgba(160, 109, 68, 0.01)'
                    }}
                    onMouseOver={(e) => {
                      e.currentTarget.style.background = 'var(--bg-main)';
                      e.currentTarget.style.transform = 'translateY(-4px)';
                      e.currentTarget.style.boxShadow = '0 12px 30px rgba(160, 109, 68, 0.04)';
                    }}
                    onMouseOut={(e) => {
                      e.currentTarget.style.background = 'var(--bg-sub)';
                      e.currentTarget.style.transform = 'none';
                      e.currentTarget.style.boxShadow = '0 4px 12px rgba(160, 109, 68, 0.01)';
                    }}
                    >
                      <span style={{
                        fontSize: '0.7rem',
                        fontWeight: 300,
                        color: item.category === 'customer' ? 'var(--color-accent)' : 'var(--color-muted)',
                        background: item.category === 'customer' ? 'rgba(255, 100, 30, 0.05)' : 'rgba(122, 117, 111, 0.08)',
                        padding: '4px 10px',
                        borderRadius: '6px',
                        display: 'inline-block',
                        marginBottom: '10px'
                      }}>
                        {item.category === 'customer' ? '客户洞察' : '品类分析'}
                      </span>
                      <h4 style={{ margin: '0 0 8px 0', fontSize: '0.95rem', color: 'var(--color-text)', fontWeight: 400 }}>{item.title}</h4>
                      <span style={{ fontSize: '0.75rem', color: 'var(--color-muted)', fontWeight: 300, display: 'flex', alignItems: 'center', gap: '4px', marginTop: '4px' }}>
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" strokeLinejoin="round">
                          <circle cx="12" cy="12" r="10" />
                          <line x1="2" y1="12" x2="22" y2="12" />
                          <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
                        </svg>
                        目标地区: {item.market_region}
                      </span>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          )}

        </div>

      </div>
    </WatermarkContainer>
  );
}

export const getServerSideProps: GetServerSideProps = async (context) => {
  const { id } = context.params!;
  const cookies = parseCookies(context.req.headers.cookie);
  const cookieUserId = cookies.user_id;
  
  const dbClient = await pool.connect();

  try {
    let userId: string | null = null;
    let userRole = 'guest';

    if (cookieUserId) {
      const userRes = await dbClient.query('SELECT id, role FROM users WHERE id = $1', [cookieUserId]);
      if (userRes.rows.length > 0) {
        userId = userRes.rows[0].id;
        userRole = userRes.rows[0].role;
      }
    }

    let report: any = null;
    let related: RelatedReport[] = [];

    if (userId) {
      if (userRole === 'admin') {
        const reportRes = await dbClient.query(
          'SELECT id, title, category, market_region, summary, content_html FROM reports WHERE id = $1',
          [id]
        );
        if (reportRes.rows.length === 0) {
          return { notFound: true };
        }
        const rep = reportRes.rows[0];
        report = {
          id: rep.id,
          title: rep.title,
          category: rep.category,
          market_region: rep.market_region,
          summary: rep.summary,
          isUnlocked: true,
          content_html: rep.content_html
        };
      } else {
        report = await getReportDetail(userId, id as string, dbClient);
      }

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
    } else {
      const reportRes = await dbClient.query(
        'SELECT id, title, category, market_region, summary FROM reports WHERE id = $1',
        [id]
      );
      if (reportRes.rows.length === 0) {
        return { notFound: true };
      }
      const rep = reportRes.rows[0];
      report = {
        id: rep.id,
        title: rep.title,
        category: rep.category,
        market_region: rep.market_region,
        summary: rep.summary,
        isUnlocked: false,
        content_html: null
      };
    }

    return {
      props: {
        report,
        related,
        userId: userId || '',
        userRole
      }
    };
  } catch (err) {
    console.error('SSR 加载报告详情页失败，原因:', err);
    return { notFound: true };
  } finally {
    dbClient.release();
  }
};
