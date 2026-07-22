import React, { useState, useEffect, useRef } from 'react';
import AdminLayout from '../../components/admin/AdminLayout';
import { detectAndDecodeHtml } from '../../lib/encoding';

interface ReportListItem {
  id: string;
  title: string;
  category: string;
  market_region: string;
  created_at: string;
  industries: string;      // 逗号分隔的行业名称
  industry_ids: string[];  // 关联的行业 ID 数组
  countries: string;       // 逗号分隔的国家名称
  country_ids: string[];   // 关联的国家 ID 数组
}

interface TagOption {
  id: string;
  name: string;
  region?: string;
}

export default function AdminReportsManagement() {
  const [activeTab, setActiveTab] = useState<'list' | 'upload'>('list');
  const [reports, setReports] = useState<ReportListItem[]>([]);
  const [industries, setIndustries] = useState<TagOption[]>([]);
  const [countries, setCountries] = useState<TagOption[]>([]);
  const [loading, setLoading] = useState(true);

  // 上传表单状态
  const [rawHtmlContent, setRawHtmlContent] = useState('');
  const [uploadLoading, setUploadLoading] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [category, setCategory] = useState<'customer' | 'product'>('customer');
  const [summary, setSummary] = useState('');
  const [companyWebsite, setCompanyWebsite] = useState('');
  const [selectedUploadIndustries, setSelectedUploadIndustries] = useState<string[]>([]);
  const [selectedUploadCountries, setSelectedUploadCountries] = useState<string[]>([]);

  // 手动提取元数据列表
  const [manualCompanies, setManualCompanies] = useState<string[]>(['']);
  const [manualCompetitors, setManualCompetitors] = useState<string[]>(['']);
  const [manualProducts, setManualProducts] = useState<string[]>(['']);
  const [manualRegions, setManualRegions] = useState<string[]>(['']);
  const [manualChannels, setManualChannels] = useState<string[]>(['']);
  const [manualSuppliers, setManualSuppliers] = useState<string[]>(['']);
  const [manualCustomers, setManualCustomers] = useState<string[]>(['']);
  const [manualSisters, setManualSisters] = useState<string[]>(['']);

  // 编辑标签模态框状态
  const [editingReport, setEditingReport] = useState<ReportListItem | null>(null);
  const [editingIndustries, setEditingIndustries] = useState<string[]>([]);
  const [editingCountries, setEditingCountries] = useState<string[]>([]);
  const [savingTags, setSavingTags] = useState(false);

  // GC 清理模态框状态
  const [showGcModal, setShowGcModal] = useState(false);
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

  const fileInputRef = useRef<HTMLInputElement>(null);

  // 初始化加载
  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      // 1. 获取报告列表 (包含标签)
      const repRes = await fetch('/api/admin/stats/content');
      if (repRes.ok) {
        const repData = await repRes.json();
        // 对齐数据格式
        const list: ReportListItem[] = repData.reportsList.map((r: any) => {
          return {
            id: r.id,
            title: r.title,
            category: r.category || 'customer',
            market_region: r.market_region || '全球',
            created_at: r.created_at,
            industries: r.industries || '',
            industry_ids: r.industry_ids || [],
            countries: r.countries || '',
            country_ids: r.country_ids || []
          };
        });
        setReports(list);
      }

      // 2. 获取标签选项
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
      console.error('Error fetching admin data:', err);
    } finally {
      setLoading(false);
    }
  };

  // 处理删除报告
  const handleDeleteReport = async (id: string) => {
    if (!confirm('你确定要删除这篇报告吗？该操作不可逆，将同时清除用户解锁记录和关系图谱边！')) return;
    try {
      const res = await fetch('/api/admin/reports/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reportId: id })
      });
      if (res.ok) {
        alert('报告删除成功');
        fetchData();
      } else {
        const data = await res.json();
        alert(data.error || '删除失败');
      }
    } catch (err) {
      alert('网络错误，删除失败');
    }
  };

  // 打开编辑标签模态框
  const openEditTagsModal = async (report: ReportListItem) => {
    setEditingReport(report);
    setSavingTags(true);
    try {
      // 获取当前报告的具体关联 ID
      const res = await fetch(`/api/admin/stats/content`);
      if (res.ok) {
        const data = await res.json();
        // 从 content.ts 获取具体的关联 IDs，也可以在本地计算
        // 为保证最准确，我们直接查询该报告目前在 report_industries 和 report_countries 里的 ID 列表
        // 或者直接根据已有 reports 数组匹配（简化实现）
      }
      
      // 我们从 reports 列表中对应的项获取已有的行业/国家文字，然后在选项中匹配 ID
      const currentReport = reports.find(r => r.id === report.id);
      if (currentReport) {
        // 通过名字匹配 ID
        const curIndNames = currentReport.industries.split(', ').filter(Boolean);
        const curCtyNames = currentReport.countries.split(', ').filter(Boolean);

        const curIndIds = industries.filter(i => curIndNames.includes(i.name)).map(i => i.id);
        const curCtyIds = countries.filter(c => curCtyNames.includes(c.name)).map(c => c.id);

        setEditingIndustries(curIndIds);
        setEditingCountries(curCtyIds);
      }
    } catch (err) {
      console.error('Error opening tags modal:', err);
    } finally {
      setSavingTags(false);
    }
  };

  // 保存标签编辑
  const handleSaveTags = async () => {
    if (!editingReport) return;
    setSavingTags(true);
    try {
      const res = await fetch('/api/admin/reports/update-tags', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reportId: editingReport.id,
          industry_ids: editingIndustries,
          country_ids: editingCountries
        })
      });
      if (res.ok) {
        alert('标签保存成功！');
        setEditingReport(null);
        fetchData();
      } else {
        const data = await res.json();
        alert(data.error || '保存失败');
      }
    } catch (err) {
      alert('保存失败');
    } finally {
      setSavingTags(false);
    }
  };

  // 执行 GC 垃圾回收
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

  // 上传文件解析
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.name.endsWith('.html') && !file.name.endsWith('.htm')) {
      alert('只支持上传 .html 格式的文件');
      return;
    }
    setSelectedFile(file);
    
    const reader = new FileReader();
    reader.onload = (evt) => {
      const buffer = evt.target?.result as ArrayBuffer;
      try {
        const decodedText = detectAndDecodeHtml(buffer);
        setRawHtmlContent(decodedText);

        const parser = new DOMParser();
        const doc = parser.parseFromString(decodedText, 'text/html');

        const cat = doc.querySelector('meta[name="category"]')?.getAttribute('content');
        if (cat === 'customer' || cat === 'product') {
          setCategory(cat);
        }

        const summ = doc.querySelector('meta[name="summary"]')?.getAttribute('content');
        if (summ) {
          setSummary(summ);
        }

        const compName = doc.querySelector('meta[name="company_name"]')?.getAttribute('content');
        const compWebsite = doc.querySelector('meta[name="company_website"]')?.getAttribute('content');
        const compAliases = doc.querySelector('meta[name="company_aliases"]')?.getAttribute('content');

        if (compName) {
          const aliasArr = compAliases ? compAliases.split(',').map(s => s.trim()).filter(Boolean) : [];
          setManualCompanies([compName, ...aliasArr]);
        }
        if (compWebsite) {
          setCompanyWebsite(compWebsite);
        }

        const competitors = doc.querySelector('meta[name="competitors"]')?.getAttribute('content');
        if (competitors) {
          setManualCompetitors(competitors.split(',').map(s => s.trim()).filter(Boolean));
        }

        const products = doc.querySelector('meta[name="products"]')?.getAttribute('content');
        if (products) {
          setManualProducts(products.split(',').map(s => s.trim()).filter(Boolean));
        }

        const regions = doc.querySelector('meta[name="regions"]')?.getAttribute('content');
        if (regions) {
          setManualRegions(regions.split(',').map(s => s.trim()).filter(Boolean));
        }

        const channels = doc.querySelector('meta[name="channels"]')?.getAttribute('content');
        if (channels) {
          setManualChannels(channels.split(',').map(s => s.trim()).filter(Boolean));
        }

        const suppliers = doc.querySelector('meta[name="suppliers"]')?.getAttribute('content');
        if (suppliers) {
          setManualSuppliers(suppliers.split(',').map(s => s.trim()).filter(Boolean));
        }

        const customers = doc.querySelector('meta[name="customers"]')?.getAttribute('content');
        if (customers) {
          setManualCustomers(customers.split(',').map(s => s.trim()).filter(Boolean));
        }

        const sisters = doc.querySelector('meta[name="sister_parents"]')?.getAttribute('content');
        if (sisters) {
          setManualSisters(sisters.split(',').map(s => s.trim()).filter(Boolean));
        }
      } catch (err) {
        alert('解析文件出错');
      }
    };
    reader.readAsArrayBuffer(file);
  };

  const renderTagListInput = (
    title: string,
    tags: string[],
    setTags: React.Dispatch<React.SetStateAction<string[]>>,
    placeholder: string
  ) => {
    const handleAdd = () => setTags([...tags, '']);
    const handleRemove = (index: number) => {
      const newTags = tags.filter((_, i) => i !== index);
      setTags(newTags.length === 0 ? [''] : newTags);
    };
    const handleChange = (index: number, val: string) => {
      const newTags = [...tags];
      newTags[index] = val;
      setTags(newTags);
    };

    return (
      <div className="admin-form-group" style={{
        background: 'rgba(255,255,255,0.01)',
        border: '1px solid var(--admin-border)',
        borderRadius: '6px',
        padding: '12px',
        display: 'flex',
        flexDirection: 'column',
        gap: '6px'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <label className="admin-label" style={{ marginBottom: 0, fontSize: '0.8rem' }}>{title}</label>
          <button
            type="button"
            onClick={handleAdd}
            style={{
              background: 'var(--admin-accent)',
              color: '#ffffff',
              border: 'none',
              borderRadius: '50%',
              width: '18px',
              height: '18px',
              fontSize: '0.75rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer'
            }}
          >
            +
          </button>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', maxHeight: '100px', overflowY: 'auto' }}>
          {tags.map((tag, idx) => (
            <div key={idx} style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
              <input
                type="text"
                value={tag}
                placeholder={placeholder}
                onChange={(e) => handleChange(idx, e.target.value)}
                className="admin-input"
                style={{
                  padding: '4px 8px',
                  fontSize: '0.75rem',
                }}
              />
              {tags.length > 1 && (
                <button
                  type="button"
                  onClick={() => handleRemove(idx)}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: 'var(--admin-error)',
                    fontSize: '0.9rem',
                    cursor: 'pointer',
                    padding: '0'
                  }}
                >
                  ✕
                </button>
              )}
            </div>
          ))}
        </div>
      </div>
    );
  };

  // 提交上传
  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!rawHtmlContent) {
      alert('请先选择并解析 HTML 报告文件');
      return;
    }

    setUploadLoading(true);
    try {
      const res = await fetch('/api/admin/reports/upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          rawHtml: rawHtmlContent,
          category,
          summary,
          industry_ids: selectedUploadIndustries,
          country_ids: selectedUploadCountries,
          manualTags: {
            companies: manualCompanies.filter(Boolean),
            competitors: manualCompetitors.filter(Boolean),
            products: manualProducts.filter(Boolean),
            regions: manualRegions.filter(Boolean),
            channels: manualChannels.filter(Boolean),
            suppliers: manualSuppliers.filter(Boolean),
            customers: manualCustomers.filter(Boolean),
            sisters: manualSisters.filter(Boolean),
            companyWebsite
          }
        })
      });

      if (res.ok) {
        alert('🎉 报告上传成功并提取实体成功！');
        // 重置上传表单
        setSelectedFile(null);
        setRawHtmlContent('');
        setSummary('');
        setCompanyWebsite('');
        setSelectedUploadIndustries([]);
        setSelectedUploadCountries([]);
        setManualCompanies(['']);
        setManualCompetitors(['']);
        setManualProducts(['']);
        setManualRegions(['']);
        setManualChannels(['']);
        setManualSuppliers(['']);
        setManualCustomers(['']);
        setManualSisters(['']);
        setActiveTab('list');
        fetchData();
      } else {
        const data = await res.json();
        alert(data.error || '上传失败');
      }
    } catch (err) {
      alert('网络错误，上传失败');
    } finally {
      setUploadLoading(false);
    }
  };

  const handleToggleUploadIndustry = (id: string) => {
    setSelectedUploadIndustries(prev => 
      prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
    );
  };

  const handleToggleUploadCountry = (id: string) => {
    setSelectedUploadCountries(prev => 
      prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
    );
  };

  return (
    <AdminLayout currentPage="reports">
      <div className="admin-body">
        <div className="admin-topbar">
          <h1 className="admin-page-title">📤 报告管理</h1>
          
          <div style={{ display: 'flex', gap: '10px' }}>
            <button 
              className={`admin-btn ${activeTab === 'list' ? '' : 'admin-btn-secondary'}`}
              onClick={() => setActiveTab('list')}
            >
              📋 报告列表
            </button>
            <button 
              className={`admin-btn ${activeTab === 'upload' ? '' : 'admin-btn-secondary'}`}
              onClick={() => setActiveTab('upload')}
            >
              📥 上传脱水 HTML
            </button>
            <button
              className="admin-btn admin-btn-secondary"
              onClick={() => setShowGcModal(true)}
              style={{ background: 'rgba(239, 68, 68, 0.1)', borderColor: 'rgba(239, 68, 68, 0.3)', color: '#f87171' }}
            >
              🧹 存储清理 (GC)
            </button>
          </div>
        </div>

        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '60vh', color: 'var(--admin-text-secondary)' }}>
            正在加载报告列表及配置...
          </div>
        ) : activeTab === 'list' ? (
          /* 报告列表 */
          <div className="admin-card">
            <h3 className="admin-card-title">当前报告库列表 ({reports.length} 篇)</h3>
            <div className="admin-table-container">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>报告标题</th>
                    <th>报告类别</th>
                    <th>关联行业</th>
                    <th>覆盖国家</th>
                    <th>上传日期</th>
                    <th style={{ textAlign: 'right' }}>操作</th>
                  </tr>
                </thead>
                <tbody>
                  {reports.map(rep => {
                    const dateStr = new Date(rep.created_at).toLocaleDateString('zh-CN');
                    return (
                      <tr key={rep.id}>
                        <td style={{ fontWeight: '500' }}>
                          <a href={`/reports/${rep.id}`} target="_blank" rel="noreferrer" style={{ color: 'var(--admin-text)', textDecoration: 'none' }}>
                            {rep.title}
                          </a>
                        </td>
                        <td>
                          <span className={`admin-badge ${rep.category === 'customer' ? 'admin-badge-success' : 'admin-badge-info'}`}>
                            {rep.category === 'customer' ? '客户研报' : '品类分析'}
                          </span>
                        </td>
                        <td>
                          {rep.industries ? (
                            rep.industries.split(', ').map((ind, i) => (
                              <span key={i} className="admin-badge admin-badge-info" style={{ marginRight: '4px', marginBottom: '4px' }}>
                                {ind}
                              </span>
                            ))
                          ) : (
                            <span style={{ color: 'var(--admin-text-secondary)' }}>未打行业标签</span>
                          )}
                        </td>
                        <td>
                          {rep.countries ? (
                            rep.countries.split(', ').map((cty, i) => (
                              <span key={i} className="admin-badge admin-badge-warning" style={{ marginRight: '4px', marginBottom: '4px' }}>
                                {cty}
                              </span>
                            ))
                          ) : (
                            <span style={{ color: 'var(--admin-text-secondary)' }}>未关联国家</span>
                          )}
                        </td>
                        <td>{dateStr}</td>
                        <td style={{ textAlign: 'right' }}>
                          <button 
                            className="admin-btn admin-btn-secondary" 
                            style={{ padding: '4px 10px', fontSize: '0.75rem', marginRight: '6px' }}
                            onClick={() => openEditTagsModal(rep)}
                          >
                            🏷️ 编辑标签
                          </button>
                          <button 
                            className="admin-btn admin-btn-danger" 
                            style={{ padding: '4px 10px', fontSize: '0.75rem' }}
                            onClick={() => handleDeleteReport(rep.id)}
                          >
                            🗑️ 删除
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          /* 上传新报告 */
          <form onSubmit={handleUpload} className="admin-card">
            <h3 className="admin-card-title">📥 解析并上传新的 HTML 报告文件</h3>
            
            <div className="admin-form-group">
              <label className="admin-label">选择报告 HTML 文件</label>
              <input 
                type="file" 
                ref={fileInputRef}
                accept=".html,.htm" 
                onChange={handleFileChange}
                className="admin-input"
                style={{ padding: '8px' }}
              />
              {selectedFile && <div style={{ fontSize: '0.8rem', color: 'var(--admin-success)', marginTop: '6px' }}>已选择: {selectedFile.name}</div>}
            </div>

            {rawHtmlContent && (
              <>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '20px' }}>
                  {/* 核心分类 & 简介 */}
                  <div>
                    <div className="admin-form-group">
                      <label className="admin-label">报告分类</label>
                      <select 
                        value={category} 
                        onChange={(e) => setCategory(e.target.value as any)} 
                        className="admin-select"
                      >
                        <option value="customer">客户研报 (Customer Insight)</option>
                        <option value="product">品类研报 (Product Category Analysis)</option>
                      </select>
                    </div>
                    
                    <div className="admin-form-group">
                      <label className="admin-label">报告简介 (Summary)</label>
                      <textarea 
                        rows={4}
                        value={summary}
                        onChange={(e) => setSummary(e.target.value)}
                        className="admin-textarea"
                        placeholder="请输入报告简介..."
                      />
                    </div>

                    <div className="admin-form-group">
                      <label className="admin-label">公司官网 (Website)</label>
                      <input 
                        type="text"
                        value={companyWebsite}
                        onChange={(e) => setCompanyWebsite(e.target.value)}
                        className="admin-input"
                        placeholder="例如: https://example.com"
                      />
                    </div>
                  </div>

                  {/* 标签配置区域 */}
                  <div>
                    <div className="admin-form-group">
                      <label className="admin-label">关联行业 (可多选)</label>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', maxHeight: '180px', overflowY: 'auto', background: 'rgba(255,255,255,0.02)', padding: '10px', border: '1px solid var(--admin-border)', borderRadius: '6px' }}>
                        {industries.map(ind => (
                          <label key={ind.id} style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.8rem', cursor: 'pointer' }}>
                            <input 
                              type="checkbox" 
                              checked={selectedUploadIndustries.includes(ind.id)}
                              onChange={() => handleToggleUploadIndustry(ind.id)}
                            />
                            {ind.name}
                          </label>
                        ))}
                      </div>
                    </div>

                    <div className="admin-form-group">
                      <label className="admin-label">覆盖国家 (可多选)</label>
                      <div style={{ maxHeight: '180px', overflowY: 'auto', background: 'rgba(255,255,255,0.02)', padding: '10px', border: '1px solid var(--admin-border)', borderRadius: '6px' }}>
                        {['亚洲', '欧洲', '北美洲', '南美洲', '大洋洲', '非洲'].map(region => {
                          const list = countries.filter(c => c.region === region);
                          if (list.length === 0) return null;
                          return (
                            <div key={region} style={{ marginBottom: '8px' }}>
                              <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--admin-accent-light)', marginBottom: '4px', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '2px' }}>
                                {region}
                              </div>
                              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px', paddingLeft: '4px', marginBottom: '8px' }}>
                                {list.map(cty => (
                                  <label key={cty.id} style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.75rem', cursor: 'pointer', color: 'var(--admin-text)' }}>
                                    <input 
                                      type="checkbox" 
                                      checked={selectedUploadCountries.includes(cty.id)}
                                      onChange={() => handleToggleUploadCountry(cty.id)}
                                    />
                                    {cty.name}
                                  </label>
                                ))}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                </div>

                {/* 提取的图谱关联实体词 */}
                <h4 style={{ fontSize: '0.9rem', color: 'var(--admin-accent-light)', marginBottom: '12px', marginTop: '20px', borderBottom: '1px solid var(--admin-border)', paddingBottom: '6px' }}>
                  🔍 提取的图谱关联实体 (对应市场图谱关联线，自动解析自 HTML Meta)
                </h4>
                
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', marginBottom: '24px' }}>
                  {renderTagListInput('公司名称 (Company)', manualCompanies, setManualCompanies, '例如: 特斯拉, 丰田汽车')}
                  {renderTagListInput('竞争对手 (Competitor)', manualCompetitors, setManualCompetitors, '例如: 宜家, OBI')}
                  {renderTagListInput('产品名称 (Product)', manualProducts, setManualProducts, '例如: 锂电池, 刹车片')}
                  {renderTagListInput('市场地区 (Region)', manualRegions, setManualRegions, '例如: 北美, 德国')}
                  {renderTagListInput('销售渠道 (Channel)', manualChannels, setManualChannels, '例如: 沃尔玛, 麦德龙')}
                  {renderTagListInput('供应商 (Supplier)', manualSuppliers, setManualSuppliers, '例如: 某某代工厂')}
                  {renderTagListInput('核心客户 (Customer)', manualCustomers, setManualCustomers, '例如: 某某销售商')}
                  {renderTagListInput('姐妹/母公司 (Sister/Parent)', manualSisters, setManualSisters, '例如: 某某集团')}
                </div>

                <button 
                  type="submit" 
                  disabled={uploadLoading}
                  className="admin-btn"
                  style={{ width: '100%' }}
                >
                  {uploadLoading ? '正在分析 HTML 并上传存储中...' : '🚀 确定解析并完成报告发布'}
                </button>
              </>
            )}
          </form>
        )}

        {/* 标签编辑模态框 */}
        {editingReport && (
          <div style={{
            position: 'fixed',
            top: 0,
            left: 0,
            width: '100vw',
            height: '100vh',
            backgroundColor: 'rgba(0,0,0,0.6)',
            backdropFilter: 'blur(5px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000
          }}>
            <div className="admin-card" style={{ width: '480px', border: '1px solid var(--admin-accent)' }}>
              <h3 className="admin-card-title">🏷️ 编辑报告标签</h3>
              <p style={{ fontSize: '0.85rem', color: 'var(--admin-text-secondary)', marginBottom: '16px' }}>
                编辑: <strong>{editingReport.title}</strong>
              </p>

              <div className="admin-form-group">
                <label className="admin-label">关联行业 (多选)</label>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', maxHeight: '180px', overflowY: 'auto', background: 'rgba(255,255,255,0.02)', padding: '10px', border: '1px solid var(--admin-border)', borderRadius: '6px', marginBottom: '16px' }}>
                  {industries.map(ind => (
                    <label key={ind.id} style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.8rem', cursor: 'pointer' }}>
                      <input 
                        type="checkbox" 
                        checked={editingIndustries.includes(ind.id)}
                        onChange={() => setEditingIndustries(prev => 
                          prev.includes(ind.id) ? prev.filter(id => id !== ind.id) : [...prev, ind.id]
                        )}
                      />
                      {ind.name}
                    </label>
                  ))}
                </div>
              </div>

              <div className="admin-form-group">
                <label className="admin-label">覆盖国家 (多选)</label>
                <div style={{ maxHeight: '180px', overflowY: 'auto', background: 'rgba(255,255,255,0.02)', padding: '10px', border: '1px solid var(--admin-border)', borderRadius: '6px', marginBottom: '20px' }}>
                  {['亚洲', '欧洲', '北美洲', '南美洲', '大洋洲', '非洲'].map(region => {
                    const list = countries.filter(c => c.region === region);
                    if (list.length === 0) return null;
                    return (
                      <div key={region} style={{ marginBottom: '8px' }}>
                        <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--admin-accent-light)', marginBottom: '4px', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '2px' }}>
                          {region}
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px', paddingLeft: '4px', marginBottom: '8px' }}>
                          {list.map(cty => (
                            <label key={cty.id} style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.75rem', cursor: 'pointer', color: 'var(--admin-text)' }}>
                              <input 
                                type="checkbox" 
                                checked={editingCountries.includes(cty.id)}
                                onChange={() => setEditingCountries(prev => 
                                  prev.includes(cty.id) ? prev.filter(id => id !== cty.id) : [...prev, cty.id]
                                )}
                              />
                              {cty.name}
                            </label>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                <button 
                  className="admin-btn admin-btn-secondary"
                  onClick={() => setEditingReport(null)}
                >
                  取消
                </button>
                <button 
                  className="admin-btn"
                  onClick={handleSaveTags}
                >
                  保存修改
                </button>
              </div>
            </div>
          </div>
        )}

        {/* GC 存储垃圾回收模态框 */}
        {showGcModal && (
          <div className="admin-modal-backdrop" onClick={() => setShowGcModal(false)}>
            <div className="admin-modal" style={{ maxWidth: '640px' }} onClick={e => e.stopPropagation()}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                <h3 className="admin-card-title" style={{ margin: 0 }}>🧹 Supabase Storage 垃圾回收 (GC)</h3>
                <button 
                  style={{ background: 'none', border: 'none', color: 'var(--admin-text-secondary)', cursor: 'pointer', fontSize: '1.2rem' }}
                  onClick={() => setShowGcModal(false)}
                >
                  ✕
                </button>
              </div>

              <p style={{ fontSize: '0.85rem', color: 'var(--admin-text-secondary)', marginBottom: '20px', lineHeight: 1.6 }}>
                系统将扫描数据库中所有报告、快讯、文章的图片引用，并与 Supabase <code>report-images</code> 存储桶内的文件进行对比，物理删除不再被引用的孤儿图片。
              </p>

              <div style={{ display: 'flex', gap: '12px', marginBottom: '20px' }}>
                <button
                  type="button"
                  className="admin-btn admin-btn-secondary"
                  onClick={() => handleRunGc(true)}
                  disabled={gcLoading}
                  style={{ flex: 1 }}
                >
                  {gcLoading ? '扫描中...' : '🔍 检测孤儿图片 (Dry-Run)'}
                </button>
                <button
                  type="button"
                  className="admin-btn admin-btn-danger"
                  onClick={() => handleRunGc(false)}
                  disabled={gcLoading}
                  style={{ flex: 1 }}
                >
                  {gcLoading ? '清理中...' : '🗑️ 一键物理清理'}
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
                  <div style={{ fontWeight: 'bold', marginBottom: '10px', color: gcResult.dryRun ? '#60a5fa' : '#34d399' }}>
                    {gcResult.dryRun ? '🔍 扫描完成（预览模式）' : '🎉 清理完成！'}
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '10px', marginBottom: '12px' }}>
                    <div style={{ background: 'rgba(255,255,255,0.05)', padding: '10px', borderRadius: '4px', textAlign: 'center' }}>
                      <div style={{ color: 'var(--admin-text-secondary)', fontSize: '0.7rem' }}>Storage 总数</div>
                      <div style={{ fontSize: '1.1rem', fontWeight: 'bold' }}>{gcResult.totalStorage}</div>
                    </div>
                    <div style={{ background: 'rgba(255,255,255,0.05)', padding: '10px', borderRadius: '4px', textAlign: 'center' }}>
                      <div style={{ color: 'var(--admin-text-secondary)', fontSize: '0.7rem' }}>数据库引用</div>
                      <div style={{ fontSize: '1.1rem', fontWeight: 'bold', color: '#60a5fa' }}>{gcResult.referenced}</div>
                    </div>
                    <div style={{ background: 'rgba(255,255,255,0.05)', padding: '10px', borderRadius: '4px', textAlign: 'center' }}>
                      <div style={{ color: 'var(--admin-text-secondary)', fontSize: '0.7rem' }}>孤儿图片</div>
                      <div style={{ fontSize: '1.1rem', fontWeight: 'bold', color: '#f59e0b' }}>{gcResult.orphaned}</div>
                    </div>
                    <div style={{ background: 'rgba(255,255,255,0.05)', padding: '10px', borderRadius: '4px', textAlign: 'center' }}>
                      <div style={{ color: 'var(--admin-text-secondary)', fontSize: '0.7rem' }}>实际删除</div>
                      <div style={{ fontSize: '1.1rem', fontWeight: 'bold', color: '#ef4444' }}>{gcResult.deleted}</div>
                    </div>
                  </div>

                  {gcResult.orphanedFiles && gcResult.orphanedFiles.length > 0 && (
                    <details style={{ marginTop: '8px' }}>
                      <summary style={{ cursor: 'pointer', color: 'var(--admin-text-secondary)', fontSize: '0.8rem' }}>
                        查看孤儿文件名列表 ({gcResult.orphanedFiles.length} 个)
                      </summary>
                      <ul style={{
                        maxHeight: '140px',
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

              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '20px' }}>
                <button
                  className="admin-btn admin-btn-secondary"
                  onClick={() => setShowGcModal(false)}
                >
                  关闭
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
