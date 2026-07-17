import React, { useState } from 'react';
import { GetServerSideProps } from 'next';
import Link from 'next/link';
import pool from '../../lib/db';
import { parseCookies } from '../../lib/cookies';
import WatermarkContainer from '../../components/WatermarkContainer';
import Navbar from '../../components/Navbar';
import AuthModal from '../../components/AuthModal';

interface NewsListItem {
  id: string;
  title: string;
  summary: string;
  published_at: string;
  source_url: string | null;
  industry: string;
  region: string;
  country: string;
}

interface NewsPageProps {
  newsList: NewsListItem[];
  industries: Array<{ id: string; name: string }>;
  userId: string | null;
  userRole: string;
  quota: number;
  nickname: string;
}

export default function PublicNewsPage({ newsList, industries, userId, userRole, quota, nickname }: NewsPageProps) {
  const [selectedIndustry, setSelectedIndustry] = useState('All');
  const [selectedRegion, setSelectedRegion] = useState('All');
  const [showAuthModal, setShowAuthModal] = useState(false);

  const filteredNews = newsList.filter(item => {
    const matchInd = selectedIndustry === 'All' || item.industry === selectedIndustry;
    const matchReg = selectedRegion === 'All' || item.region === selectedRegion;
    return matchInd && matchReg;
  });

  const regions = ['All', '北美', '欧洲', '亚太', '东南亚', '中东', '南美', '非洲'];

  return (
    <WatermarkContainer text={userId ? `GTB USER ${userId.substring(0, 8)}` : 'GTB GUEST'}>
      <Navbar 
        userId={userId} 
        userRole={userRole} 
        quota={quota} 
        nickname={nickname} 
        onShowAuthModal={() => setShowAuthModal(true)} 
      />
      <div style={{
        maxWidth: '1200px',
        margin: '100px auto 40px auto',
        padding: '0 20px',
        fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif"
      }}>

        {/* 标题 */}
        <div style={{ marginBottom: '40px' }}>
          <span style={{ color: 'var(--color-accent)', fontSize: '0.85rem', letterSpacing: '2px', textTransform: 'uppercase', fontWeight: 600 }}>Daily Market News</span>
          <h1 className="font-editorial" style={{ fontSize: '2.8rem', margin: '8px 0 0 0', fontWeight: 400, color: 'var(--color-text)' }}>
            全球出海行业资讯大厅
          </h1>
          <p style={{ color: 'var(--color-muted)', fontSize: '1rem', fontWeight: 300, marginTop: '8px' }}>
            追踪全球市场动态，提供快速的品类、渠道、供应链与关税合规变动动态。
          </p>
        </div>

        {/* 筛选栏 */}
        <div style={{
          display: 'flex',
          gap: '16px',
          marginBottom: '40px',
          alignItems: 'center',
          flexWrap: 'wrap',
          background: 'rgba(255, 255, 255, 0.45)',
          backdropFilter: 'blur(15px)',
          WebkitBackdropFilter: 'blur(15px)',
          border: '1px solid rgba(18, 18, 18, 0.05)',
          padding: '16px 24px',
          borderRadius: 'var(--border-radius)'
        }}>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <span style={{ fontSize: '0.85rem', color: 'var(--color-muted)', fontWeight: 500 }}>关联行业</span>
            <select
              value={selectedIndustry}
              onChange={(e) => setSelectedIndustry(e.target.value)}
              style={{
                background: 'rgba(255,255,255,0.85)',
                border: '1px solid rgba(18, 18, 18, 0.1)',
                padding: '8px 12px',
                fontSize: '0.85rem',
                color: 'var(--color-text)',
                outline: 'none',
                cursor: 'pointer'
              }}
            >
              <option value="All">全部行业</option>
              {industries.map(ind => (
                <option key={ind.id} value={ind.name}>{ind.name}</option>
              ))}
            </select>
          </div>

          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <span style={{ fontSize: '0.85rem', color: 'var(--color-muted)', fontWeight: 500 }}>市场区域</span>
            <select
              value={selectedRegion}
              onChange={(e) => setSelectedRegion(e.target.value)}
              style={{
                background: 'rgba(255,255,255,0.85)',
                border: '1px solid rgba(18, 18, 18, 0.1)',
                padding: '8px 12px',
                fontSize: '0.85rem',
                color: 'var(--color-text)',
                outline: 'none',
                cursor: 'pointer'
              }}
            >
              <option value="All">全部区域</option>
              {regions.filter(r => r !== 'All').map(r => (
                <option key={r} value={r}>{r}</option>
              ))}
            </select>
          </div>
        </div>

        {/* 资讯列表网格 */}
        {filteredNews.length === 0 ? (
          <div style={{ padding: '60px', textAlign: 'center', color: 'var(--color-muted)', border: '1px dashed rgba(18, 18, 18, 0.08)' }}>
            没有符合当前筛选条件的资讯
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: '30px', marginBottom: '80px' }}>
            {filteredNews.map((art) => {
              const itemDate = new Date(art.published_at).toLocaleDateString('zh-CN');
              return (
                <div key={art.id} className="float-on-hover" style={{ 
                  background: 'rgba(255, 255, 255, 0.55)', 
                  backdropFilter: 'blur(15px)', 
                  WebkitBackdropFilter: 'blur(15px)', 
                  border: '1px solid rgba(18, 18, 18, 0.05)', 
                  padding: '28px', 
                  borderRadius: 'var(--border-radius)',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  boxShadow: '0 10px 30px rgba(0,0,0,0.01)'
                }}>
                  <div>
                    <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
                      <span style={{ fontSize: '0.7rem', color: '#2e5bff', background: 'rgba(46, 91, 255, 0.05)', padding: '2px 8px', fontWeight: 600 }}>
                        {art.industry || '综合'}
                      </span>
                      <span style={{ fontSize: '0.7rem', color: 'var(--color-accent)', background: 'rgba(255, 100, 30, 0.05)', padding: '2px 8px', fontWeight: 600 }}>
                        {art.country || art.region || '全球'}
                      </span>
                    </div>

                    <h3 style={{ margin: '0 0 10px 0', fontSize: '1.3rem', fontWeight: 500, lineHeight: 1.35 }}>
                      <Link href={`/news/${art.id}`} style={{ textDecoration: 'none', color: 'var(--color-text)' }}>
                        {art.title}
                      </Link>
                    </h3>
                    
                    <p style={{
                      color: 'var(--color-muted)',
                      fontSize: '0.9rem',
                      lineHeight: '1.5',
                      fontWeight: 300,
                      margin: 0,
                      display: '-webkit-box',
                      WebkitLineClamp: 3,
                      WebkitBoxOrient: 'vertical',
                      overflow: 'hidden'
                    }}>
                      {art.summary}
                    </p>
                  </div>

                  <div style={{
                    marginTop: '24px',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    fontSize: '0.8rem',
                    color: 'var(--color-muted)',
                    borderTop: '1px solid rgba(18,18,18,0.05)',
                    paddingTop: '12px'
                  }}>
                    <span>{itemDate}</span>
                    <Link href={`/news/${art.id}`} style={{ textDecoration: 'none', color: 'var(--color-accent)', fontWeight: 500 }}>
                      阅读详情 →
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        )}
        <AuthModal 
          isOpen={showAuthModal} 
          onClose={() => setShowAuthModal(false)} 
        />
      </div>
    </WatermarkContainer>
  );
}

export const getServerSideProps: GetServerSideProps = async (context) => {
  const cookies = parseCookies(context.req.headers.cookie);
  const cookieUserId = cookies.user_id || null;

  let dbClient = null;
  let userId: string | null = null;
  let userRole = 'guest';
  let quota = 0;
  let nickname = '';

  try {
    dbClient = await pool.connect();

    if (cookieUserId) {
      const userRes = await dbClient.query('SELECT id, role, free_quota, nickname FROM users WHERE id = $1', [cookieUserId]);
      if (userRes.rows.length > 0) {
        userId = userRes.rows[0].id;
        userRole = userRes.rows[0].role;
        quota = userRes.rows[0].free_quota;
        nickname = userRes.rows[0].nickname || '';
      }
    }

    // 1. 获取所有公开快讯
    const newsRes = await dbClient.query(
      `SELECT n.id, n.title, n.summary, n.published_at, n.source_url,
              (SELECT name FROM industries JOIN news_industries ON industries.id = news_industries.industry_id WHERE news_id = n.id LIMIT 1) as industry,
              (SELECT region FROM countries JOIN news_countries ON countries.id = news_countries.country_id WHERE news_id = n.id LIMIT 1) as region,
              (SELECT name FROM countries JOIN news_countries ON countries.id = news_countries.country_id WHERE news_id = n.id LIMIT 1) as country
       FROM news n
       WHERE n.status = 'published'
       ORDER BY n.published_at DESC`
    );

    const newsList = newsRes.rows.map((row: any) => ({
      ...row,
      published_at: row.published_at ? row.published_at.toISOString() : null
    }));

    // 2. 获取所有行业列表供筛选使用
    const industriesRes = await dbClient.query('SELECT id, name FROM industries ORDER BY name ASC');

    return {
      props: {
        newsList,
        industries: industriesRes.rows,
        userId,
        userRole,
        quota,
        nickname
      }
    };
  } catch (err) {
    console.error('Error fetching public news list page SSR:', err);
    return {
      props: {
        newsList: [],
        industries: [],
        userId,
        userRole,
        quota,
        nickname
      }
    };
  } finally {
    if (dbClient) dbClient.release();
  }
};
