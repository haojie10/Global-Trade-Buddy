import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import MGLogo from './MGLogo';

interface NavbarProps {
  userId?: string | null;
  userRole?: string;
  quota?: number;
  nickname?: string;
  onShowAuthModal?: () => void;
  onShowUploadModal?: () => void;
  dark?: boolean;
}

export default function Navbar({
  userId,
  userRole,
  quota,
  nickname,
  onShowAuthModal,
  onShowUploadModal,
  dark = false
}: NavbarProps) {
  const [isScrolled, setIsScrolled] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);

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

  const handleLogout = () => {
    document.cookie = 'user_id=; path=/; max-age=0';
    document.cookie = 'user_role=; path=/; max-age=0';
    window.location.reload();
  };

  return (
    <div style={{ 
      position: 'fixed', 
      top: 0, 
      left: 0, 
      right: 0, 
      zIndex: 1000, 
      transition: 'all 0.3s cubic-bezier(0.25, 1, 0.22, 1)',
      background: isScrolled 
        ? (dark ? 'rgba(9, 8, 8, 0.7)' : 'rgba(255, 255, 255, 0.45)') 
        : 'transparent',
      backdropFilter: isScrolled ? 'blur(15px)' : 'none',
      WebkitBackdropFilter: isScrolled ? 'blur(15px)' : 'none',
      borderBottom: isScrolled 
        ? (dark ? '1px solid rgba(255, 255, 255, 0.1)' : '1px solid rgba(18, 18, 18, 0.05)') 
        : 'none',
    }}>
      <header style={{
        background: 'transparent',
        padding: '16px 40px',
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
        {/* 左半部分：LOGO与主菜单链接 */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '36px' }}>
          {/* Logo与名称整体链接：点击回主页 */}
          <Link href="/" style={{ display: 'flex', alignItems: 'center', gap: '10px', textDecoration: 'none' }}>
            <MGLogo height={48} />
          </Link>

          {/* 核心功能主菜单 */}
          <nav style={{ display: 'flex', alignItems: 'center', gap: '24px' }}>
            <Link 
              href="/news" 
              style={{
                textDecoration: 'none',
                color: 'var(--color-text)',
                fontSize: '1rem',
                fontWeight: 400,
                transition: 'color 0.2s'
              }}
              className="nav-menu-item"
            >
              每日资讯
            </Link>
            <Link 
              href="/reports" 
              style={{
                textDecoration: 'none',
                color: 'var(--color-text)',
                fontSize: '1rem',
                fontWeight: 400,
                transition: 'color 0.2s'
              }}
              className="nav-menu-item"
            >
              报告大厅
            </Link>
            <Link 
              href="/my-graph" 
              style={{
                textDecoration: 'none',
                color: 'var(--color-text)',
                fontSize: '1rem',
                fontWeight: 400,
                transition: 'color 0.2s'
              }}
              className="nav-menu-item"
            >
              个人图谱
            </Link>
          </nav>
        </div>

        {/* 右半部分：额度及登录/账号管理（总共最多两个菜单） */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '24px', fontSize: '1rem' }}>
          {userId ? (
            <>
              {/* 菜单 1：额度展示（纯文本，去掉了小锁和剩余） */}
              <span style={{ color: 'var(--color-text)', fontWeight: 400 }}>
                额度: <b style={{ color: 'var(--color-accent)', fontWeight: 500 }}>{quota}</b> 次
              </span>

              {/* 菜单 2：用户昵称下拉菜单 */}
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
            <>
              {/* 未登录状态下的登录下拉菜单 */}
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
            </>
          )}
        </div>
      </header>
      
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
