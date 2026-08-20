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
          borderTop: '1px solid rgba(18, 18, 18, 0.08)',
          backgroundColor: 'rgba(253, 251, 247, 0.75)',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          padding: '50px 24px 36px 24px',
          color: 'var(--color-text, #111111)',
          position: 'relative',
          zIndex: 10,
          marginTop: 'auto'
        }}
      >
        <div
          style={{
            maxWidth: '1360px',
            margin: '0 auto',
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
            gap: '32px',
            marginBottom: '40px'
          }}
        >
          {/* 第 1 列：品牌定位与平台愿景 */}
          <div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', marginBottom: '14px' }}>
              <span
                className="font-editorial"
                style={{
                  fontSize: '1.2rem',
                  fontWeight: 600,
                  letterSpacing: '-0.3px',
                  color: 'var(--color-text, #111111)'
                }}
              >
                Market Graphic
              </span>
              <span
                style={{
                  fontSize: '0.8rem',
                  color: 'var(--color-muted, #777777)'
                }}
              >
                外贸智友
              </span>
            </div>
            <p
              style={{
                fontSize: '0.84rem',
                lineHeight: 1.65,
                color: 'var(--color-muted, #666666)',
                margin: 0,
                fontWeight: 300
              }}
            >
              俯瞰全球市场结构，AI 驱动的深度出海商业情报与品类准入调研平台。
            </p>
          </div>

          {/* 第 2 列：核心出海研报内链 */}
          <div>
            <h4
              style={{
                fontSize: '0.88rem',
                fontWeight: 600,
                color: 'var(--color-text, #111111)',
                letterSpacing: '0.5px',
                margin: '0 0 14px 0'
              }}
            >
              出海研报中心
            </h4>
            <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '9px' }}>
              <li>
                <Link
                  href="/reports"
                  style={{
                    color: 'var(--color-muted, #555555)',
                    textDecoration: 'none',
                    fontSize: '0.84rem',
                    transition: 'color 0.2s ease',
                    display: 'inline-block'
                  }}
                  onMouseOver={(e) => (e.currentTarget.style.color = 'var(--color-accent, #ff641e)')}
                  onMouseOut={(e) => (e.currentTarget.style.color = 'var(--color-muted, #555555)')}
                >
                  出海商业研报大厅
                </Link>
              </li>
              <li>
                <Link
                  href="/reports"
                  style={{
                    color: 'var(--color-muted, #555555)',
                    textDecoration: 'none',
                    fontSize: '0.84rem',
                    transition: 'color 0.2s ease',
                    display: 'inline-block'
                  }}
                  onMouseOver={(e) => (e.currentTarget.style.color = 'var(--color-accent, #ff641e)')}
                  onMouseOut={(e) => (e.currentTarget.style.color = 'var(--color-muted, #555555)')}
                >
                  买家 360° 供应链穿透洞察
                </Link>
              </li>
              <li>
                <Link
                  href="/reports"
                  style={{
                    color: 'var(--color-muted, #555555)',
                    textDecoration: 'none',
                    fontSize: '0.84rem',
                    transition: 'color 0.2s ease',
                    display: 'inline-block'
                  }}
                  onMouseOver={(e) => (e.currentTarget.style.color = 'var(--color-accent, #ff641e)')}
                  onMouseOut={(e) => (e.currentTarget.style.color = 'var(--color-muted, #555555)')}
                >
                  重点品类准入与标准研报
                </Link>
              </li>
              <li>
                <Link
                  href="/reports"
                  style={{
                    color: 'var(--color-muted, #555555)',
                    textDecoration: 'none',
                    fontSize: '0.84rem',
                    transition: 'color 0.2s ease',
                    display: 'inline-block'
                  }}
                  onMouseOver={(e) => (e.currentTarget.style.color = 'var(--color-accent, #ff641e)')}
                  onMouseOut={(e) => (e.currentTarget.style.color = 'var(--color-muted, #555555)')}
                >
                  欧洲与北美出海调研专题
                </Link>
              </li>
            </ul>
          </div>

          {/* 第 3 列：实时情报与图谱工具 */}
          <div>
            <h4
              style={{
                fontSize: '0.88rem',
                fontWeight: 600,
                color: 'var(--color-text, #111111)',
                letterSpacing: '0.5px',
                margin: '0 0 14px 0'
              }}
            >
              情报与图谱工具
            </h4>
            <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '9px' }}>
              <li>
                <Link
                  href="/news"
                  style={{
                    color: 'var(--color-muted, #555555)',
                    textDecoration: 'none',
                    fontSize: '0.84rem',
                    transition: 'color 0.2s ease',
                    display: 'inline-block'
                  }}
                  onMouseOver={(e) => (e.currentTarget.style.color = 'var(--color-accent, #ff641e)')}
                  onMouseOut={(e) => (e.currentTarget.style.color = 'var(--color-muted, #555555)')}
                >
                  每日外贸行业热点大厅
                </Link>
              </li>
              <li>
                <Link
                  href="/news"
                  style={{
                    color: 'var(--color-muted, #555555)',
                    textDecoration: 'none',
                    fontSize: '0.84rem',
                    transition: 'color 0.2s ease',
                    display: 'inline-block'
                  }}
                  onMouseOver={(e) => (e.currentTarget.style.color = 'var(--color-accent, #ff641e)')}
                  onMouseOut={(e) => (e.currentTarget.style.color = 'var(--color-muted, #555555)')}
                >
                  全球关税与政策预警速递
                </Link>
              </li>
              <li>
                <Link
                  href="/my-graph"
                  style={{
                    color: 'var(--color-muted, #555555)',
                    textDecoration: 'none',
                    fontSize: '0.84rem',
                    transition: 'color 0.2s ease',
                    display: 'inline-block'
                  }}
                  onMouseOver={(e) => (e.currentTarget.style.color = 'var(--color-accent, #ff641e)')}
                  onMouseOut={(e) => (e.currentTarget.style.color = 'var(--color-muted, #555555)')}
                >
                  个人知识图谱工作台
                </Link>
              </li>
              <li>
                <Link
                  href="/"
                  style={{
                    color: 'var(--color-muted, #555555)',
                    textDecoration: 'none',
                    fontSize: '0.84rem',
                    transition: 'color 0.2s ease',
                    display: 'inline-block'
                  }}
                  onMouseOver={(e) => (e.currentTarget.style.color = 'var(--color-accent, #ff641e)')}
                  onMouseOut={(e) => (e.currentTarget.style.color = 'var(--color-muted, #555555)')}
                >
                  平台首页概览
                </Link>
              </li>
            </ul>
          </div>

          {/* 第 4 列：合规与官方声明 */}
          <div>
            <h4
              style={{
                fontSize: '0.88rem',
                fontWeight: 600,
                color: 'var(--color-text, #111111)',
                letterSpacing: '0.5px',
                margin: '0 0 14px 0'
              }}
            >
              权威背书与合规
            </h4>
            <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '9px' }}>
              <li>
                <a
                  href="https://beian.miit.gov.cn/"
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    color: 'var(--color-accent, #ff641e)',
                    textDecoration: 'none',
                    fontSize: '0.84rem',
                    fontWeight: 500,
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px'
                  }}
                >
                  <span>浙ICP备2026064136号-1</span>
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                    <polyline points="15 3 21 3 21 9" />
                    <line x1="10" y1="14" x2="21" y2="3" />
                  </svg>
                </a>
              </li>
              <li>
                <button
                  onClick={() => openLegalModal('data_compliance')}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    padding: 0,
                    color: 'var(--color-muted, #555555)',
                    fontSize: '0.84rem',
                    cursor: 'pointer',
                    transition: 'color 0.2s ease',
                    textAlign: 'left'
                  }}
                  onMouseOver={(e) => (e.currentTarget.style.color = 'var(--color-accent, #ff641e)')}
                  onMouseOut={(e) => (e.currentTarget.style.color = 'var(--color-muted, #555555)')}
                >
                  数据来源与采编合规声明
                </button>
              </li>
              <li>
                <button
                  onClick={() => openLegalModal('user_agreement')}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    padding: 0,
                    color: 'var(--color-muted, #555555)',
                    fontSize: '0.84rem',
                    cursor: 'pointer',
                    transition: 'color 0.2s ease',
                    textAlign: 'left'
                  }}
                  onMouseOver={(e) => (e.currentTarget.style.color = 'var(--color-accent, #ff641e)')}
                  onMouseOut={(e) => (e.currentTarget.style.color = 'var(--color-muted, #555555)')}
                >
                  用户服务协议与商业免责条款
                </button>
              </li>
            </ul>
          </div>
        </div>

        {/* 底部版权与 ICP 链接底栏 */}
        <div
          style={{
            maxWidth: '1360px',
            margin: '0 auto',
            paddingTop: '20px',
            borderTop: '1px solid rgba(18, 18, 18, 0.06)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '14px',
            fontSize: '0.8rem',
            color: 'var(--color-muted, #777777)'
          }}
        >
          <div>
            <span>© {new Date().getFullYear()} Market Graphic (外贸智友). 保留所有权利。</span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
            <a
              href="https://beian.miit.gov.cn/"
              target="_blank"
              rel="noopener noreferrer"
              style={{
                color: 'inherit',
                textDecoration: 'none',
                transition: 'color 0.2s ease'
              }}
              onMouseOver={(e) => (e.currentTarget.style.color = 'var(--color-accent, #ff641e)')}
              onMouseOut={(e) => (e.currentTarget.style.color = 'inherit')}
            >
              工业和信息化部备案号：浙ICP备2026064136号-1
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
