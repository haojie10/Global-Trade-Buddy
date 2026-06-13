import { GetServerSideProps } from 'next';
import React, { useState } from 'react';
import { Client } from 'pg';
import pool from '../../lib/db';
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

  // 4. 强制注入的基础重置样式（不再强制覆盖前景色和背景色，允许模板原生的暗色主题和卡片显示）
  const lightThemeOverrides = `
    <style>
      .report-content-body {
        width: 100%;
        font-family: 'Outfit', 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
      }
      .report-content-body img {
        max-width: 100%;
        height: auto;
        border-radius: 12px;
        margin: 16px 0;
      }
      .report-content-body table {
        width: 100%;
        border-collapse: collapse;
        margin: 20px 0;
      }
    </style>
  `;

  return `${lightThemeOverrides}\n${stylesStr}\n${bodyContent}`;
}

export default function ReportDetailPage({ report, related, userId, userRole }: ReportDetailProps) {
  const [unlocked, setUnlocked] = useState(report.isUnlocked);
  const [content, setContent] = useState(report.content_html);

  // 挂载原 HTML 模板内联 onclick 所需 the JavaScript 全局函数（React dangerouslySetInnerHTML 默认屏蔽 Script 标签）
  React.useEffect(() => {
    // 确保在客户端切换路由或刷新时 switchSection 挂载状态正常
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

    // 1. 提取所有的 script 标签
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

    // 2. 按顺序串行加载外部脚本，加载完后再执行内联脚本
    const loadExternalScripts = async () => {
      for (const s of scriptsToLoad) {
        if (s.src) {
          const srcUrl = s.src;
          await new Promise((resolve) => {
            // 避免重复加载
            if (document.querySelector(`script[src="${srcUrl}"]`)) {
              resolve(true);
              return;
            }
            const script = document.createElement('script');
            script.src = srcUrl;
            script.async = false;
            script.onload = () => resolve(true);
            script.onerror = () => resolve(true); // 容错处理，防止加载失败阻塞后续
            document.head.appendChild(script);
          });
        }
      }
    };

    const runInlineScripts = () => {
      // 外部依赖加载完成后，稍等片刻让 DOM 彻底渲染完毕，再初始化图表
      setTimeout(() => {
        scriptsToLoad.forEach((s) => {
          if (!s.src && s.content.trim()) {
            try {
              // 构造一个 script 节点来执行代码，利于保留作用域和全局变量访问
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
        background: '#f8fafc',
        color: '#0f172a',
        minHeight: '100vh',
        fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, sans-serif',
        position: 'relative'
      }}>
        {/* 渐变星云背景 - 清爽浅色淡蓝光晕 */}
        <div style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: '100%',
          background: 'radial-gradient(circle at 15% 15%, rgba(37, 99, 235, 0.04) 0%, transparent 50%), radial-gradient(circle at 85% 85%, rgba(37, 99, 235, 0.03) 0%, transparent 50%)',
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
          <div style={{ marginBottom: '20px', fontSize: '0.85rem' }}>
            <Link href="/" style={{ color: '#2563eb', textDecoration: 'none', fontWeight: 600 }}>🏠 知识图谱主页</Link>
            <span style={{ color: '#475569', margin: '0 8px' }}>/</span>
            <span style={{ color: '#475569' }}>
              {report.category === 'customer' ? '👥 客户 360 度洞察' : '📈 品类分析'}
            </span>
          </div>

          {/* 标题 */}
          <h1 style={{ fontSize: '2rem', fontWeight: 300, color: '#0f172a', marginBottom: '16px', lineHeight: 1.3, letterSpacing: '-0.5px' }}>
            {report.title}
          </h1>

          {/* 标签 */}
          <div style={{ display: 'flex', gap: '10px', marginBottom: '30px' }}>
            <span style={{
              background: report.category === 'customer' ? 'rgba(37, 99, 235, 0.06)' : 'rgba(217, 119, 6, 0.06)',
              color: report.category === 'customer' ? '#2563eb' : '#b45309',
              fontSize: '0.75rem',
              padding: '4px 12px',
              borderRadius: '6px',
              fontWeight: 500
            }}>
              {report.category === 'customer' ? '👥 客户洞察' : '📈 品类分析'}
            </span>
            <span style={{
              background: 'rgba(15, 23, 42, 0.03)',
              color: '#475569',
              border: '1px solid rgba(15, 23, 42, 0.08)',
              fontSize: '0.75rem',
              padding: '4px 12px',
              borderRadius: '6px'
            }}>
              Target: {report.market_region}
            </span>
          </div>

          {/* 摘要区 */}
          <div style={{
            background: 'rgba(255, 255, 255, 0.85)',
            borderLeft: '4px solid #2563eb',
            borderTop: '1px solid rgba(15, 23, 42, 0.08)',
            borderRight: '1px solid rgba(15, 23, 42, 0.08)',
            borderBottom: '1px solid rgba(15, 23, 42, 0.08)',
            borderRadius: '16px',
            padding: '20px',
            marginBottom: '30px',
            boxShadow: '0 8px 30px rgba(15, 23, 42, 0.03)',
            backdropFilter: 'blur(10px)'
          }}>
            <h3 style={{ margin: '0 0 10px 0', fontSize: '1rem', color: '#0f172a', fontWeight: 500 }}>📖 报告摘要</h3>
            <p style={{ margin: 0, fontSize: '0.9rem', color: '#475569', lineHeight: 1.6, fontWeight: 300 }}>{report.summary}</p>
          </div>

          {/* 内容展示区 */}
          <div style={{ position: 'relative', minHeight: '300px', marginBottom: '50px' }}>
            {unlocked ? (
              // 已解锁：自适应暗绿奢华背景容器，渲染大图脱水后的 HTML
              <div style={{
                background: 'linear-gradient(135deg, #090e07 0%, #030502 100%)',
                borderRadius: '24px',
                padding: '40px',
                boxShadow: '0 20px 50px rgba(9, 14, 7, 0.25), inset 0 1px 0 rgba(255, 255, 255, 0.05)',
                border: '1px solid rgba(143, 168, 116, 0.12)',
                marginTop: '20px',
                transition: 'all 0.5s ease',
                overflow: 'hidden'
              }}>
                <div 
                  className="report-content-body"
                  style={{ fontSize: '1rem', color: '#f2f5f0', lineHeight: 1.8 }}
                  dangerouslySetInnerHTML={{ __html: cleanHtmlBody(content || '') }} 
                />
              </div>
            ) : (
              // 未解锁：呈现高斯模糊与引导解锁弹窗
              <div>
                <div style={{ filter: 'blur(8px)', userSelect: 'none', pointerEvents: 'none', opacity: 0.15, lineHeight: 1.8, color: '#475569' }}>
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
                  background: 'rgba(255, 255, 255, 0.9)',
                  border: '1px solid rgba(37, 99, 235, 0.25)',
                  borderRadius: '24px',
                  padding: '36px 30px',
                  textAlign: 'center',
                  boxShadow: '0 12px 40px rgba(15, 23, 42, 0.08)',
                  zIndex: 10,
                  backdropFilter: 'blur(20px)',
                  color: '#0f172a'
                }}>
                  <h3 style={{ margin: '0 0 10px 0', fontSize: '1.25rem', fontWeight: 300, letterSpacing: '-0.3px' }}>🔒 解锁报告阅读全文</h3>
                  <p style={{ fontSize: '0.85rem', color: '#475569', marginBottom: '24px', lineHeight: 1.5, fontWeight: 300 }}>
                    此报告为付费增值资讯。您可以消耗 1 次免费额度，或通过微信/支付宝扫码付费解锁。
                  </p>
                  <button 
                    onClick={handleUnlock}
                    className="water-drop-btn"
                    style={{
                      padding: '14px 28px',
                      fontSize: '0.95rem',
                      fontWeight: 500,
                      width: '100%'
                    }}
                  >
                    {userId ? '🚀 立即解锁报告 (消耗1次额度)' : '🔒 请先登录后再解锁'}
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* 知识跳转链 (强关联延伸推荐) */}
          {unlocked && related.length > 0 && (
            <div style={{ borderTop: '1px solid rgba(15, 23, 42, 0.08)', paddingTop: '40px' }}>
              <h3 style={{ fontSize: '1.1rem', fontWeight: 300, color: '#0f172a', marginBottom: '20px', letterSpacing: '-0.3px' }}>
                🔗 延伸知识链条 (顺藤摸瓜探索更多关联报告)
              </h3>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                {related.map(item => (
                  <Link href={`/reports/${item.id}`} key={item.id} style={{ textDecoration: 'none' }}>
                    <div style={{
                      border: '1px solid rgba(15, 23, 42, 0.08)',
                      borderRadius: '16px',
                      padding: '20px',
                      background: 'rgba(255, 255, 255, 0.75)',
                      backdropFilter: 'blur(10px)',
                      cursor: 'pointer',
                      transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)'
                    }}
                    onMouseOver={(e) => {
                      e.currentTarget.style.borderColor = 'rgba(37, 99, 235, 0.3)';
                      e.currentTarget.style.transform = 'translateY(-4px)';
                      e.currentTarget.style.boxShadow = '0 8px 24px rgba(37, 99, 235, 0.05)';
                      e.currentTarget.style.background = 'rgba(255, 255, 255, 0.95)';
                    }}
                    onMouseOut={(e) => {
                      e.currentTarget.style.borderColor = 'rgba(15, 23, 42, 0.08)';
                      e.currentTarget.style.transform = 'none';
                      e.currentTarget.style.boxShadow = 'none';
                      e.currentTarget.style.background = 'rgba(255, 255, 255, 0.75)';
                    }}
                    >
                      <span style={{
                        fontSize: '0.7rem',
                        fontWeight: 500,
                        color: item.category === 'customer' ? '#2563eb' : '#b45309',
                        background: item.category === 'customer' ? 'rgba(37, 99, 235, 0.06)' : 'rgba(217, 119, 6, 0.06)',
                        padding: '4px 10px',
                        borderRadius: '6px',
                        display: 'inline-block',
                        marginBottom: '10px'
                      }}>
                        {item.category === 'customer' ? '👥 客户洞察' : '📈 品类分析'}
                      </span>
                      <h4 style={{ margin: '0 0 8px 0', fontSize: '0.95rem', color: '#0f172a', fontWeight: 500 }}>{item.title}</h4>
                      <span style={{ fontSize: '0.75rem', color: '#475569', fontWeight: 300 }}>🌍 目标地区: {item.market_region}</span>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          )}

        </div>
        <style jsx global>{`
          .water-drop-btn {
            background: rgba(255, 255, 255, 0.45);
            backdrop-filter: blur(16px);
            -webkit-backdrop-filter: blur(16px);
            border: 1px solid rgba(255, 255, 255, 0.75);
            border-radius: 30px;
            color: #0f172a;
            box-shadow: 
              0 8px 24px rgba(31, 38, 135, 0.03), 
              inset 0 4px 10px rgba(255, 255, 255, 0.65), 
              inset 0 -4px 10px rgba(15, 23, 42, 0.02);
            transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1);
            cursor: pointer;
            outline: none;
            display: inline-block;
            text-align: center;
          }
          .water-drop-btn:hover {
            background: rgba(255, 255, 255, 0.7);
            box-shadow: 
              0 12px 30px rgba(31, 38, 135, 0.05), 
              inset 0 8px 16px rgba(255, 255, 255, 0.8), 
              inset 0 -6px 16px rgba(15, 23, 42, 0.03);
            transform: translateY(-1px);
          }
        `}</style>
      </div>
    </WatermarkContainer>
  );
}

function parseCookies(cookieHeader?: string) {
  const list: Record<string, string> = {};
  if (!cookieHeader) return list;
  cookieHeader.split(';').forEach((cookie) => {
    const parts = cookie.split('=');
    list[parts.shift()!.trim()] = decodeURI(parts.join('='));
  });
  return list;
}

// 服务端数据预取 (SSR)
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
