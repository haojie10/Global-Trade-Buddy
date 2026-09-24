import React from 'react';

interface PromotionalBannerProps {
  onClaim: () => void;
  onViewTiers?: () => void;
  userId?: string | null;
}

export default function PromotionalBanner({ onClaim, onViewTiers, userId }: PromotionalBannerProps) {
  const handleViewTiers = () => {
    if (onViewTiers) {
      onViewTiers();
    } else {
      const el = document.getElementById('membership-tiers');
      if (el) {
        el.scrollIntoView({ behavior: 'smooth' });
      }
    }
  };

  return (
    <div style={{
      width: '100%',
      background: 'linear-gradient(90deg, rgba(255, 100, 30, 0.15) 0%, rgba(16, 185, 129, 0.15) 100%)',
      borderBottom: '1px solid rgba(255, 100, 30, 0.25)',
      backdropFilter: 'blur(10px)',
      WebkitBackdropFilter: 'blur(10px)',
      padding: '10px 16px',
      color: 'var(--color-text)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontSize: '0.92rem',
      position: 'relative',
      zIndex: 90
    }}>
      <div style={{
        maxWidth: '1200px',
        width: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '12px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          <span style={{
            background: 'linear-gradient(135deg, #ff641e, #ff8c42)',
            color: '#fff',
            fontSize: '0.75rem',
            fontWeight: 700,
            padding: '2px 8px',
            borderRadius: '4px',
            textTransform: 'uppercase'
          }}>
            限时推广特权
          </span>
          <span style={{ fontWeight: 500 }}>
            🎉 新用户注册即领 <b style={{ color: 'var(--color-accent)' }}>10 份深度研报在线解锁</b> + <b style={{ color: '#10b981' }}>5 份 HTML 完整报告离线下载</b>！每邀请 1 位好友双方再得 <b style={{ color: 'var(--color-accent)' }}>+3 次</b>
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <button
            onClick={handleViewTiers}
            style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--color-text-secondary, #94a3b8)',
              fontSize: '0.88rem',
              cursor: 'pointer',
              textDecoration: 'underline',
              padding: '4px 6px'
            }}
          >
            查看权益对比
          </button>
          {!userId && (
            <button
              onClick={onClaim}
              style={{
                background: 'linear-gradient(135deg, #ff641e, #ea580c)',
                color: '#ffffff',
                border: 'none',
                borderRadius: '8px',
                padding: '6px 14px',
                fontSize: '0.85rem',
                fontWeight: 600,
                cursor: 'pointer',
                boxShadow: '0 2px 8px rgba(255, 100, 30, 0.35)',
                transition: 'transform 0.15s ease'
              }}
              onMouseOver={(e) => (e.currentTarget.style.transform = 'scale(1.03)')}
              onMouseOut={(e) => (e.currentTarget.style.transform = 'scale(1)')}
            >
              免费领福利 →
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
