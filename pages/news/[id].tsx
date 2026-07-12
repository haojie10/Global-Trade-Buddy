import { GetServerSideProps } from 'next';
import Head from 'next/head';
import React from 'react';
import pool from '../../lib/db';
import Link from 'next/link';

interface Article {
  id: string;
  title: string;
  summary: string;
  content_html: string;
  region: string;
  country: string;
  industry: string;
  published_at: string;
}

interface RelatedReport {
  id: string;
  title: string;
  category: string;
  market_region: string;
}

interface NewsDetailProps {
  article: Article | null;
  relatedReports: RelatedReport[];
}

export default function NewsDetailPage({ article, relatedReports }: NewsDetailProps) {
  if (!article) {
    return <div style={{ padding: '50px', textAlign: 'center' }}>资讯未找到</div>;
  }

  return (
    <div style={{ padding: '40px', maxWidth: '800px', margin: '0 auto', fontFamily: 'sans-serif' }}>
      <Head>
        <title>{article.title} - Global Trade Buddy</title>
        <meta name="description" content={article.summary || article.title} />
        <meta property="og:title" content={article.title} />
        <meta property="og:description" content={article.summary || article.title} />
        <meta property="og:type" content="article" />
      </Head>

      <header style={{ marginBottom: '30px' }}>
        <Link href="/news" style={{ textDecoration: 'none', color: '#ff641e' }}>← 返回资讯大厅</Link>
      </header>

      <article>
        <h1 style={{ fontSize: '2.5rem', marginBottom: '10px' }}>{article.title}</h1>
        <div style={{ color: '#999', fontSize: '0.9rem', marginBottom: '30px', borderBottom: '1px solid #eee', paddingBottom: '15px' }}>
          <span>分类: {article.industry || '综合'}</span> • <span>发布于: {new Date(article.published_at).toLocaleDateString()}</span>
        </div>

        <div 
          style={{ lineHeight: 1.8, fontSize: '1.1rem', color: '#222' }}
          dangerouslySetInnerHTML={{ __html: article.content_html }} 
        />
      </article>

      {relatedReports.length > 0 && (
        <section style={{ marginTop: '60px', borderTop: '2px solid #ff641e', paddingTop: '30px' }}>
          <h3>相关行业报告推荐</h3>
          <ul style={{ paddingLeft: '20px' }}>
            {relatedReports.map((rep) => (
              <li key={rep.id} style={{ margin: '12px 0' }}>
                <Link href={`/reports/${rep.id}`} style={{ color: '#333', textDecoration: 'none', fontWeight: 500 }}>
                  [{rep.market_region}] {rep.title} ({rep.category === 'product' ? '品类报告' : '公司报告'})
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

export const getServerSideProps: GetServerSideProps = async (context) => {
  const { id } = context.params || {};
  const dbClient = await pool.connect();
  try {
    const artRes = await dbClient.query(
      `SELECT id, title, summary, content_html, region, country, industry, published_at 
       FROM articles WHERE id = $1`,
      [id]
    );

    if (artRes.rows.length === 0) {
      return { props: { article: null, relatedReports: [] } };
    }

    const article = artRes.rows[0];

    // 通过关联实体获取相同主体的付费报告推荐（限制 5 条）
    const relatedReportsRes = await dbClient.query(
      `SELECT DISTINCT r.id, r.title, r.category, r.market_region 
       FROM reports r
       JOIN report_entities re ON r.id = re.report_id
       WHERE re.entity_id IN (
           SELECT entity_id FROM article_entities WHERE article_id = $1
       ) LIMIT 5`,
      [id]
    );

    return {
      props: {
        article: {
          ...article,
          published_at: article.published_at.toISOString()
        },
        relatedReports: relatedReportsRes.rows
      }
    };
  } finally {
    dbClient.release();
  }
};
