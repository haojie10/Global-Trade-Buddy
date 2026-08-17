import React, { useState } from 'react';
import { GetServerSideProps } from 'next';
import Head from 'next/head';
import pool from '../../lib/db';
import { resolveSsrAuth } from '../../lib/ssr-auth';
import ReportList, { PlatformReport } from '../../components/ReportList';
import Navbar from '../../components/Navbar';
import AuthModal from '../../components/AuthModal';

interface ReportsPageProps {
  reports: PlatformReport[];
  userId: string | null;
  userRole: string;
  quota: number;
  nickname: string;
}

export default function ReportsPage({ reports: initialReports, userId, userRole, quota: initialQuota, nickname }: ReportsPageProps) {
  const [reports, setReports] = useState(initialReports);
  const [quota, setQuota] = useState(initialQuota);
  const [showAuthModal, setShowAuthModal] = useState(false);

  return (
    <div style={{
      background: 'transparent',
      color: 'var(--color-text)',
      minHeight: '100vh',
      position: 'relative'
    }}>
      <Head>
        <title>报告大厅 | Market Graphic</title>
        <meta name="description" content="Market Graphic 报告大厅 — 覆盖全球主要市场的深度品类准入分析报告与买家 360° 穿透洞察，助力外贸企业精准出海。" />
        <meta name="keywords" content="出海调研报告, 品类分析, 买家洞察, 全球市场报告, 外贸报告, 跨境电商调研, 外贸智友" />
        <meta name="author" content="外贸智友 GlobalTradeBuddy" />
        <meta name="robots" content="index, follow" />
        <link rel="canonical" href="https://marketgraphic.cn/reports" />
        {/* Open Graph */}
        <meta property="og:type" content="website" />
        <meta property="og:title" content="报告大厅 | Market Graphic" />
        <meta property="og:description" content="覆盖全球主要市场的深度品类准入分析报告与买家 360° 穿透洞察，助力外贸企业精准出海。" />
        <meta property="og:image" content="https://marketgraphic.cn/images/discover_focus_panorama.jpg" />
        <meta property="og:url" content="https://marketgraphic.cn/reports" />
        <meta property="og:site_name" content="Market Graphic" />
        {/* Twitter Card */}
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content="报告大厅 | Market Graphic" />
        <meta name="twitter:description" content="覆盖全球主要市场的深度品类准入分析报告与买家洞察。" />
        <meta name="twitter:image" content="https://marketgraphic.cn/images/discover_focus_panorama.jpg" />
      </Head>
      {/* 全局背景流光光源 */}
      <div className="ambient-glow-container">
        <div className="ambient-light ambient-light-1" />
      </div>

      <Navbar
        userId={userId}
        userRole={userRole}
        quota={quota}
        nickname={nickname}
        onShowAuthModal={() => setShowAuthModal(true)}
      />

      <div style={{
        maxWidth: '1400px',
        margin: '0 auto',
        padding: '110px 40px 80px 40px'
      }}>
        {/* 页面标题 */}
        <div style={{ marginBottom: '48px' }}>
          <span style={{
            color: 'var(--color-accent)',
            fontSize: '0.85rem',
            letterSpacing: '2px',
            textTransform: 'uppercase',
            fontWeight: 600
          }}>
            Report Library
          </span>
          <h1 className="font-editorial" style={{
            fontSize: '2.8rem',
            margin: '8px 0 0 0',
            fontWeight: 400,
            color: 'var(--color-text)'
          }}>
            报告大厅
          </h1>
          <p style={{
            color: 'var(--color-muted)',
            fontSize: '1rem',
            fontWeight: 300,
            marginTop: '8px'
          }}>
            深度行业洞察，覆盖全球主要市场与渠道的品类准入分析报告。
          </p>
        </div>

        {/* 报告列表（20篇/页分页） */}
        <ReportList
          reports={reports}
          userId={userId || ''}
          userRole={userRole}
          quota={quota}
          onUnlockSuccess={(newQuota, unlockedReportId) => {
            setQuota(newQuota);
            setReports(prev => prev.map(r => r.id === unlockedReportId ? { ...r, isUnlocked: true } : r));
          }}
          onDeleteReport={(reportId) => {
            setReports(prev => prev.filter(r => r.id !== reportId));
          }}
          onFavoriteToggle={(reportId, isFavorited) => {
            setReports(prev => prev.map(r => r.id === reportId ? { ...r, isFavorited } : r));
          }}
        />
      </div>

      <AuthModal
        isOpen={showAuthModal}
        onClose={() => setShowAuthModal(false)}
      />
    </div>
  );
}

