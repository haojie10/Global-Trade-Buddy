import React, { useState } from 'react';
import { GetServerSideProps } from 'next';
import Head from 'next/head';
import pool from '../../lib/db';
import { parseCookies } from '../../lib/cookies';
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
  const [showAll, setShowAll] = useState(false);

  const displayedReports = showAll ? reports : reports.slice(0, 9);

  return (
    <div style={{
      background: 'transparent',
      color: 'var(--color-text)',
      minHeight: '100vh',
      position: 'relative'
    }}>
      <Head>
        <title>报告大厅 | Market Graphic</title>
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

        {/* 报告列表 */}
        <ReportList
          reports={displayedReports}
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

        {/* 加载更多 */}
        {!showAll && reports.length > 9 && (
          <div style={{ textAlign: 'center', marginTop: '48px' }}>
            <button
              onClick={() => setShowAll(true)}
              style={{
                padding: '14px 40px',
                fontSize: '0.95rem',
                background: 'transparent',
                border: '1px solid rgba(18, 18, 18, 0.15)',
                color: 'var(--color-text)',
                cursor: 'pointer',
                transition: 'all 0.2s',
                borderRadius: '0px'
              }}
              onMouseOver={(e) => {
                e.currentTarget.style.borderColor = 'var(--color-accent)';
                e.currentTarget.style.color = 'var(--color-accent)';
              }}
              onMouseOut={(e) => {
                e.currentTarget.style.borderColor = 'rgba(18, 18, 18, 0.15)';
                e.currentTarget.style.color = 'var(--color-text)';
              }}
            >
              查看全部报告（还有 {reports.length - 9} 份）➔
            </button>
          </div>
        )}
      </div>

      <AuthModal
        isOpen={showAuthModal}
        onClose={() => setShowAuthModal(false)}
      />
    </div>
  );
}

export const getServerSideProps: GetServerSideProps = async (context) => {
  const cookies = parseCookies(context.req.headers.cookie);
  const cookieUserId = cookies.user_id;

  let dbClient: any = null;
  let userId: string | null = null;
  let userRole = 'guest';
  let quota = 0;
  let nickname = '';

  try {
    dbClient = await pool.connect();

    if (cookieUserId) {
      const userRes = await dbClient.query(
        'SELECT id, role, free_quota, nickname FROM users WHERE id = $1',
        [cookieUserId]
      );
      if (userRes.rows.length > 0) {
        userId = userRes.rows[0].id;
        userRole = userRes.rows[0].role;
        quota = userRes.rows[0].free_quota;
        nickname = userRes.rows[0].nickname || '';
      }
    }

    let allReports: PlatformReport[] = [];

    if (userId && userRole === 'admin') {
      const res = await dbClient.query(`
        SELECT r.id, r.title, r.category, r.market_region, r.summary,
               EXISTS(SELECT 1 FROM favorites f WHERE f.user_id = $1 AND f.report_id = r.id) as is_favorited
        FROM reports r ORDER BY r.created_at DESC
      `, [userId]);
      allReports = res.rows.map((row: any) => ({
        id: row.id, title: row.title, category: row.category,
        market_region: row.market_region, summary: row.summary,
        isUnlocked: true, isFavorited: row.is_favorited
      }));
    } else if (userId) {
      const res = await dbClient.query(`
        SELECT r.id, r.title, r.category, r.market_region, r.summary,
               EXISTS(SELECT 1 FROM unlocks u WHERE u.user_id = $1 AND u.report_id = r.id) as is_unlocked,
               EXISTS(SELECT 1 FROM favorites f WHERE f.user_id = $1 AND f.report_id = r.id) as is_favorited
        FROM reports r ORDER BY r.created_at DESC
      `, [userId]);
      allReports = res.rows.map((row: any) => ({
        id: row.id, title: row.title, category: row.category,
        market_region: row.market_region, summary: row.summary,
        isUnlocked: row.is_unlocked, isFavorited: row.is_favorited
      }));
    } else {
      const res = await dbClient.query(
        'SELECT id, title, category, market_region, summary FROM reports ORDER BY created_at DESC'
      );
      allReports = res.rows.map((row: any) => ({
        id: row.id, title: row.title, category: row.category,
        market_region: row.market_region, summary: row.summary,
        isUnlocked: false, isFavorited: false
      }));
    }

    context.res.setHeader('Cache-Control', 'no-store, must-revalidate');

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
