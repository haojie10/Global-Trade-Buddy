import React from 'react';
import Head from 'next/head';
import Link from 'next/link';

export default function Custom404() {
  return (
    <>
      <Head>
        <title>404 - 页面未找到 | GlobalTradeBuddy</title>
        <meta name="robots" content="noindex, nofollow" />
      </Head>
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100vh',
        backgroundColor: '#090808',
        color: '#ffffff',
        fontFamily: 'system-ui, -apple-system, sans-serif',
        textAlign: 'center',
        padding: '20px'
      }}>
        <h1 style={{ fontSize: '6rem', margin: 0, fontWeight: 700, color: 'var(--color-accent, #ff641e)' }}>404</h1>
        <h2 style={{ fontSize: '2rem', marginTop: '10px', marginBottom: '30px', fontWeight: 500 }}>页面未找到</h2>
        <p style={{ color: 'var(--color-muted, #666666)', marginBottom: '40px', maxWidth: '400px', lineHeight: 1.6 }}>
          抱歉，您访问的页面不存在或已被移除。
        </p>
        <Link href="/" style={{
          display: 'inline-block',
          backgroundColor: 'var(--color-accent, #ff641e)',
          color: '#ffffff',
          padding: '12px 32px',
          borderRadius: 'var(--border-radius, 12px)',
          textDecoration: 'none',
          fontWeight: 500,
          transition: 'all 0.3s ease',
          boxShadow: '0 4px 12px rgba(255, 100, 30, 0.2)'
        }}>
          返回首页
        </Link>
      </div>
    </>
  );
}
