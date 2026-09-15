import React, { useState } from 'react';
import Link from 'next/link';
import LegalModal from './LegalModal';

export default function Footer() {
  const [legalModalOpen, setLegalModalOpen] = useState(false);
  const [legalTab, setLegalTab] = useState<'data_compliance' | 'user_agreement'>('data_compliance');

  const openLegalModal = (tab: 'data_compliance' | 'user_agreement') => {
    setLegalTab(tab);
    setLegalModalOpen(true);
  };

  return (
    <>
      <footer
        style={{
          borderTop: '1px solid rgba(18, 18, 18, 0.06)',
          backgroundColor: 'rgba(253, 251, 247, 0.85)',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          padding: '24px 32px',
          color: 'var(--color-text, #111111)',
          position: 'relative',
          zIndex: 10,
          boxSizing: 'border-box'
        }}
      >
        <div
          style={{
            maxWidth: '1280px',
            margin: '0 auto',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '16px'
          }}
        >
          {/* 左侧：品牌与版权 */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
            <span
              className="font-editorial"
              style={{
                fontSize: '1.05rem',
                fontWeight: 600,
                color: 'var(--color-text, #111111)',
                letterSpacing: '-0.2px'
              }}
            >
              Market Graphic
            </span>
            <span style={{ fontSize: '0.8rem', color: 'var(--color-muted, #777)' }}>
              外贸智友
            </span>
            <span style={{ fontSize: '0.78rem', color: 'var(--color-muted, #999)' }}>
              © {new Date().getFullYear()} 保留所有权利
            </span>
          </div>

          {/* 右侧：精简去重导航、合规与备案链接 (单行横向排布) */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '18px',
              flexWrap: 'wrap',
              fontSize: '0.82rem'
            }}
          >
            <Link
              href="/reports"
              style={{
                color: 'var(--color-muted, #555)',
                textDecoration: 'none',
                transition: 'color 0.2s'
              }}
              onMouseOver={(e) => (e.currentTarget.style.color = 'var(--color-accent, #ff641e)')}
              onMouseOut={(e) => (e.currentTarget.style.color = 'var(--color-muted, #555)')}
            >
              报告大厅
            </Link>

            <Link
              href="/news"
              style={{
                color: 'var(--color-muted, #555)',
                textDecoration: 'none',
                transition: 'color 0.2s'
              }}
              onMouseOver={(e) => (e.currentTarget.style.color = 'var(--color-accent, #ff641e)')}
              onMouseOut={(e) => (e.currentTarget.style.color = 'var(--color-muted, #555)')}
            >
              每日资讯
            </Link>

            <Link
              href="/my-graph"
              style={{
                color: 'var(--color-muted, #555)',
                textDecoration: 'none',
                transition: 'color 0.2s'
              }}
              onMouseOver={(e) => (e.currentTarget.style.color = 'var(--color-accent, #ff641e)')}
              onMouseOut={(e) => (e.currentTarget.style.color = 'var(--color-muted, #555)')}
            >
              个人图谱
            </Link>

            <span style={{ color: 'rgba(18, 18, 18, 0.15)' }}>|</span>

            <button
              onClick={() => openLegalModal('data_compliance')}
              style={{
                background: 'transparent',
                border: 'none',
                padding: 0,
                color: 'var(--color-muted, #555)',
                fontSize: '0.82rem',
                cursor: 'pointer',
                transition: 'color 0.2s'
              }}
              onMouseOver={(e) => (e.currentTarget.style.color = 'var(--color-accent, #ff641e)')}
              onMouseOut={(e) => (e.currentTarget.style.color = 'var(--color-muted, #555)')}
            >
              采编合规声明
            </button>

            <button
              onClick={() => openLegalModal('user_agreement')}
              style={{
                background: 'transparent',
                border: 'none',
                padding: 0,
                color: 'var(--color-muted, #555)',
                fontSize: '0.82rem',
                cursor: 'pointer',
                transition: 'color 0.2s'
              }}
              onMouseOver={(e) => (e.currentTarget.style.color = 'var(--color-accent, #ff641e)')}
              onMouseOut={(e) => (e.currentTarget.style.color = 'var(--color-muted, #555)')}
            >
              用户协议
            </button>

            <span style={{ color: 'rgba(18, 18, 18, 0.15)' }}>|</span>

            <a
              href="https://beian.miit.gov.cn/"
              target="_blank"
              rel="noopener noreferrer"
              style={{
                color: 'var(--color-accent, #ff641e)',
                textDecoration: 'none',
                fontWeight: 500,
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px'
              }}
            >
              <span>浙ICP备2026064136号-1</span>
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                <polyline points="15 3 21 3 21 9" />
                <line x1="10" y1="14" x2="21" y2="3" />
              </svg>
            </a>
          </div>
        </div>
      </footer>

      {/* 法律与合规弹窗 */}
      <LegalModal
        isOpen={legalModalOpen}
        onClose={() => setLegalModalOpen(false)}
        initialTab={legalTab}
      />
    </>
  );
}
