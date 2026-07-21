import React, { useEffect, useState } from 'react';
import { GetServerSideProps } from 'next';
import Head from 'next/head';
import Link from 'next/link';
import pool from '../../lib/db';
import { resolveSsrAuth } from '../../lib/ssr-auth';
import { sanitizeHtml } from '../../lib/sanitize';
import WatermarkContainer from '../../components/WatermarkContainer';
import Navbar from '../../components/Navbar';
import AuthModal from '../../components/AuthModal';

interface NewsDetailProps {
  error?: string | null;
  news: {
    id: string;
    title: string;
    summary: string;
    content: string;
    source_url: string | null;
    published_at: string;
    industries: string;
    countries: string;
  } | null;
  relatedReports: Array<{
    id: string;
    title: string;
    category: string;
    market_region: string;
    summary: string;
  }>;
  userId: string | null;
  userRole: string;
  quota: number;
  nickname: string;
}

export default function NewsDetailPage({ news, relatedReports, userId, userRole, quota, nickname, error }: NewsDetailProps) {
  const [showAuthModal, setShowAuthModal] = useState(false);
  
  // 1. 将 React Hook (useEffect) 严格声明在组件的最顶层（不能放在 try-catch 或条件语句内部，确保渲染链路的一致性）
  useEffect(() => {
    if (!news?.id) return;

    let viewId: string | null = null;
    let startTime = Date.now();

    // 1. 发送初始化浏览记录
    fetch('/api/track/pageview', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content_type: 'news', content_id: news.id })
    })
      .then(res => res.json())
      .then(data => {
        if (data.view_id) {
          viewId = data.view_id;
        }
      })
      .catch(err => console.error('Error tracking news pageview:', err));

    // 2. 发送停留时间
    const sendDuration = () => {
      if (!viewId) return;
      const durationSeconds = Math.round((Date.now() - startTime) / 1000);
      if (durationSeconds <= 0) return;

      fetch('/api/track/pageview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ view_id: viewId, duration_seconds: durationSeconds }),
        keepalive: true
      }).catch(err => console.warn('Error sending news duration:', err));
    };

    const handleVisibility = () => {
      if (document.visibilityState === 'hidden') {
        sendDuration();
      } else {
        startTime = Date.now();
        viewId = null;
        fetch('/api/track/pageview', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ content_type: 'news', content_id: news.id })
        })
          .then(res => res.json())
          .then(data => {
            if (data.view_id) {
              viewId = data.view_id;
            }
          })
          .catch(err => console.error('Error tracking pageview:', err));
      }
    };

    window.addEventListener('beforeunload', sendDuration);
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      sendDuration();
      window.removeEventListener('beforeunload', sendDuration);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [news?.id]);

  // 2. 接收并展示 SSR 数据拉取时产生的异常
  if (error) {
    return (
      <div style={{ padding: '50px', fontFamily: 'monospace', color: '#ff3333', background: '#fafafa', borderRadius: '8px', border: '1px solid #ffcccc', margin: '40px auto', maxWidth: '800px' }}>
        <h2 style={{ borderBottom: '1px solid #ffcccc', paddingBottom: '10px' }}>⚠️ 服务端数据获取失败 (SSR Error)</h2>
        <p><strong>错误信息：</strong></p>
        <pre style={{ background: '#f5f5f5', padding: '15px', borderRadius: '4px', whiteSpace: 'pre-wrap' }}>{error}</pre>
      </div>
    );
  }

  // 3. 防御性判断 news 是否为空
  if (!news) {
    return (
      <div style={{ padding: '50px', fontFamily: 'monospace', color: '#ff3333', background: '#fafafa', borderRadius: '8px', border: '1px solid #ffcccc', margin: '40px auto', maxWidth: '800px', textAlign: 'center' }}>
        <h2>⚠️ 提示</h2>
        <p>未找到该快讯的详情数据。</p>
      </div>
    );
  }

  // 4. 其余局部渲染逻辑使用 try-catch 防御包裹
  try {
    const dateStr = new Date(news.published_at).toLocaleDateString('zh-CN', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });

    // 使用 DOMPurify 进行富文本消毒（取代原先手写的正则过滤，安全性更高）
    const sanitizeHtmlString = (html: string): string => sanitizeHtml(html);

    const renderContent = (content: string) => {
      if (!content) return null;

      // 1. 将 Markdown 图片语法转换为标准的 HTML <img> 标签，以便在解析阶段处理
      let htmlContent = content.replace(
        /!\[(.*?)\]\((.*?)\)/g,
        '<img src="$2" alt="$1" style="width: 100%; max-height: 420px; object-fit: cover; border-radius: var(--border-radius); margin-bottom: 28px; border: 1px solid rgba(18,18,18,0.06); display: block;" />'
      );

      // 2. 将 Markdown 链接语法转换为标准的 HTML <a> 标签
      htmlContent = htmlContent.replace(
        /\[(.*?)\]\((.*?)\)/g,
        '<a href="$2" target="_blank" rel="noreferrer" style="color: var(--color-accent); text-decoration: underline; font-weight: 500;">$1</a>'
      );

      // 3. 在 React VDOM 解析时进行白名单安全净化过滤，防止 XSS 攻击
      const cleanHtml = sanitizeHtmlString(htmlContent);

      // 4. 原生渲染，避免任何 html-react-parser 依赖产生的 ES Module 加载报错
      return (
        <div 
          className="news-content"
          dangerouslySetInnerHTML={{ __html: cleanHtml }}
        />
      );
    };

    return (
      <WatermarkContainer text={userId ? `GTB USER ${userId.substring(0, 8)}` : 'GTB GUEST'}>
        <Head>
          <title>{news.title} | Market Graphic</title>
        </Head>
        <Navbar 
          userId={userId} 
          userRole={userRole} 
          quota={quota} 
          nickname={nickname} 
          onShowAuthModal={() => setShowAuthModal(true)} 
        />
        <div style={{
          maxWidth: '800px',
          margin: '100px auto 40px auto',
          padding: '0 20px',
          fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif"
        }}>

          {/* 资讯主内容卡片 */}
          <article style={{
            background: 'rgba(255, 255, 255, 0.75)',
            backdropFilter: 'blur(20px)',
            WebkitBackdropFilter: 'blur(20px)',
            border: '1px solid rgba(18, 18, 18, 0.06)',
            borderRadius: 'var(--border-radius)',
            padding: '40px',
            boxShadow: '0 20px 50px rgba(0,0,0,0.02)',
            marginBottom: '32px'
          }}>
            {/* 标签 */}
            <div style={{ display: 'flex', gap: '8px', marginBottom: '16px', flexWrap: 'wrap' }}>
              {news.industries && news.industries.split(', ').map((ind, i) => (
                <span key={i} style={{
                  background: 'rgba(46, 91, 255, 0.05)',
                  color: '#2e5bff',
                  padding: '4px 10px',
                  fontSize: '0.75rem',
                  fontWeight: 500,
                  border: '1px solid rgba(46, 91, 255, 0.1)'
                }}>
                  🏷️ {ind}
                </span>
              ))}
              {news.countries && news.countries.split(', ').map((cty, i) => (
                <span key={i} style={{
                  background: 'rgba(255, 100, 30, 0.05)',
                  color: 'var(--color-accent)',
                  padding: '4px 10px',
                  fontSize: '0.75rem',
                  fontWeight: 500,
                  border: '1px solid rgba(255, 100, 30, 0.1)'
                }}>
                  🌍 {cty}
                </span>
              ))}
            </div>

            <h1 className="font-editorial" style={{
              fontSize: '2.2rem',
              margin: '0 0 16px 0',
              color: 'var(--color-text)',
              lineHeight: 1.25,
              fontWeight: 400
            }}>
              {news.title}
            </h1>

            <div style={{
              fontSize: '0.85rem',
              color: 'var(--color-muted)',
              marginBottom: '32px',
              borderBottom: '1px solid rgba(18, 18, 18, 0.08)',
              paddingBottom: '16px'
            }}>
              发布时间: {dateStr}
              {news.source_url && (
                <span style={{ marginLeft: '12px' }}>
                  来源: <a href={news.source_url} target="_blank" rel="noreferrer" style={{ color: 'var(--color-accent)', textDecoration: 'none' }}>查看新闻原文 ↗</a>
                </span>
              )}
            </div>

            {/* 资讯正文 */}
            <div style={{
              color: 'var(--color-text)',
              fontSize: '1.05rem',
              lineHeight: 1.75,
              fontWeight: 300
            }}>
              {renderContent(news.content)}
            </div>
          </article>

          {/* 关联报告推荐区域 */}
          {relatedReports && relatedReports.length > 0 && (
            <section style={{ marginTop: '48px' }}>
              <h3 className="font-editorial" style={{
                fontSize: '1.4rem',
                fontWeight: 400,
                color: 'var(--color-text)',
                marginBottom: '20px'
              }}>
                💡 相关深度出海研报推荐
              </h3>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '20px' }}>
                {relatedReports.map(rep => (
                  <div key={rep.id} className="float-on-hover" style={{
                    background: 'rgba(255, 255, 255, 0.65)',
                    border: '1px solid rgba(18, 18, 18, 0.06)',
                    padding: '24px',
                    borderRadius: 'var(--border-radius)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '12px'
                  }}>
                    <span style={{
                      fontSize: '0.75rem',
                      color: rep.category === 'customer' ? '#10b981' : '#2e5bff',
                      fontWeight: 600,
                      textTransform: 'uppercase'
                    }}>
                      {rep.category === 'customer' ? '客户洞察' : '品类分析'} • {rep.market_region}
                    </span>

                    <h4 style={{
                      fontSize: '1.05rem',
                      fontWeight: 500,
                      margin: 0,
                      color: 'var(--color-text)',
                      lineHeight: 1.4
                    }}>
                      {rep.title}
                    </h4>

                    <p style={{
                      fontSize: '0.85rem',
                      color: 'var(--color-muted)',
                      margin: 0,
                      lineHeight: 1.5,
                      fontWeight: 300,
                      flex: 1,
                      display: '-webkit-box',
                      WebkitLineClamp: 2,
                      WebkitBoxOrient: 'vertical',
                      overflow: 'hidden'
                    }}>
                      {rep.summary}
                    </p>

                    <Link href={`/reports/${rep.id}`} style={{
                      fontSize: '0.85rem',
                      color: 'var(--color-accent)',
                      textDecoration: 'none',
                      fontWeight: 500,
                      marginTop: '8px'
                    }}>
                      去解锁阅读全文 →
                    </Link>
                  </div>
                ))}
              </div>
            </section>
          )}
          <AuthModal 
            isOpen={showAuthModal} 
            onClose={() => setShowAuthModal(false)} 
          />
        </div>
      </WatermarkContainer>
    );
  } catch (renderError: any) {
    return (
      <div style={{ padding: '50px', fontFamily: 'monospace', color: '#ff3333', background: '#fafafa', borderRadius: '8px', border: '1px solid #ffcccc', margin: '40px auto', maxWidth: '800px' }}>
        <h2 style={{ borderBottom: '1px solid #ffcccc', paddingBottom: '10px' }}>⚠️ 客户端/服务端渲染异常 (Render Error)</h2>
        <p><strong>错误信息：</strong></p>
        <pre style={{ background: '#f5f5f5', padding: '15px', borderRadius: '4px', whiteSpace: 'pre-wrap' }}>{renderError.stack || renderError.message}</pre>
      </div>
    );
  }
}
export const getServerSideProps: GetServerSideProps = async (context) => {
  let dbClient: any = null;
  const { id } = context.params || {};

  if (!id || typeof id !== 'string') {
    return {
      props: {
        error: '无效的新闻ID请求参数',
        news: null,
        relatedReports: [],
        userId: null,
        userRole: 'guest',
        quota: 0,
        nickname: ''
      }
    };
  }

  try {
    dbClient = await pool.connect();
    const auth = await resolveSsrAuth(context, dbClient);
    const userId = auth.userId;
    const userRole = auth.userRole;
    const quota = auth.freeQuota;
    const nickname = auth.nickname;

    // 1. 查询快讯详情
    const newsRes = await dbClient.query(
      `SELECT n.id, n.title, n.summary, n.content, n.source_url, n.published_at,
              ARRAY_TO_STRING(ARRAY(SELECT name FROM industries JOIN news_industries ON industries.id = news_industries.industry_id WHERE news_id = n.id), ', ') as industries,
              ARRAY_TO_STRING(ARRAY(SELECT name FROM countries JOIN news_countries ON countries.id = news_countries.country_id WHERE news_id = n.id), ', ') as countries
       FROM news n
       WHERE n.id = $1 AND n.status = 'published'`,
      [id]
    );

    if (newsRes.rows.length === 0) {
      return {
        props: {
          error: `未在数据库中找到 ID 为 [${id}] 且已发布的新闻资讯数据。`,
          news: null,
          relatedReports: [],
          userId: null,
          userRole,
          quota,
          nickname
        }
      };
    }

    const newsItem = newsRes.rows[0];

    // 2. 获取关联推荐报告
    const relatedReportsRes = await dbClient.query(
      `SELECT DISTINCT r.id, r.title, r.category, r.market_region, r.summary
       FROM reports r
       JOIN report_industries ri ON r.id = ri.report_id
       WHERE ri.industry_id IN (
         SELECT industry_id FROM news_industries WHERE news_id = $1
       )
       LIMIT 3`,
      [id]
    );

    // 确保 published_at 转换不报错，防范 null/string 类型的 issue
    let published_at_str = '';
    if (newsItem.published_at) {
      if (typeof newsItem.published_at.toISOString === 'function') {
        published_at_str = newsItem.published_at.toISOString();
      } else {
        published_at_str = new Date(newsItem.published_at).toISOString();
      }
    }

    return {
      props: {
        error: null,
        news: {
          ...newsItem,
          published_at: published_at_str
        },
        relatedReports: relatedReportsRes.rows,
        userId,
        userRole,
        quota,
        nickname
      }
    };
  } catch (err: any) {
    console.error('SSR error fetching news:', err);
    return {
      props: {
        error: `SSR 数据提取时发生异常: ${err.message || err}`,
        news: null,
        relatedReports: [],
        userId: null,
        userRole: 'guest',
        quota: 0,
        nickname: ''
      }
    };
  } finally {
    if (dbClient) {
      try {
        dbClient.release();
      } catch (releaseErr) {
        console.error('Error releasing db client:', releaseErr);
      }
    }
  }
};
