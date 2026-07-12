import { GetServerSideProps } from 'next';
import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import pool from '../../lib/db';

interface Article {
  id: string;
  title: string;
  summary: string;
  region: string;
  country: string;
  industry: string;
  published_at: string;
}

interface NewsIndexProps {
  initialArticles: Article[];
  totalCount: number;
  regions: string[];
  countries: string[];
  industries: string[];
}

export default function NewsIndexPage({
  initialArticles,
  totalCount,
  regions,
  countries,
  industries
}: NewsIndexProps) {
  const [articles, setArticles] = useState<Article[]>(initialArticles);
  const [selRegion, setSelRegion] = useState('All');
  const [selCountry, setSelCountry] = useState('All');
  const [selIndustry, setSelIndustry] = useState('All');
  const [page, setPage] = useState(1);

  // 恢复偏好设置
  useEffect(() => {
    const cacheRegion = localStorage.getItem('gtb_news_region') || 'All';
    const cacheCountry = localStorage.getItem('gtb_news_country') || 'All';
    const cacheIndustry = localStorage.getItem('gtb_news_industry') || 'All';
    setSelRegion(cacheRegion);
    setSelCountry(cacheCountry);
    setSelIndustry(cacheIndustry);
    
    fetchFiltered(cacheRegion, cacheCountry, cacheIndustry, 1);
  }, []);

  const fetchFiltered = async (reg: string, cnt: string, ind: string, pNum: number) => {
    let url = `/api/user/articles?page=${pNum}`;
    if (reg !== 'All') url += `&region=${encodeURIComponent(reg)}`;
    if (cnt !== 'All') url += `&country=${encodeURIComponent(cnt)}`;
    if (ind !== 'All') url += `&industry=${encodeURIComponent(ind)}`;

    const res = await fetch(url);
    const data = await res.json();
    if (data.articles) {
      setArticles(data.articles);
    }
  };

  const handleFilterChange = (type: 'reg' | 'cnt' | 'ind', val: string) => {
    let r = selRegion;
    let c = selCountry;
    let i = selIndustry;

    if (type === 'reg') {
      r = val;
      setSelRegion(val);
      localStorage.setItem('gtb_news_region', val);
    } else if (type === 'cnt') {
      c = val;
      setSelCountry(val);
      localStorage.setItem('gtb_news_country', val);
    } else {
      i = val;
      setSelIndustry(val);
      localStorage.setItem('gtb_news_industry', val);
    }

    setPage(1);
    fetchFiltered(r, c, i, 1);
  };

  return (
    <div style={{ padding: '40px', maxWidth: '1200px', margin: '0 auto', fontFamily: 'sans-serif' }}>
      <header style={{ marginBottom: '30px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h1 style={{ fontSize: '2rem', margin: 0 }}>每日全球资讯厅</h1>
        <Link href="/" style={{ textDecoration: 'none', color: '#ff641e' }}>返回主页</Link>
      </header>

      {/* 筛选菜单栏 */}
      <section style={{ display: 'flex', gap: '20px', marginBottom: '40px', background: '#f5f5f5', padding: '16px', borderRadius: '4px' }}>
        <div>
          <label style={{ marginRight: '8px', fontSize: '0.9rem' }}>区域:</label>
          <select value={selRegion} onChange={(e) => handleFilterChange('reg', e.target.value)}>
            <option value="All">全部区域</option>
            {regions.map(r => <option key={r} value={r}>{r}</option>)}
          </select>
        </div>
        <div>
          <label style={{ marginRight: '8px', fontSize: '0.9rem' }}>国家:</label>
          <select value={selCountry} onChange={(e) => handleFilterChange('cnt', e.target.value)}>
            <option value="All">全部国家</option>
            {countries.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        <div>
          <label style={{ marginRight: '8px', fontSize: '0.9rem' }}>行业:</label>
          <select value={selIndustry} onChange={(e) => handleFilterChange('ind', e.target.value)}>
            <option value="All">全部行业</option>
            {industries.map(i => <option key={i} value={i}>{i}</option>)}
          </select>
        </div>
      </section>

      {/* 资讯卡片展现 */}
      {articles.length === 0 ? (
        <div style={{ padding: '50px', textAlign: 'center', color: '#999' }}>暂无符合条件的资讯</div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '30px' }}>
          {articles.map((art) => (
            <div key={art.id} style={{ border: '1px solid #ddd', padding: '20px', borderRadius: '4px' }}>
              <span style={{ fontSize: '0.75rem', color: '#ff641e', textTransform: 'uppercase', fontWeight: 600 }}>
                {art.industry || '综合'}
              </span>
              <h3 style={{ margin: '8px 0', fontSize: '1.2rem' }}>
                <Link href={`/news/${art.id}`} style={{ textDecoration: 'none', color: '#333' }}>
                  {art.title}
                </Link>
              </h3>
              <p style={{ color: '#666', fontSize: '0.9rem', lineHeight: '1.5' }}>{art.summary}</p>
              <div style={{ marginTop: '15px', fontSize: '0.8rem', color: '#999' }}>
                <span>{art.region} {art.country}</span> • <span>{new Date(art.published_at).toLocaleDateString()}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export const getServerSideProps: GetServerSideProps = async () => {
  const dbClient = await pool.connect();
  try {
    const articlesRes = await dbClient.query(
      `SELECT id, title, summary, region, country, industry, published_at 
       FROM articles ORDER BY published_at DESC LIMIT 20`
    );
    const regions = await dbClient.query(`SELECT DISTINCT region FROM articles WHERE region IS NOT NULL`);
    const countries = await dbClient.query(`SELECT DISTINCT country FROM articles WHERE country IS NOT NULL`);
    const industries = await dbClient.query(`SELECT DISTINCT industry FROM articles WHERE industry IS NOT NULL`);

    return {
      props: {
        initialArticles: articlesRes.rows.map(r => ({
          ...r,
          published_at: r.published_at.toISOString()
        })),
        totalCount: articlesRes.rows.length,
        regions: regions.rows.map(r => r.region),
        countries: countries.rows.map(c => c.country),
        industries: industries.rows.map(i => i.industry)
      }
    };
  } finally {
    dbClient.release();
  }
};
