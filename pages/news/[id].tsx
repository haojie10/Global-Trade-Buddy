import React, { useEffect } from 'react';
import { GetServerSideProps } from 'next';
import Link from 'next/link';
import parse, { attributesToProps, domToReact } from 'html-react-parser';
import pool from '../../lib/db';
import { parseCookies } from '../../lib/cookies';
import WatermarkContainer from '../../components/WatermarkContainer';

interface NewsDetailProps {
  news: {
    id: string;
    title: string;
    summary: string;
    content: string;
    source_url: string | null;
    published_at: string;
    industries: string;
    countries: string;
  };
  relatedReports: Array<{
    id: string;
    title: string;
    category: string;
    market_region: string;
    summary: string;
  }>;
  userId: string | null;
}

export default function NewsDetailPage({ news, relatedReports, userId }: NewsDetailProps) {
  
  // 行为追踪埋点 (资讯阅读时间)
  useEffect(() => {
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
  }, [news.id]);

  const dateStr = new Date(news.published_at).toLocaleDateString('zh-CN', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });

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

    // 3. 在 React VDOM 解析时进行白名单安全净化过滤，防止 XSS 攻击（无需依靠 node 端的大型 jsdom/DOMPurify 依赖，100% 兼容 Vercel Serverless 环境）
    const parseOptions = {
      replace: (domNode: any) => {
        if (domNode && typeof domNode.name === 'string') {
          const tagName = domNode.name.toLowerCase();

          // 屏蔽潜在危险或非预期的高风险标签
          const blockedTags = ['script', 'iframe', 'object', 'embed', 'style', 'link', 'meta'];
          if (blockedTags.includes(tagName)) {
            return <React.Fragment />;
          }

          // 属性安全白名单清洗，剔除事件处理器与 javascript: 协议
          const attribs = domNode.attribs || {};
          const cleanAttribs: Record<string, string> = {};
          const allowedAttribs = ['src', 'alt', 'href', 'target', 'rel', 'style', 'class', 'classname', 'width', 'height'];

          for (const [key, value] of Object.entries(attribs)) {
            const lowerKey = key.toLowerCase();
            // 屏蔽任何 onerror/onload/onclick 等事件监听器
            if (lowerKey.startsWith('on')) {
              continue;
            }
            // 屏蔽恶意超链接和图片源
            const valStr = String(value);
            if ((lowerKey === 'href' || lowerKey === 'src') && valStr.trim().toLowerCase().startsWith('javascript:')) {
              continue;
            }
            if (allowedAttribs.includes(lowerKey)) {
              cleanAttribs[key] = valStr;
            }
          }

          const props = attributesToProps(cleanAttribs);
          return React.createElement(
            domNode.name,
            props,
            domNode.children ? domToReact(domNode.children as any[], parseOptions) : null
          );
        }
      }
    };

    // 4. 使用 html-react-parser 进行安全解析与 VDOM 渲染
    return (
      <div style={{ whiteSpace: 'pre-wrap' }}>
        {parse(htmlContent, parseOptions)}
      </div>
    );
  };

  return (
    <WatermarkContainer text={userId ? `GTB USER ${userId.substring(0, 8)}` : 'GTB GUEST'}>
      <div style={{
        maxWidth: '800px',
        margin: '40px auto',
        padding: '0 20px',
        fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif"
      }}>
        {/* 返回链接 */}
        <Link href="/" style={{
          textDecoration: 'none',
          color: 'var(--color-muted)',
          fontSize: '0.9rem',
          display: 'inline-flex',
          alignItems: 'center',
          gap: '6px',
          marginBottom: '24px',
          transition: 'color 0.2s'
        }} onMouseEnter={(e) => e.currentTarget.style.color = 'var(--color-accent)'} onMouseLeave={(e) => e.currentTarget.style.color = 'var(--color-muted)'}>
          ← 返回首页市场大厅
        </Link>

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
      </div>
    </WatermarkContainer>
  );
}

export const getServerSideProps: GetServerSideProps = async (context) => {
  const { id } = context.params || {};
  const cookies = parseCookies(context.req.headers.cookie);
  const userId = cookies.user_id || null;

  if (!id || typeof id !== 'string') {
    return { notFound: true };
  }

  let dbClient = null;
  try {
    dbClient = await pool.connect();
    
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
      return { notFound: true };
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

    return {
      props: {
        news: {
          ...newsItem,
          published_at: newsItem.published_at.toISOString()
        },
        relatedReports: relatedReportsRes.rows,
        userId
      }
    };
  } catch (err) {
    console.error('SSR error fetching news:', err);
    return { notFound: true };
  } finally {
    if (dbClient) dbClient.release();
  }
};
