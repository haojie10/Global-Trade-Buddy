import React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';

interface AdminLayoutProps {
  children: React.ReactNode;
  currentPage: string;
}

export default function AdminLayout({ children, currentPage }: AdminLayoutProps) {
  const router = useRouter();

  const handleLogout = async () => {
    try {
      const res = await fetch('/api/auth/logout', { method: 'POST' });
      if (res.ok) {
        router.push('/');
      } else {
        alert('退出登录失败');
      }
    } catch (err) {
      console.error('Logout error:', err);
    }
  };

  const navItems = [
    { name: '📊 数据总览', id: 'overview', path: '/admin' },
    { name: '📋 内容分析', id: 'content', path: '/admin/content' },
    { name: '👥 用户分析', id: 'users', path: '/admin/users' },
    { name: '🔥 趋势洞察', id: 'trends', path: '/admin/trends' },
    { name: '📤 报告管理', id: 'reports', path: '/admin/reports' },
    { name: '📰 资讯管理', id: 'news', path: '/admin/news' },
    { name: '🔗 邀请转化', id: 'referrals', path: '/admin/referrals' },
  ];

  return (
    <div className="admin-layout">
      {/* 侧边栏 */}
      <aside className="admin-sidebar">
        <div className="admin-sidebar-logo">
          <span>🌐</span> GTB Admin
        </div>
        
        <nav className="admin-sidebar-nav">
          {navItems.map((item) => (
            <Link key={item.id} href={item.path} style={{ textDecoration: 'none' }}>
              <div className={`admin-sidebar-item ${currentPage === item.id ? 'active' : ''}`}>
                {item.name}
              </div>
            </Link>
          ))}
          
          <div className="admin-sidebar-divider"></div>
          
          <Link href="/admin/settings" style={{ textDecoration: 'none' }}>
            <div className={`admin-sidebar-item ${currentPage === 'settings' ? 'active' : ''}`}>
              ⚙️ 设置
            </div>
          </Link>

          <Link href="/" style={{ textDecoration: 'none', marginTop: 'auto' }}>
            <div className="admin-sidebar-item">
              🏠 回到前台
            </div>
          </Link>
          
          <div 
            className="admin-sidebar-item" 
            onClick={handleLogout}
            style={{ color: 'var(--admin-error)' }}
          >
            🚪 退出登录
          </div>
        </nav>
      </aside>

      {/* 主体区 */}
      <main className="admin-main">
        {children}
      </main>
    </div>
  );
}
