import React, { useState, useEffect } from 'react';
import { GetServerSideProps } from 'next';
import AdminLayout from '../../components/admin/AdminLayout';
import { getSession } from '../../lib/auth';

interface SettingsProps {
  env: {
    nodeEnv: string;
    supabaseUrl: string | null;
    hasSessionSecret: boolean;
  };
}

export default function AdminSettings({ env }: SettingsProps) {
  const [industries, setIndustries] = useState<Array<{ id: string; name: string }>>([]);
  const [newIndustryName, setNewIndustryName] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchIndustries();
  }, []);

  const fetchIndustries = async () => {
    try {
      const res = await fetch('/api/admin/industries');
      if (res.ok) {
        const data = await res.json();
        setIndustries(data);
      }
    } catch (err) {
      console.error('Error fetching industries:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleAddIndustry = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newIndustryName.trim()) return;

    try {
      const res = await fetch('/api/admin/industries', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newIndustryName })
      });
      if (res.ok) {
        setNewIndustryName('');
        fetchIndustries();
      } else {
        const data = await res.json();
        alert(data.error || '添加行业失败');
      }
    } catch (err) {
      alert('添加失败');
    }
  };

  const handleDeleteIndustry = async (id: string) => {
    if (!confirm('你确定要删除此行业标签吗？删除后现有报告及资讯将失去该关联标签！')) return;
    try {
      const res = await fetch(`/api/admin/industries?id=${id}`, { method: 'DELETE' });
      if (res.ok) {
        fetchIndustries();
      } else {
        const data = await res.json();
        alert(data.error || '删除失败');
      }
    } catch (err) {
      alert('删除失败');
    }
  };

  return (
    <AdminLayout currentPage="settings">
      <div className="admin-body">
        <div className="admin-topbar">
          <h1 className="admin-page-title">⚙️ 系统设置</h1>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
          {/* 标签管理 */}
          <div className="admin-card">
            <h3 className="admin-card-title">🏷️ 行业标签管理</h3>
            
            <form onSubmit={handleAddIndustry} style={{ display: 'flex', gap: '10px', marginBottom: '16px' }}>
              <input 
                type="text" 
                value={newIndustryName}
                onChange={(e) => setNewIndustryName(e.target.value)}
                placeholder="新增行业名称，如：医疗器械"
                className="admin-input"
                style={{ flex: 1 }}
              />
              <button type="submit" className="admin-btn">添加</button>
            </form>

            {loading ? (
              <div style={{ color: 'var(--admin-text-secondary)', fontSize: '0.85rem' }}>正在加载标签...</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '300px', overflowY: 'auto' }}>
                {industries.map(ind => (
                  <div key={ind.id} className="admin-list-item" style={{ padding: '6px 0' }}>
                    <span style={{ fontSize: '0.85rem' }}>{ind.name}</span>
                    <button 
                      className="admin-btn admin-btn-danger" 
                      style={{ padding: '2px 8px', fontSize: '0.7rem' }}
                      onClick={() => handleDeleteIndustry(ind.id)}
                    >
                      删除
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* 系统环境状态 */}
          <div className="admin-card">
            <h3 className="admin-card-title">🖥️ 系统环境状态</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', fontSize: '0.85rem' }}>
              <div className="admin-list-item">
                <span>运行环境:</span>
                <span className="admin-badge admin-badge-info" style={{ textTransform: 'uppercase' }}>
                  {env.nodeEnv}
                </span>
              </div>
              <div className="admin-list-item">
                <span>Supabase 存储服务:</span>
                <span className={`admin-badge ${env.supabaseUrl ? 'admin-badge-success' : 'admin-badge-warning'}`}>
                  {env.supabaseUrl ? '已启用 (Supabase)' : '本地降级模式 (public/uploads)'}
                </span>
              </div>
              <div className="admin-list-item">
                <span>会话安全秘钥 (SESSION_SECRET):</span>
                <span className={`admin-badge ${env.hasSessionSecret ? 'admin-badge-success' : 'admin-badge-error'}`}>
                  {env.hasSessionSecret ? '正常' : '未设置 (不安全)'}
                </span>
              </div>
              
              <div style={{
                background: 'rgba(255,255,255,0.02)',
                border: '1px solid var(--admin-border)',
                padding: '16px',
                borderRadius: '6px',
                color: 'var(--admin-text-secondary)',
                lineHeight: 1.6,
                marginTop: '10px'
              }}>
                ℹ️ <strong>关于管理后台:</strong><br />
                Global Trade Buddy 后台专为创始人做内容决策而设计。通过前端自动埋点捕捉用户的浏览量、停留时长和搜索日志，帮助您洞悉用户的出海关注焦点，并指导未来报告与快讯的新增与倾斜策略。
              </div>
            </div>
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}

export const getServerSideProps: GetServerSideProps = async (context) => {
  const session = getSession(context.req as any);
  if (!session || session.role !== 'admin') {
    return {
      redirect: {
        destination: '/',
        permanent: false,
      },
    };
  }

  return {
    props: {
      env: {
        nodeEnv: process.env.NODE_ENV || 'development',
        supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL || null,
        hasSessionSecret: !!process.env.SESSION_SECRET
      }
    }
  };
};