export const getServerSideProps: GetServerSideProps = async (context) => {
  let dbClient: any = null;

  try {
    dbClient = await pool.connect();
    const auth = await resolveSsrAuth(context, dbClient);
    const userId = auth.userId;
    const userRole = auth.userRole;
    const quota = auth.freeQuota;
    const nickname = auth.nickname;

    let allReports: PlatformReport[] = [];

    if (userId && userRole === 'admin') {
      const res = await dbClient.query(`
        SELECT r.id, r.title, r.category, r.market_region, r.summary,
               ARRAY_TO_STRING(ARRAY(
                 SELECT name FROM industries 
                 JOIN report_industries ON industries.id = report_industries.industry_id 
                 WHERE report_id = r.id
               ), ', ') as industries,
               EXISTS(SELECT 1 FROM favorites f WHERE f.user_id = $1 AND f.report_id = r.id) as is_favorited
        FROM reports r ORDER BY r.created_at DESC
      `, [userId]);
      allReports = res.rows.map((row: any) => ({
        id: row.id, title: row.title, category: row.category,
        market_region: row.market_region,
        summary: row.summary ? (row.summary.length > 150 ? row.summary.slice(0, 150) + '...' : row.summary) : '',
        industries: row.industries || '',
        isUnlocked: true, isFavorited: row.is_favorited
      }));
    } else if (userId) {
      const res = await dbClient.query(`
        SELECT r.id, r.title, r.category, r.market_region, r.summary,
               ARRAY_TO_STRING(ARRAY(
                 SELECT name FROM industries 
                 JOIN report_industries ON industries.id = report_industries.industry_id 
                 WHERE report_id = r.id
               ), ', ') as industries,
               EXISTS(SELECT 1 FROM unlocks u WHERE u.user_id = $1 AND u.report_id = r.id) as is_unlocked,
               EXISTS(SELECT 1 FROM favorites f WHERE f.user_id = $1 AND f.report_id = r.id) as is_favorited
        FROM reports r ORDER BY r.created_at DESC
      `, [userId]);
      allReports = res.rows.map((row: any) => ({
        id: row.id, title: row.title, category: row.category,
        market_region: row.market_region,
        summary: row.summary ? (row.summary.length > 150 ? row.summary.slice(0, 150) + '...' : row.summary) : '',
        industries: row.industries || '',
        isUnlocked: row.is_unlocked, isFavorited: row.is_favorited
      }));
    } else {
      const res = await dbClient.query(`
        SELECT r.id, r.title, r.category, r.market_region, r.summary,
               ARRAY_TO_STRING(ARRAY(
                 SELECT name FROM industries 
                 JOIN report_industries ON industries.id = report_industries.industry_id 
                 WHERE report_id = r.id
               ), ', ') as industries
        FROM reports r ORDER BY r.created_at DESC
      `);
      allReports = res.rows.map((row: any) => ({
        id: row.id, title: row.title, category: row.category,
        market_region: row.market_region,
        summary: row.summary ? (row.summary.length > 150 ? row.summary.slice(0, 150) + '...' : row.summary) : '',
        industries: row.industries || '',
        isUnlocked: false, isFavorited: false
      }));
    }


    context.res.setHeader('Cache-Control', 'public, s-maxage=300, stale-while-revalidate=600');

    return {
      props: { reports: allReports, userId, userRole, quota, nickname }
    };
  } catch (err) {
    console.error('报告大厅 SSR 错误:', err);
    return {
      props: { reports: [], userId: null, userRole: 'guest', quota: 0, nickname: '' }
    };
  } finally {
    if (dbClient) dbClient.release();
  }
};
