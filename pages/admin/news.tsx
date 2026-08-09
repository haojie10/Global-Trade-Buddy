import React, { useState, useEffect } from 'react';
import AdminLayout from '../../components/admin/AdminLayout';

interface NewsItem {
  id: string;
  title: string;
  summary: string;
  content: string;
  source_url: string;
  status: 'draft' | 'published';
  published_at: string | null;
  created_at: string;
  industries: string;      // 逗号分隔
  countries: string;       // 逗号分隔
}

interface TagOption {
  id: string;
  name: string;
  region?: string;
}

export default function AdminNewsManagement() {
  const [activeTab, setActiveTab] = useState<'list' | 'editor'>('list');
  const [news, setNews] = useState<NewsItem[]>([]);
  const [industries, setIndustries] = useState<TagOption[]>([]);
  const [countries, setCountries] = useState<TagOption[]>([]);
  const [loading, setLoading] = useState(true);

  // 编辑器状态
  const [editId, setEditId] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [summary, setSummary] = useState('');
  const [content, setContent] = useState('');
  const [sourceUrl, setSourceUrl] = useState('');
  const [status, setStatus] = useState<'draft' | 'published'>('draft');
  const [selectedIndustries, setSelectedIndustries] = useState<string[]>([]);
  const [selectedCountries, setSelectedCountries] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const newsRes = await fetch('/api/admin/news');
      if (newsRes.ok) {
        const newsData = await newsRes.json();
        setNews(newsData);
      }

      const indRes = await fetch('/api/admin/industries');
      if (indRes.ok) {
        const indData = await indRes.json();
        setIndustries(indData);
      }

      const ctyRes = await fetch('/api/admin/countries');
      if (ctyRes.ok) {
        const ctyData = await ctyRes.json();
        setCountries(ctyData);
      }
    } catch (err) {
      console.error('Error fetching news:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateNew = () => {
    setEditId(null);
    setTitle('');
    setSummary('');
    setContent('');
    setSourceUrl('');
    setStatus('draft');
    setSelectedIndustries([]);
    setSelectedCountries([]);
    setActiveTab('editor');
  };

  const handleEdit = (item: NewsItem) => {
    setEditId(item.id);
    setTitle(item.title);
    setSummary(item.summary || '');
    setContent(item.content || '');
    setSourceUrl(item.source_url || '');
    setStatus(item.status);

    // 解析文字映射回 ID 数组
    const curIndNames = item.industries.split(', ').filter(Boolean);
    const curCtyNames = item.countries.split(', ').filter(Boolean);

    const curIndIds = industries.filter(i => curIndNames.includes(i.name)).map(i => i.id);
    const curCtyIds = countries.filter(c => curCtyNames.includes(c.name)).map(c => c.id);

    setSelectedIndustries(curIndIds);
    setSelectedCountries(curCtyIds);
    setActiveTab('editor');
  };

  const handleDelete = async (id: string) => {
    if (!confirm('你确认要删除这条资讯吗？删除后将不可恢复！')) return;
    try {
      const res = await fetch(`/api/admin/news?id=${id}`, { method: 'DELETE' });
      if (res.ok) {
        alert('资讯已删除');
        fetchData();
      } else {
        const data = await res.json();
        alert(data.error || '删除失败');
      }
    } catch (err) {
      alert('网络错误，删除失败');
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      alert('请填写资讯标题');
      return;
    }

    setSaving(true);
    const payload = {
      id: editId,
      title,
      summary,
      content,
      source_url: sourceUrl,
      status,
      industry_ids: selectedIndustries,
      country_ids: selectedCountries
    };

    try {
      const method = editId ? 'PUT' : 'POST';
      const res = await fetch('/api/admin/news', {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        alert('🎉 资讯保存成功！');
        setActiveTab('list');
        fetchData();
      } else {
        const data = await res.json();
        alert(data.error || '保存失败');
      }
    } catch (err) {
      alert('网络错误，保存失败');
    } finally {
      setSaving(false);
    }
  };

  const handleToggleIndustry = (id: string) => {
    setSelectedIndustries(prev => 
      prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
    );
  };

  const handleToggleCountry = (id: string) => {
    setSelectedCountries(prev => 
      prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
    );
  };

  return (
    <AdminLayout currentPage="news">
      <div className="admin-body">
        <div className="admin-topbar">
          <h1 className="admin-page-title">📰 资讯管理</h1>
          
          <div style={{ display: 'flex', gap: '10px' }}>
            <button 
              className={`admin-btn ${activeTab === 'list' ? '' : 'admin-btn-secondary'}`}
              onClick={() => setActiveTab('list')}
            >
              📋 资讯列表
            </button>
            <button 
              className={`admin-btn ${activeTab === 'editor' ? '' : 'admin-btn-secondary'}`}
              onClick={handleCreateNew}
            >
              ＋ 发布快讯
            </button>
          </div>
        </div>

        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '60vh', color: 'var(--admin-text-secondary)' }}>
            正在加载资讯库数据...
          </div>
        ) : activeTab === 'list' ? (
          /* 资讯列表 */
          <div className="admin-card">
            <h3 className="admin-card-title">当前快讯列表 ({news.length} 条)</h3>
            <div className="admin-table-container">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>资讯标题</th>
                    <th>状态</th>
                    <th>相关行业</th>
                    <th>关联国家</th>
                    <th>发布时间</th>
                    <th style={{ textAlign: 'right' }}>操作</th>
                  </tr>
                </thead>
                <tbody>
                  {news.map(item => {
                    const dateStr = item.published_at 
                      ? new Date(item.published_at).toLocaleDateString('zh-CN') + ' ' + new Date(item.published_at).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })
                      : new Date(item.created_at).toLocaleDateString('zh-CN') + ' (未发布)';
                    
                    return (
                      <tr key={item.id}>
                        <td style={{ fontWeight: '500' }}>
                          <span style={{ fontSize: '0.85rem', color: 'var(--admin-text)' }}>{item.title}</span>
                          {item.source_url && (
                            <div style={{ fontSize: '0.75rem', color: 'var(--admin-text-secondary)' }}>
                              来源: <a href={item.source_url} target="_blank" rel="noreferrer" style={{ color: 'var(--admin-accent-light)' }}>查看原文</a>
                            </div>
                          )}
                        </td>
                        <td>
                          <span className={`admin-badge ${item.status === 'published' ? 'admin-badge-success' : 'admin-badge-warning'}`}>
                            {item.status === 'published' ? '已发布' : '草稿'}
                          </span>
                        </td>
                        <td>
                          {item.industries ? (
                            item.industries.split(', ').map((ind, i) => (
                              <span key={i} className="admin-badge admin-badge-info" style={{ marginRight: '4px', marginBottom: '4px' }}>
                                {ind}
                              </span>
                            ))
                          ) : (
                            <span style={{ color: 'var(--admin-text-secondary)' }}>-</span>
                          )}
                        </td>
                        <td>
                          {item.countries ? (
                            item.countries.split(', ').map((cty, i) => (
                              <span key={i} className="admin-badge admin-badge-warning" style={{ marginRight: '4px', marginBottom: '4px' }}>
                                {cty}
                              </span>
                            ))
                          ) : (
                            <span style={{ color: 'var(--admin-text-secondary)' }}>-</span>
                          )}
                        </td>
                        <td>{dateStr}</td>
                        <td style={{ textAlign: 'right' }}>
                          <button 
                            className="admin-btn admin-btn-secondary" 
                            style={{ padding: '4px 10px', fontSize: '0.75rem', marginRight: '6px' }}
                            onClick={() => handleEdit(item)}
                          >
                            ✍️ 编辑
                          </button>
                          <button 
                            className="admin-btn admin-btn-danger" 
                            style={{ padding: '4px 10px', fontSize: '0.75rem' }}
                            onClick={() => handleDelete(item.id)}
                          >
                            🗑️ 删除
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                  {news.length === 0 && (
                    <tr>
                      <td colSpan={6} style={{ textAlign: 'center', color: 'var(--admin-text-secondary)', padding: '40px 0' }}>
                        暂无资讯快讯，点击右上角发布一条吧！
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          /* 发布/编辑表单 */
          <form onSubmit={handleSave} className="admin-card">
            <h3 className="admin-card-title">{editId ? '✍️ 编辑每日快讯' : '＋ 新增每日快讯'}</h3>
            
            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '24px' }}>
              {/* 正文区域 */}
              <div>
                <div className="admin-form-group">
                  <label className="admin-label">快讯标题</label>
                  <input 
                    type="text" 
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="请输入简短有吸引力的快讯标题"
                    className="admin-input"
                    required
                  />
                </div>

                <div className="admin-form-group">
                  <label className="admin-label">快讯摘要 (列表展示, 选填)</label>
                  <input 
                    type="text" 
                    value={summary}
                    onChange={(e) => setSummary(e.target.value)}
                    placeholder="一段简短的摘要介绍..."
                    className="admin-input"
                  />
                </div>

                <div className="admin-form-group">
                  <label className="admin-label">资讯原文链接 (链接跳转, 选填)</label>
                  <input 
                    type="url" 
                    value={sourceUrl}
                    onChange={(e) => setSourceUrl(e.target.value)}
                    placeholder="https://..."
                    className="admin-input"
                  />
                </div>

                <div className="admin-form-group">
                  <label className="admin-label">快讯正文 (内容详情, Markdown 格式)</label>
                  <textarea 
                    rows={12}
                    value={content}
                    onChange={(e) => setContent(e.target.value)}
                    placeholder="快讯正文详情描述..."
                    className="admin-textarea"
                    style={{ fontFamily: 'monospace' }}
                  />
                </div>
              </div>

              {/* 标签配置 & 发布状态 */}
              <div>
                <div className="admin-form-group">
                  <label className="admin-label">发布状态</label>
                  <select 
                    value={status} 
                    onChange={(e) => setStatus(e.target.value as any)} 
                    className="admin-select"
                  >
                    <option value="draft">草稿 (仅后台可见)</option>
                    <option value="published">发布 (前台每日资讯展示)</option>
                  </select>
                </div>

                <div className="admin-form-group">
                  <label className="admin-label">相关行业 (多选)</label>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '6px', maxHeight: '150px', overflowY: 'auto', background: 'rgba(255,255,255,0.02)', padding: '10px', border: '1px solid var(--admin-border)', borderRadius: '6px' }}>
                    {industries.map(ind => (
                      <label key={ind.id} style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.8rem', cursor: 'pointer' }}>
                        <input 
                          type="checkbox" 
                          checked={selectedIndustries.includes(ind.id)}
                          onChange={() => handleToggleIndustry(ind.id)}
                        />
                        {ind.name}
                      </label>
                    ))}
                  </div>
                </div>

                <div className="admin-form-group">
                  <label className="admin-label">覆盖国家 (多选)</label>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '6px', maxHeight: '150px', overflowY: 'auto', background: 'rgba(255,255,255,0.02)', padding: '10px', border: '1px solid var(--admin-border)', borderRadius: '6px' }}>
                    {countries.map(cty => (
                      <label key={cty.id} style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.8rem', cursor: 'pointer' }}>
                        <input 
                          type="checkbox" 
                          checked={selectedCountries.includes(cty.id)}
                          onChange={() => handleToggleCountry(cty.id)}
                        />
                        {cty.name} ({cty.region})
                      </label>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '10px', marginTop: '20px' }}>
              <button 
                type="button" 
                className="admin-btn admin-btn-secondary"
                onClick={() => setActiveTab('list')}
              >
                取消
              </button>
              <button 
                type="submit" 
                disabled={saving}
                className="admin-btn"
                style={{ flex: 1 }}
              >
                {saving ? '正在保存中...' : '💾 保存快讯'}
              </button>
            </div>
          </form>
        )}
      </div>
    </AdminLayout>
  );
}
