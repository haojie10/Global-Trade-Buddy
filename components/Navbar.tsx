import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import MGLogo from './MGLogo';
import ChangePasswordModal from './ChangePasswordModal';

interface NavbarProps {
  userId?: string | null;
  userRole?: string;
  quota?: number;
  nickname?: string;
  onShowAuthModal?: () => void;
  onShowUploadModal?: () => void;
  dark?: boolean;
  alwaysTransparent?: boolean;
}

export default function Navbar({
  userId,
  userRole,
  quota,
  nickname,
  onShowAuthModal,
  onShowUploadModal,
  dark = false,
  alwaysTransparent = false
}: NavbarProps) {
  const [isScrolled, setIsScrolled] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [showChangePassword, setShowChangePassword] = useState(false);

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // 监听滚动事件，动态切换背景
  useEffect(() => {
    const handleScroll = () => {
      if (window.scrollY > 10) {
        setIsScrolled(true);
      } else {
        setIsScrolled(false);
      }
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const handleLogout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
    } catch (err) {
      console.error('退出登录失败', err);
    }
    document.cookie = 'user_id=; path=/; max-age=0';
    document.cookie = 'user_role=; path=/; max-age=0';
    document.cookie = 'gtb_session=; path=/; max-age=0';
    window.location.href = '/';
  };

  return (
    <div style={{ 
      position: 'fixed', 
      top: 0, 
      left: 0, 
      right: 0, 
      zIndex: 1000, 
      transition: 'all 0.3s cubic-bezier(0.25, 1, 0.22, 1)',
      background: alwaysTransparent
        ? 'transparent'
        : isScrolled 
          ? (dark ? 'rgba(9, 8, 8, 0.7)' : 'rgba(255, 255, 255, 0.45)') 
          : 'transparent',
      backdropFilter: alwaysTransparent ? 'none' : (isScrolled ? 'blur(15px)' : 'none'),
      WebkitBackdropFilter: alwaysTransparent ? 'none' : (isScrolled ? 'blur(15px)' : 'none'),
      borderBottom: alwaysTransparent
        ? 'none'
        : isScrolled 
          ? (dark ? '1px solid rgba(255, 255, 255, 0.1)' : '1px solid rgba(18, 18, 18, 0.05)') 
          : 'none',
    }}>
      <header style={{
        background: 'transparent',
        padding: isMobile ? '12px 24px' : '16px 40px',
        borderRadius: '0px',
        border: 'none',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        boxShadow: 'none',
        maxWidth: '1400px',
        margin: '0 auto',
        width: '100%'
      }}>
        {/* 左半部分：LOGO与主菜单链接 (PC端) / 仅Logo (移动端) */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '36px' }}>
          <Link href="/" style={{ display: 'flex', alignItems: 'center', gap: '10px', textDecoration: 'none' }}>
            <MGLogo height={isMobile ? 36 : 48} />
          </Link>

          {!isMobile && (
            <nav style={{ display: 'flex', alignItems: 'center', gap: '24px' }}>
              <Link href="/news" style={{ textDecoration: 'none', color: 'var(--color-text)', fontSize: '1rem', fontWeight: 400, transition: 'color 0.2s' }} className="nav-menu-item">每日资讯</Link>
              <Link href="/reports" style={{ textDecoration: 'none', color: 'var(--color-text)', fontSize: '1rem', fontWeight: 400, transition: 'color 0.2s' }} className="nav-menu-item">报告大厅</Link>
              <Link href="/my-graph" style={{ textDecoration: 'none', color: 'var(--color-text)', fontSize: '1rem', fontWeight: 400, transition: 'color 0.2s' }} className="nav-menu-item">个人图谱</Link>
            </nav>
          )}
        </div>

        {/* 右半部分 */}
        {isMobile ? (
          <button 
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--color-text)',
              fontSize: '1.6rem',
              cursor: 'pointer',
              padding: '10px 14px',
              display: 'flex',
              alignItems: 'center',
              outline: 'none',
              marginRight: '6px',
              borderRadius: '8px'
            }}
          >
            {mobileMenuOpen ? '✕' : '☰'}
          </button>
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', gap: '24px', fontSize: '1rem' }}>
            {userId ? (
              <>
                <span style={{ color: 'var(--color-text)', fontWeight: 400 }}>
                  额度: <b style={{ color: 'var(--color-accent)', fontWeight: 500 }}>{quota}</b> 次
                </span>

                <div 
                  style={{ position: 'relative' }}
                  onMouseEnter={() => setShowDropdown(true)}
                  onMouseLeave={() => setShowDropdown(false)}
                >
                  <button 
                    style={{
                      background: 'transparent',
                      border: 'none',
                      color: 'var(--color-text)',
                      fontSize: '1rem',
                      cursor: 'pointer',
                      fontWeight: 400,
                      padding: '8px 0',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px'
                    }}
                  >
                    {nickname || `${userId.substring(0, 8)}...`}
                    <span style={{ fontSize: '0.6rem', opacity: 0.6 }}>▼</span>
                  </button>

                  {showDropdown && (
                    <div style={{
                      position: 'absolute',
                      right: 0,
                      top: '100%',
                      background: dark ? 'rgba(9, 8, 8, 0.95)' : 'rgba(255, 255, 255, 0.95)',
                      backdropFilter: 'blur(20px)',
                      WebkitBackdropFilter: 'blur(20px)',
                      boxShadow: dark ? '0 10px 30px rgba(0,0,0,0.5)' : '0 10px 30px rgba(0,0,0,0.08)',
                      border: dark ? '1px solid rgba(255, 255, 255, 0.1)' : '1px solid rgba(18, 18, 18, 0.05)',
                      padding: '8px 0',
                      width: '140px',
                      display: 'flex',
                      flexDirection: 'column',
                      animation: 'navFadeIn 0.2s ease-out'
                    }}>
                      {userRole === 'admin' && (
                        <Link 
                          href="/admin"
                          style={{
                            textDecoration: 'none',
                            color: 'var(--color-text)',
                            fontSize: '0.95rem',
                            textAlign: 'left',
                            padding: '10px 16px',
                            display: 'block',
                            width: '100%',
                            cursor: 'pointer',
                            transition: 'background 0.2s, color 0.2s',
                            boxSizing: 'border-box'
                          }}
                          onMouseOver={(e) => {
                            e.currentTarget.style.background = 'rgba(255, 100, 30, 0.08)';
                            e.currentTarget.style.color = 'var(--color-accent)';
                          }}
                          onMouseOut={(e) => {
                            e.currentTarget.style.background = 'transparent';
                            e.currentTarget.style.color = 'var(--color-text)';
                          }}
                        >
                          管理后台
                        </Link>
                      )}
                      {userRole === 'admin' && onShowUploadModal && (
                        <button 
                          onClick={onShowUploadModal}
                          style={{
                            background: 'transparent',
                            border: 'none',
                            color: 'var(--color-text)',
                            fontSize: '0.95rem',
                            textAlign: 'left',
                            padding: '10px 16px',
                            width: '100%',
                            cursor: 'pointer',
                            transition: 'background 0.2s, color 0.2s'
                          }}
                          onMouseOver={(e) => {
                            e.currentTarget.style.background = 'rgba(255, 100, 30, 0.08)';
                            e.currentTarget.style.color = 'var(--color-accent)';
                          }}
                          onMouseOut={(e) => {
                            e.currentTarget.style.background = 'transparent';
                            e.currentTarget.style.color = 'var(--color-text)';
                          }}
                        >
                          上传新报告
                        </button>
                      )}
                      <button 
                        onClick={() => { setShowDropdown(false); setShowChangePassword(true); }}
                        style={{
                          background: 'transparent',
                          border: 'none',
                          color: 'var(--color-text)',
                          fontSize: '0.95rem',
                          textAlign: 'left',
                          padding: '10px 16px',
                          width: '100%',
                          cursor: 'pointer',
                          transition: 'background 0.2s, color 0.2s'
                        }}
                        onMouseOver={(e) => {
                          e.currentTarget.style.background = 'rgba(255, 100, 30, 0.08)';
                          e.currentTarget.style.color = 'var(--color-accent)';
                        }}
                        onMouseOut={(e) => {
                          e.currentTarget.style.background = 'transparent';
                          e.currentTarget.style.color = 'var(--color-text)';
                        }}
                      >
                        修改密码
                      </button>
                      <button 
                        onClick={handleLogout}
                        style={{
                          background: 'transparent',
                          border: 'none',
                          color: 'var(--color-text)',
                          fontSize: '0.95rem',
                          textAlign: 'left',
                          padding: '10px 16px',
                          width: '100%',
                          cursor: 'pointer',
                          transition: 'background 0.2s, color 0.2s'
                        }}
                        onMouseOver={(e) => {
                          e.currentTarget.style.background = 'rgba(255, 100, 30, 0.08)';
                          e.currentTarget.style.color = 'var(--color-accent)';
                        }}
                        onMouseOut={(e) => {
                          e.currentTarget.style.background = 'transparent';
                          e.currentTarget.style.color = 'var(--color-text)';
                        }}
                      >
                        退出登录
                      </button>
                    </div>
                  )}
                </div>
              </>
            ) : (
              <div 
                style={{ position: 'relative' }}
                onMouseEnter={() => setShowDropdown(true)}
                onMouseLeave={() => setShowDropdown(false)}
              >
                <button 
                  onClick={onShowAuthModal}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    color: 'var(--color-text)',
                    fontSize: '1rem',
                    cursor: 'pointer',
                    fontWeight: 400,
                    padding: '8px 0',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px'
                  }}
                >
                  登录
                  <span style={{ fontSize: '0.6rem', opacity: 0.6 }}>▼</span>
                </button>

                {showDropdown && (
                  <div style={{
                    position: 'absolute',
                    right: 0,
                    top: '100%',
                    background: dark ? 'rgba(9, 8, 8, 0.95)' : 'rgba(255, 255, 255, 0.95)',
                    backdropFilter: 'blur(20px)',
                    WebkitBackdropFilter: 'blur(20px)',
                    boxShadow: dark ? '0 10px 30px rgba(0,0,0,0.5)' : '0 10px 30px rgba(0,0,0,0.08)',
                    border: dark ? '1px solid rgba(255, 255, 255, 0.1)' : '1px solid rgba(18, 18, 18, 0.05)',
                    padding: '8px 0',
                    width: '120px',
                    display: 'flex',
                    flexDirection: 'column',
                    animation: 'navFadeIn 0.2s ease-out'
                  }}>
                    <button 
                      onClick={onShowAuthModal}
                      style={{
                        background: 'transparent',
                        border: 'none',
                        color: 'var(--color-text)',
                        fontSize: '0.95rem',
                        textAlign: 'left',
                        padding: '10px 16px',
                        width: '100%',
                        cursor: 'pointer',
                        transition: 'background 0.2s, color 0.2s'
                      }}
                      onMouseOver={(e) => {
                        e.currentTarget.style.background = 'rgba(255, 100, 30, 0.08)';
                        e.currentTarget.style.color = 'var(--color-accent)';
                      }}
                      onMouseOut={(e) => {
                        e.currentTarget.style.background = 'transparent';
                        e.currentTarget.style.color = 'var(--color-text)';
                      }}
                    >
                      登录 / 注册
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </header>

      {/* 📱 移动端折叠菜单抽屉 */}
      {isMobile && mobileMenuOpen && (
        <div style={{
          background: dark ? 'rgba(9, 8, 8, 0.98)' : 'rgba(255, 255, 255, 0.98)',
          borderBottom: dark ? '1px solid rgba(255, 255, 255, 0.1)' : '1px solid rgba(18, 18, 18, 0.05)',
          borderRadius: '0 0 var(--border-radius) var(--border-radius)',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          padding: '16px 24px',
          display: 'flex',
          flexDirection: 'column',
          gap: '16px',
          animation: 'navFadeIn 0.25s ease-out',
          boxShadow: '0 15px 30px rgba(0,0,0,0.1)'
        }}>
          <Link href="/news" onClick={() => setMobileMenuOpen(false)} style={{ textDecoration: 'none', color: 'var(--color-text)', fontSize: '1.1rem', fontWeight: 400, padding: '8px 0', display: 'block' }}>
            每日资讯
          </Link>
          <Link href="/reports" onClick={() => setMobileMenuOpen(false)} style={{ textDecoration: 'none', color: 'var(--color-text)', fontSize: '1.1rem', fontWeight: 400, padding: '8px 0', display: 'block' }}>
            报告大厅
          </Link>
          <Link href="/my-graph" onClick={() => setMobileMenuOpen(false)} style={{ textDecoration: 'none', color: 'var(--color-text)', fontSize: '1.1rem', fontWeight: 400, padding: '8px 0', display: 'block' }}>
            个人图谱
          </Link>
          
          <hr style={{ border: 'none', borderTop: dark ? '1px solid rgba(255,255,255,0.1)' : '1px solid rgba(18,18,18,0.05)', margin: '8px 0' }} />
          
          {userId ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ color: 'var(--color-text)', fontSize: '1.1rem' }}>
                额度: <b style={{ color: 'var(--color-accent)' }}>{quota}</b> 次
              </div>
              <div style={{ color: 'var(--color-text)', fontSize: '1.1rem', fontWeight: 500 }}>
                昵称: {nickname || userId.substring(0, 8)}
              </div>
              {userRole === 'admin' && (
                <Link href="/admin" onClick={() => setMobileMenuOpen(false)} style={{ textDecoration: 'none', color: 'var(--color-accent)', fontSize: '1.1rem', fontWeight: 400, padding: '8px 0', display: 'block' }}>
                  管理后台
                </Link>
              )}
              {userRole === 'admin' && onShowUploadModal && (
                <button 
                  onClick={() => { setMobileMenuOpen(false); onShowUploadModal(); }}
                  style={{ background: 'transparent', border: 'none', color: 'var(--color-text)', fontSize: '1.1rem', fontWeight: 400, padding: '8px 0', width: '100%', textAlign: 'left', cursor: 'pointer' }}
                >
                  上传新报告
                </button>
              )}
              <button 
                onClick={() => { setMobileMenuOpen(false); setShowChangePassword(true); }}
                style={{ background: 'transparent', border: 'none', color: 'var(--color-text)', fontSize: '1.1rem', fontWeight: 400, padding: '8px 0', width: '100%', textAlign: 'left', cursor: 'pointer' }}
              >
                修改密码
              </button>
              <button 
                onClick={() => { setMobileMenuOpen(false); handleLogout(); }}
                style={{ background: 'transparent', border: 'none', color: '#ef4444', fontSize: '1.1rem', fontWeight: 400, padding: '8px 0', width: '100%', textAlign: 'left', cursor: 'pointer' }}
              >
                退出登录
              </button>
            </div>
          ) : (
            <button 
              onClick={() => { setMobileMenuOpen(false); onShowAuthModal?.(); }}
              style={{
                background: 'var(--color-accent)',
                color: '#ffffff',
                border: 'none',
                padding: '12px',
                borderRadius: 'var(--border-radius)',
                cursor: 'pointer',
                fontWeight: 500,
                textAlign: 'center',
                fontSize: '1rem',
                width: '100%'
              }}
            >
              登录 / 注册
            </button>
          )}
        </div>
      )}
      <ChangePasswordModal 
        isOpen={showChangePassword}
        onClose={() => setShowChangePassword(false)}
      />

      {/* 注入淡入动画关键帧 */}
      <style jsx global>{`
        @keyframes navFadeIn {
          from { opacity: 0; transform: translateY(6px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .nav-menu-item:hover {
          color: var(--color-accent) !important;
        }
      `}</style>
    </div>
  );
}
