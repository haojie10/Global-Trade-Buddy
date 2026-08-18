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
  canonicalUrl?: string;
  siteUrl?: string;
  userId: string | null;
  userRole: string;
  quota: number;
  nickname: string;
}

export default function NewsDetailPage({ news, relatedReports, canonicalUrl, siteUrl, userId, userRole, quota, nickname, error }: NewsDetailProps) {
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

    // 提取纯文本摘要与关键词用于 SEO
    const plainSummary = news.summary || (news.content ? news.content.replace(/<[^>]+>/g, '').replace(/[#*`~\[\]\(\)]/g, '').slice(0, 160).trim() : '');
    const keywordsList = [news.industries, news.countries, '外贸资讯', '出海热点', '全球市场动态', '海运运价', '关税政策', 'Market Graphic'].filter(Boolean).join(', ');

    // 提取正文首图用于 og:image
    let firstImage = '';
    if (news.content) {
      const imgMatch = news.content.match(/<img[^>]+src=["']([^"']+)["']/i) || news.content.match(/!\[.*?\]\((https?:\/\/[^\s\)]+)\)/i);
      if (imgMatch && imgMatch[1]) {
        firstImage = imgMatch[1];
      }
    }
    const defaultCover = siteUrl ? `${siteUrl}/images/global_trade_trends.jpg` : '/images/global_trade_trends.jpg';
    const ogImageUrl = firstImage || defaultCover;

    return (
      <WatermarkContainer text={userId ? `外贸智友 - 用户: ${nickname || userId.substring(0, 8)}` : '外贸智友 - 游客浏览模式'}>
        <Head>
          {/* 1. 基础 SEO / TDK (针对百度、搜狗、360等国内搜索引擎) */}
          <title>{`${news.title} | 外贸智友 - 行业热点情报`}</title>
          <meta name="description" content={plainSummary} />
          <meta name="keywords" content={keywordsList} />
          <meta name="author" content="外贸智友 GlobalTradeBuddy" />
          <meta name="robots" content="index, follow" />
          <meta name="applicable-device" content="pc,mobile" />
          <meta name="format-detection" content="telephone=no" />
          {canonicalUrl && <link rel="canonical" href={canonicalUrl} />}

          {/* 2. 百度搜索移动端出图 (搜索结果缩略图) */}
          <meta name="thumbnail" content={ogImageUrl} />

          {/* 3. 腾讯系 / 微信 / QQ 网页分享卡片协议 (itemprop 标准) */}
          <meta itemProp="name" content={news.title} />
          <meta itemProp="description" content={plainSummary} />
          <meta itemProp="image" content={ogImageUrl} />

          {/* 4. 国内主流社交平台标准 OpenGraph 协议 (微信、知乎、微博、今日头条、抖音) */}
          <meta property="og:type" content="article" />
          <meta property="og:title" content={news.title} />
          <meta property="og:description" content={plainSummary} />
          <meta property="og:image" content={ogImageUrl} />
          <meta property="og:image:alt" content={news.title} />
          {canonicalUrl && <meta property="og:url" content={canonicalUrl} />}
          <meta property="og:site_name" content="外贸智友 GlobalTradeBuddy" />
          {news.published_at && <meta property="article:published_time" content={news.published_at} />}
          {news.industries && <meta property="article:section" content={news.industries} />}
          {news.countries && <meta property="article:tag" content={news.countries} />}

          {/* Twitter Card */}
          <meta name="twitter:card" content="summary_large_image" />
          <meta name="twitter:title" content={`${news.title} | 外贸智友`} />
          <meta name="twitter:description" content={plainSummary} />
          <meta name="twitter:image" content={ogImageUrl} />

          {/* 5. 百度/国内搜索引擎结构化数据 */}
          <script
            type="application/ld+json"
            dangerouslySetInnerHTML={{
              __html: JSON.stringify({
                '@context': 'https://ziyuan.baidu.com/contexts/cambrian.jsonld',
                '@id': canonicalUrl || '',
                title: news.title,
                images: [ogImageUrl],
                description: plainSummary,
                pubDate: news.published_at,
                upDate: news.published_at
              })
            }}
          />

          <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'NewsArticle',
            headline: news.title,
            description: plainSummary,
            image: [ogImageUrl],
            datePublished: news.published_at,
            dateModified: news.published_at,
            author: {
              '@type': 'Organization',
              name: '外贸智友 GlobalTradeBuddy',
              url: 'https://marketgraphic.cn'
            },
            publisher: {
              '@type': 'Organization',
              name: 'Market Graphic',
              url: 'https://marketgraphic.cn',
              logo: {
                '@type': 'ImageObject',
                url: 'https://marketgraphic.cn/images/mg_logo.png'
              }
            },
            mainEntityOfPage: {
              '@type': 'WebPage',
              '@id': canonicalUrl || ''
            }
          }) }} />
        </Head>

        {/* 微信内置浏览器分享兜底隐形首图 (微信早期与部分版本爬虫强制读取 Body 首张 300x300 图) */}
        <div style={{ display: 'none', position: 'absolute', width: 0, height: 0, overflow: 'hidden' }}>
          <img src={ogImageUrl} alt={news.title} width="300" height="300" />
        </div>
        <Navbar 
          userId={userId} 
          userRole={userRole} 
          quota={quota} 
          nickname={nickname} 
          onShowAuthModal={() => setShowAuthModal(true)} 
        />
        <div style={{
          maxWidth: '900px',
          margin: '0 auto',
          padding: '110px 20px 40px 20px',
          fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif"
        }}>

          {/* 资讯主内容卡片 */}
          <article style={{
            background: 'rgba(255, 255, 255, 0.45)',
            backdropFilter: 'blur(15px)',
            WebkitBackdropFilter: 'blur(15px)',
            border: '1px solid rgba(18, 18, 18, 0.05)',
            borderRadius: 'var(--border-radius)',
            padding: '24px 30px',
            boxShadow: '0 8px 32px rgba(0,0,0,0.01)',
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
                  border: '1px solid rgba(46, 91, 255, 0.1)',
                  borderRadius: 'var(--border-radius)'
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
                  border: '1px solid rgba(255, 100, 30, 0.1)',
                  borderRadius: 'var(--border-radius)'
                }}>
                  🌍 {cty}
                </span>
              ))}
            </div>

            <h1 className="font-editorial" style={{
              fontSize: '2.4rem',
              margin: '0 0 16px 0',
              color: 'var(--color-text)',
              lineHeight: 1.3,
              fontWeight: 400,
              letterSpacing: '-0.015em'
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
              color: '#3c3935',
              fontSize: '0.95rem',
              lineHeight: 1.65
            }}>
              {renderContent(news.content)}
            </div>
          </article>

          {/* 关联报告推荐区域 */}
          {relatedReports && relatedReports.length > 0 && (
            <section style={{ marginTop: '48px' }}>
              <h3 className="font-editorial" style={{
                fontSize: '1.1rem',
                fontWeight: 300,
                color: 'var(--color-text)',
                marginBottom: '20px',
                letterSpacing: '-0.3px'
              }}>
                💡 相关深度出海研报推荐
              </h3>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '20px' }}>
                {relatedReports.map(rep => (
                  <div key={rep.id} className="report-card" style={{
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

    // 1. 并发查询快讯详情与关联推荐候选报告
    const newsPromise = dbClient.query(
      `SELECT n.id, n.title, n.summary, n.content, n.source_url, n.published_at,
              ARRAY_TO_STRING(ARRAY(SELECT name FROM industries JOIN news_industries ON industries.id = news_industries.industry_id WHERE news_id = n.id), ', ') as industries,
              ARRAY_TO_STRING(ARRAY(SELECT name FROM countries JOIN news_countries ON countries.id = news_countries.country_id WHERE news_id = n.id), ', ') as countries
       FROM news n
       WHERE n.id = $1 AND n.status = 'published'`,
      [id]
    );

    const candidatePromise = dbClient.query(
      `SELECT r.id, r.title, r.category, r.market_region, r.summary, r.created_at,
              COUNT(ri.industry_id)::int AS hit_count
       FROM reports r
       JOIN report_industries ri ON r.id = ri.report_id
       WHERE ri.industry_id IN (
         SELECT industry_id FROM news_industries WHERE news_id = $1
       )
       GROUP BY r.id, r.title, r.category, r.market_region, r.summary, r.created_at
       ORDER BY hit_count DESC, r.created_at DESC
       LIMIT 10`,
      [id]
    );

    const [newsRes, candidateReportsRes] = await Promise.all([
      newsPromise,
      candidatePromise
    ]);

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
    let finalRelatedReports: any[] = [];
    if (candidateReportsRes.rows.length > 0) {
      // 2.1 按契合度 hit_count 分组（高契合度优先）
      const groups: { [key: number]: any[] } = {};
      for (const row of candidateReportsRes.rows) {

        const count = row.hit_count || 1;
        if (!groups[count]) groups[count] = [];
        groups[count].push(row);
      }

      // 获取所有契合度从高到低的层级
      const sortedCounts = Object.keys(groups).map(Number).sort((a, b) => b - a);

      for (const count of sortedCounts) {
        if (finalRelatedReports.length >= 3) break;

        const groupItems = groups[count];
        // 2.2 在同等契合度层级内部做 Fisher-Yates 动态洗牌打散，增加每次刷新页面的轮播丰富度
        const shuffledGroup = [...groupItems];
        for (let i = shuffledGroup.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [shuffledGroup[i], shuffledGroup[j]] = [shuffledGroup[j], shuffledGroup[i]];
        }

        const needed = 3 - finalRelatedReports.length;
        finalRelatedReports.push(...shuffledGroup.slice(0, needed));
      }
    }

    // 确保 published_at 转换不报错，防范 null/string 类型的 issue
    let published_at_str = '';
    if (newsItem.published_at) {
      if (typeof newsItem.published_at.toISOString === 'function') {
        published_at_str = newsItem.published_at.toISOString();
      } else {
        published_at_str = new Date(newsItem.published_at).toISOString();
      }
    }

    const proto = (context.req.headers['x-forwarded-proto'] as string) || 'https';
    const host = (context.req.headers['x-forwarded-host'] as string) || context.req.headers.host || 'marketgraphic.cn';
    const siteUrl = `${proto}://${host}`;
    const canonicalUrl = `${siteUrl}/news/${id}`;

    return {
      props: {
        error: null,
        news: {
          ...newsItem,
          published_at: published_at_str
        },
        relatedReports: finalRelatedReports,
        canonicalUrl,
        siteUrl,
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
