import React, { useState, useEffect } from 'react';
import { GetServerSideProps } from 'next';
import AdminLayout from '../../components/admin/AdminLayout';
import { getSession } from '../../lib/auth';

interface SettingsProps {
  env: {
    nodeEnv: string;
    hasCos: boolean;
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
                <span>腾讯云 COS 存储服务:</span>
                <span className={`admin-badge ${env.hasCos ? 'admin-badge-success' : 'admin-badge-warning'}`}>
                  {env.hasCos ? '已启用 (腾讯云 COS)' : '本地降级模式 (public/uploads)'}
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

        {/* 对象存储垃圾回收 (COS GC) */}
        <StorageGcCard />
      </div>
    </AdminLayout>
  );
}

function StorageGcCard() {
  const [gcLoading, setGcLoading] = useState(false);
  const [gcResult, setGcResult] = useState<{
    totalStorage: number;
    referenced: number;
    orphaned: number;
    deleted: number;
    dryRun: boolean;
    orphanedFiles?: string[];
    errors?: string[];
  } | null>(null);

  const handleRunGc = async (dryRun: boolean) => {
    if (!dryRun && !confirm('⚠️ 确定要彻底物理删除 Storage 中的所有未引用孤儿图片吗？此操作不可逆！')) {
      return;
    }

    setGcLoading(true);
    try {
      const res = await fetch('/api/admin/reports/gc', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dryRun })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setGcResult(data);
      } else {
        alert(data.error || 'GC 执行失败');
      }
    } catch (err: any) {
      alert('请求失败: ' + err.message);
    } finally {
      setGcLoading(false);
    }
  };

  return (
    <div className="admin-card" style={{ marginTop: '24px' }}>
      <h3 className="admin-card-title">🧹 对象存储垃圾回收 (COS GC)</h3>
      <p style={{ fontSize: '0.85rem', color: 'var(--admin-text-secondary)', marginBottom: '16px' }}>
        物理扫描报告、快讯及文章数据库表中的图片引用，比对 Storage 储存桶 <code>report-images</code> 中的全部文件，找出无引用的孤儿图片并执行同步物理删除。
      </p>

      <div style={{ display: 'flex', gap: '12px', marginBottom: '16px' }}>
        <button
          type="button"
          className="admin-btn admin-btn-secondary"
          onClick={() => handleRunGc(true)}
          disabled={gcLoading}
        >
          {gcLoading ? '扫描中...' : '🔍 检测孤儿图片 (Dry-Run)'}
        </button>
        <button
          type="button"
          className="admin-btn admin-btn-danger"
          onClick={() => handleRunGc(false)}
          disabled={gcLoading}
        >
          {gcLoading ? '清理中...' : '🗑️ 一键物理清理孤儿图片'}
        </button>
      </div>

      {gcResult && (
        <div style={{
          background: 'rgba(0,0,0,0.2)',
          border: '1px solid var(--admin-border)',
          borderRadius: '6px',
          padding: '16px',
          fontSize: '0.85rem'
        }}>
          <div style={{ fontWeight: 'bold', marginBottom: '8px', color: gcResult.dryRun ? '#60a5fa' : '#34d399' }}>
            {gcResult.dryRun ? '🔍 扫描完成（预览模式）' : '🎉 清理完成！'}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px', marginBottom: '12px' }}>
            <div style={{ background: 'rgba(255,255,255,0.05)', padding: '10px', borderRadius: '4px', textAlign: 'center' }}>
              <div style={{ color: 'var(--admin-text-secondary)', fontSize: '0.75rem' }}>Storage 文件总数</div>
              <div style={{ fontSize: '1.2rem', fontWeight: 'bold' }}>{gcResult.totalStorage}</div>
            </div>
            <div style={{ background: 'rgba(255,255,255,0.05)', padding: '10px', borderRadius: '4px', textAlign: 'center' }}>
              <div style={{ color: 'var(--admin-text-secondary)', fontSize: '0.75rem' }}>数据库有效引用</div>
              <div style={{ fontSize: '1.2rem', fontWeight: 'bold', color: '#60a5fa' }}>{gcResult.referenced}</div>
            </div>
            <div style={{ background: 'rgba(255,255,255,0.05)', padding: '10px', borderRadius: '4px', textAlign: 'center' }}>
              <div style={{ color: 'var(--admin-text-secondary)', fontSize: '0.75rem' }}>孤儿图片数量</div>
              <div style={{ fontSize: '1.2rem', fontWeight: 'bold', color: '#f59e0b' }}>{gcResult.orphaned}</div>
            </div>
            <div style={{ background: 'rgba(255,255,255,0.05)', padding: '10px', borderRadius: '4px', textAlign: 'center' }}>
              <div style={{ color: 'var(--admin-text-secondary)', fontSize: '0.75rem' }}>本次实际删除</div>
              <div style={{ fontSize: '1.2rem', fontWeight: 'bold', color: '#ef4444' }}>{gcResult.deleted}</div>
            </div>
          </div>

          {gcResult.orphanedFiles && gcResult.orphanedFiles.length > 0 && (
            <details style={{ marginTop: '8px' }}>
              <summary style={{ cursor: 'pointer', color: 'var(--admin-text-secondary)' }}>
                查看孤儿文件名列表 ({gcResult.orphanedFiles.length} 个)
              </summary>
              <ul style={{
                maxHeight: '150px',
                overflowY: 'auto',
                fontSize: '0.75rem',
                fontFamily: 'monospace',
                marginTop: '8px',
                paddingLeft: '20px'
              }}>
                {gcResult.orphanedFiles.map((file, idx) => (
                  <li key={idx}>{file}</li>
                ))}
              </ul>
            </details>
          )}
        </div>
      )}
    </div>
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
        hasCos: !!(process.env.COS_SECRET_ID && process.env.COS_SECRET_KEY && process.env.COS_BUCKET),
        hasSessionSecret: !!process.env.SESSION_SECRET
      }
    }
  };
};
