import React, { useState, useRef } from 'react';
import { detectAndDecodeHtml } from '../lib/encoding';

interface AdminPanelProps {
  isOpen: boolean;
  onClose: () => void;
  onUploadSuccess: () => void;
}

export default function AdminPanel({ isOpen, onClose, onUploadSuccess }: AdminPanelProps) {
  const [rawHtmlContent, setRawHtmlContent] = useState('');
  const [uploadLoading, setUploadLoading] = useState(false);
  const [manualCompanies, setManualCompanies] = useState<string[]>(['']);
  const [manualCompetitors, setManualCompetitors] = useState<string[]>(['']);
  const [manualProducts, setManualProducts] = useState<string[]>(['']);
  const [manualRegions, setManualRegions] = useState<string[]>(['']);
  const [manualChannels, setManualChannels] = useState<string[]>(['']);
  const [category, setCategory] = useState<'customer' | 'product'>('customer');
  const [summary, setSummary] = useState('');
  const [companyWebsite, setCompanyWebsite] = useState('');

  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isDragActive, setIsDragActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // 防重提示状态
  const [duplicateInfo, setDuplicateInfo] = useState<{
    reportId: string;
    reportTitle: string;
    matchedCanonicalName: string;
    score: number;
  } | null>(null);
  const [showDuplicateModal, setShowDuplicateModal] = useState(false);

  if (!isOpen) return null;

  const handleFileChange = (file: File) => {
    if (!file) return;
    if (!file.name.endsWith('.html') && !file.name.endsWith('.htm')) {
      alert('只支持上传 .html 格式的文件');
      return;
    }
    setSelectedFile(file);
    
    const reader = new FileReader();
    reader.onload = (e) => {
      const buffer = e.target?.result as ArrayBuffer;
      try {
        const decodedText = detectAndDecodeHtml(buffer);
        setRawHtmlContent(decodedText);

        // 自动解析 HTML 元数据
        try {
          const parser = new DOMParser();
          const doc = parser.parseFromString(decodedText, 'text/html');

          // 报告基础信息
          const cat = doc.querySelector('meta[name="category"]')?.getAttribute('content');
          if (cat === 'customer' || cat === 'product') {
            setCategory(cat);
          }

          const summ = doc.querySelector('meta[name="summary"]')?.getAttribute('content');
          if (summ) {
            setSummary(summ);
          }

          // 公司基础信息
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

          // 业务网络关联信息
          const competitors = doc.querySelector('meta[name="competitors"]')?.getAttribute('content');
          if (competitors) {
            const arr = competitors.split(',').map(s => s.trim()).filter(Boolean);
            setManualCompetitors(arr.length > 0 ? arr : ['']);
          }

          const products = doc.querySelector('meta[name="products"]')?.getAttribute('content');
          if (products) {
            const arr = products.split(',').map(s => s.trim()).filter(Boolean);
            setManualProducts(arr.length > 0 ? arr : ['']);
          }

          const regions = doc.querySelector('meta[name="regions"]')?.getAttribute('content');
          if (regions) {
            const arr = regions.split(',').map(s => s.trim()).filter(Boolean);
            setManualRegions(arr.length > 0 ? arr : ['']);
          }

          const channels = doc.querySelector('meta[name="channels"]')?.getAttribute('content');
          if (channels) {
            const arr = channels.split(',').map(s => s.trim()).filter(Boolean);
            setManualChannels(arr.length > 0 ? arr : ['']);
          }
        } catch (domErr) {
          console.error('自动解析报告元数据出错:', domErr);
        }
      } catch (err) {
        alert('读取或解析文件失败，请检查编码格式');
      }
    };
    reader.onerror = () => {
      alert('读取文件出错');
    };
    reader.readAsArrayBuffer(file);
  };

  const handleUploadReport = async (e: React.FormEvent, overwriteId?: string, bypassCheck?: boolean) => {
    if (e) e.preventDefault();
    if (!rawHtmlContent.trim()) return;

    // 前置去重校验：如果不是强制上传并且有填写公司标签，首先查询是否已有该公司的报告
    const primaryCompany = manualCompanies.map(c => c.trim()).filter(Boolean)[0];
    if (!bypassCheck && !overwriteId && primaryCompany) {
      setUploadLoading(true);
      try {
        const checkRes = await fetch('/api/admin/reports/check-duplicate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            companyName: primaryCompany,
            category
          })
        });
        const checkData = await checkRes.json();
        if (checkRes.ok && checkData.duplicateFound) {
          setDuplicateInfo(checkData);
          setShowDuplicateModal(true);
          setUploadLoading(false);
          return; // 中断流程，弹窗等待管理员确认
        }
      } catch (err) {
        console.error('检测重复报告失败:', err);
      }
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
          overwriteReportId: overwriteId !== 'force-new' ? overwriteId : undefined,
          manualTags: {
            companies: manualCompanies.map(c => c.trim()).filter(Boolean),
            companyWebsite: companyWebsite.trim() || undefined,
            competitors: manualCompetitors.map(c => c.trim()).filter(Boolean),
            products: manualProducts.map(p => p.trim()).filter(Boolean),
            regions: manualRegions.map(r => r.trim()).filter(Boolean),
            channels: manualChannels.map(c => c.trim()).filter(Boolean)
          }
        })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        alert(overwriteId && overwriteId !== 'force-new' ? '报告覆盖更新成功！' : '报告上传成功！');
        setRawHtmlContent('');
        setSelectedFile(null);
        setIsDragActive(false);
        setManualCompanies(['']);
        setManualCompetitors(['']);
        setManualProducts(['']);
        setManualRegions(['']);
        setManualChannels(['']);
        setCategory('customer');
        setSummary('');
        setCompanyWebsite('');
        setShowDuplicateModal(false);
        setDuplicateInfo(null);
        onUploadSuccess();
      } else {
        alert(data.error || '上传失败');
      }
    } catch (err) {
      alert('上传报告失败，请检查连接');
    } finally {
      setUploadLoading(false);
    }
  };

  const inputStyle = {
    background: 'rgba(255, 255, 255, 0.65)',
    border: '1px solid rgba(15, 23, 42, 0.08)',
    borderRadius: '12px',
    padding: '12px 16px',
    fontSize: '0.85rem',
    color: '#0f172a',
    outline: 'none',
    width: '100%',
    transition: 'border-color 0.3s ease',
    boxSizing: 'border-box' as const
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
      <div style={{
        background: 'rgba(255, 255, 255, 0.4)',
        border: '1px solid rgba(15, 23, 42, 0.08)',
        borderRadius: '16px',
        padding: '14px',
        display: 'flex',
        flexDirection: 'column',
        gap: '8px'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
          <span style={{ fontSize: '0.85rem', fontWeight: 500, color: '#0f172a' }}>{title}</span>
          <button
            type="button"
            onClick={handleAdd}
            style={{
              background: '#2563eb',
              color: '#ffffff',
              border: 'none',
              borderRadius: '50%',
              width: '20px',
              height: '20px',
              fontSize: '0.9rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              fontWeight: 700,
              boxShadow: '0 2px 6px rgba(37, 99, 235, 0.2)'
            }}
          >
            +
          </button>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '110px', overflowY: 'auto', paddingRight: '4px' }}>
          {tags.map((tag, idx) => (
            <div key={idx} style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
              <input
                type="text"
                value={tag}
                placeholder={placeholder}
                onChange={(e) => handleChange(idx, e.target.value)}
                style={{
                  ...inputStyle,
                  padding: '6px 10px',
                  borderRadius: '8px',
                  fontSize: '0.8rem',
                }}
              />
              {tags.length > 1 && (
                <button
                  type="button"
                  onClick={() => handleRemove(idx)}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: '#ef4444',
                    fontSize: '1rem',
                    cursor: 'pointer',
                    padding: '0 4px',
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

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      background: 'rgba(15, 23, 42, 0.25)',
      backdropFilter: 'blur(16px)',
      WebkitBackdropFilter: 'blur(16px)',
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      zIndex: 1000
    }}>
      <div style={{
        background: 'rgba(255, 255, 255, 0.45)',
        border: '1px solid rgba(255, 255, 255, 0.75)',
        borderRadius: '24px',
        padding: '30px',
        width: '95%',
        maxWidth: '850px',
        maxHeight: '95vh',
        overflowY: 'auto',
        boxShadow: '0 20px 40px rgba(15, 23, 42, 0.08), inset 0 8px 16px rgba(255, 255, 255, 0.55)',
        position: 'relative'
      }}>
        <button 
          onClick={onClose}
          style={{
            position: 'absolute',
            top: '20px',
            right: '20px',
            background: 'none',
            border: 'none',
            fontSize: '1.25rem',
            cursor: 'pointer',
            color: '#64748b'
          }}
        >
          ✕
        </button>
        <h2 style={{ fontSize: '1.5rem', fontWeight: 300, marginBottom: '10px', textAlign: 'center', color: '#0f172a' }}>
          📤 发布外贸数据报告 (Admin)
        </h2>
        <p style={{ fontSize: '0.8rem', color: '#475569', textAlign: 'center', marginBottom: '24px' }}>
          拖拽上传报告的原始 HTML 文件，系统将自动进行脱水处理（自动转码、自动剥离 Base64 图并上传）。
        </p>
        <form onSubmit={handleUploadReport} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div 
            onClick={() => fileInputRef.current?.click()}
            onDragOver={(e) => {
              e.preventDefault();
              setIsDragActive(true);
            }}
            onDragLeave={() => setIsDragActive(false)}
            onDrop={(e) => {
              e.preventDefault();
              setIsDragActive(false);
              if (e.dataTransfer.files && e.dataTransfer.files[0]) {
                handleFileChange(e.dataTransfer.files[0]);
              }
            }}
            style={{
              boxSizing: 'border-box',
              width: '100%',
              height: '240px',
              background: selectedFile 
                ? 'linear-gradient(135deg, rgba(37, 99, 235, 0.03) 0%, rgba(37, 99, 235, 0.08) 100%)' 
                : isDragActive 
                  ? 'linear-gradient(135deg, rgba(37, 99, 235, 0.05) 0%, rgba(37, 99, 235, 0.12) 100%)'
                  : 'rgba(255, 255, 255, 0.65)',
              border: selectedFile 
                ? '2px solid #2563eb' 
                : isDragActive 
                  ? '2px dashed #2563eb' 
                  : '2px dashed rgba(15, 23, 42, 0.15)',
              borderRadius: '20px',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '12px',
              cursor: 'pointer',
              transition: 'all 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
              padding: '20px',
              boxShadow: isDragActive ? '0 12px 30px rgba(37, 99, 235, 0.08)' : 'none',
            }}
          >
            <input 
              type="file" 
              ref={fileInputRef}
              onChange={(e) => {
                if (e.target.files && e.target.files[0]) {
                  handleFileChange(e.target.files[0]);
                }
              }}
              accept=".html,.htm"
              style={{ display: 'none' }}
            />
            {selectedFile ? (
              <>
                <div style={{ fontSize: '3rem' }}>📄</div>
                <div style={{ textAlign: 'center' }}>
                  <p style={{ margin: '0 0 4px 0', fontWeight: 600, fontSize: '0.95rem', color: '#0f172a', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '350px' }}>
                    {selectedFile.name}
                  </p>
                  <p style={{ margin: 0, fontSize: '0.8rem', color: '#64748b' }}>
                    文件大小: {(selectedFile.size / 1024).toFixed(1)} KB
                  </p>
                </div>
                <button 
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedFile(null);
                    setRawHtmlContent('');
                  }}
                  style={{
                    marginTop: '8px',
                    background: 'rgba(239, 68, 68, 0.08)',
                    border: '1px solid rgba(239, 68, 68, 0.2)',
                    color: '#ef4444',
                    borderRadius: '12px',
                    padding: '6px 16px',
                    fontSize: '0.8rem',
                    cursor: 'pointer',
                    fontWeight: 500,
                  }}
                >
                  ✕ 清除重选
                </button>
              </>
            ) : (
              <>
                <div style={{ fontSize: '3rem' }}>☁️</div>
                <div style={{ textAlign: 'center' }}>
                  <p style={{ margin: '0 0 4px 0', fontWeight: 500, color: '#0f172a', fontSize: '0.95rem' }}>
                    将 HTML 报告文件拖到这里
                  </p>
                  <p style={{ margin: 0, fontSize: '0.8rem', color: '#64748b' }}>
                    支持 Drag & Drop，或点击本卡片浏览文件
                  </p>
                </div>
              </>
            )}
          </div>
          
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))',
            gap: '12px',
            marginTop: '4px',
            marginBottom: '8px'
          }}>
            {renderTagListInput('🏢 公司名称 (Company)', manualCompanies, setManualCompanies, '例如: 特斯拉, 丰田汽车')}
            {renderTagListInput('👥 竞争对手 (Competitor)', manualCompetitors, setManualCompetitors, '例如: 宜家, 百安居')}
            {renderTagListInput('📦 产品名称 (Product)', manualProducts, setManualProducts, '例如: 锂电池, 刹车片')}
            {renderTagListInput('🌍 市场地区 (Region)', manualRegions, setManualRegions, '例如: 北美, 欧盟')}
            {renderTagListInput('🤝 渠道类型 (Channel)', manualChannels, setManualChannels, '例如: 一级供应链')}
          </div>
          
          <div style={{ display: 'flex', gap: '20px', alignItems: 'center', marginTop: '12px' }}>
            <span style={{ fontSize: '0.85rem', fontWeight: 500, color: '#0f172a' }}>📊 报告类型：</span>
            <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.85rem', cursor: 'pointer', color: '#475569' }}>
              <input 
                type="radio" 
                name="category" 
                value="customer" 
                checked={category === 'customer'} 
                onChange={() => setCategory('customer')} 
              />
              🏢 公司调查报告 (Company)
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.85rem', cursor: 'pointer', color: '#475569' }}>
              <input 
                type="radio" 
                name="category" 
                value="product" 
                checked={category === 'product'} 
                onChange={() => setCategory('product')} 
              />
              📈 品类调查报告 (Product)
            </label>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginTop: '12px' }}>
            <span style={{ fontSize: '0.85rem', fontWeight: 500, color: '#0f172a' }}>🔗 公司官网 (Website)：</span>
            <input
              type="text"
              placeholder="例如: https://brauberg.com (自动从报告中提取，可手动修改)"
              value={companyWebsite}
              onChange={(e) => setCompanyWebsite(e.target.value)}
              style={inputStyle}
            />
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginTop: '12px', marginBottom: '12px' }}>
            <span style={{ fontSize: '0.85rem', fontWeight: 500, color: '#0f172a' }}>📄 报告简介 (Summary)：</span>
            <textarea
              placeholder="请输入报告的简要介绍（手动填写的简介将显示在报告大厅卡片上，留空则自动从报告中提取）"
              value={summary}
              onChange={(e) => setSummary(e.target.value)}
              rows={3}
              style={{
                ...inputStyle,
                resize: 'vertical',
                minHeight: '85px',
                fontFamily: 'inherit'
              }}
            />
          </div>

          <button 
            type="submit" 
            className="water-drop-btn"
            disabled={uploadLoading || !rawHtmlContent}
            style={{ padding: '12px', fontSize: '0.95rem', fontWeight: 500, width: '100%' }}
          >
            {uploadLoading ? '⏳ 正在处理并上传报告...' : '🚀 立即发布报告'}
          </button>
        </form>
      </div>

      {/* 重复报告与别名判定 Modal 弹窗 */}
      {showDuplicateModal && duplicateInfo && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(15, 23, 42, 0.4)',
          backdropFilter: 'blur(8px)',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          zIndex: 2000
        }}>
          <div style={{
            background: '#ffffff',
            borderRadius: '20px',
            padding: '28px',
            width: '90%',
            maxWidth: '500px',
            boxShadow: '0 20px 40px rgba(15, 23, 42, 0.15)',
            border: '1px solid rgba(15, 23, 42, 0.08)',
            display: 'flex',
            flexDirection: 'column',
            gap: '16px'
          }}>
            <h3 style={{ margin: 0, fontSize: '1.15rem', color: '#0f172a', fontWeight: 600 }}>
              ⚠️ 检测到关联企业已存在报告
            </h3>
            <p style={{ margin: 0, fontSize: '0.85rem', color: '#475569', lineHeight: 1.6 }}>
              系统分析发现相似企业 <strong>{duplicateInfo.matchedCanonicalName}</strong> 且已发布报告<strong>《{duplicateInfo.reportTitle}》</strong>（相似度: {(duplicateInfo.score * 100).toFixed(0)}%）。
              为了维持图谱“一企一报”的规整结构，请做出您的选择：
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <button
                type="button"
                onClick={() => handleUploadReport(null as any, duplicateInfo.reportId)}
                className="water-drop-btn"
                style={{
                  padding: '12px 14px',
                  fontSize: '0.85rem',
                  fontWeight: 600,
                  background: '#2563eb',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: '10px',
                  cursor: 'pointer',
                  textAlign: 'center'
                }}
              >
                🔄 选项 A：覆盖更新已有报告 (并绑定别名)
              </button>
              <button
                type="button"
                onClick={() => handleUploadReport(null as any, 'force-new', true)}
                style={{
                  padding: '12px 14px',
                  fontSize: '0.85rem',
                  fontWeight: 500,
                  background: 'rgba(15, 23, 42, 0.04)',
                  color: '#0f172a',
                  border: '1px solid rgba(15, 23, 42, 0.08)',
                  borderRadius: '10px',
                  cursor: 'pointer',
                  textAlign: 'center'
                }}
              >
                ➕ 选项 B：仍保存为全新独立报告
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowDuplicateModal(false);
                  setDuplicateInfo(null);
                }}
                style={{
                  padding: '12px 14px',
                  fontSize: '0.85rem',
                  fontWeight: 500,
                  background: '#ffffff',
                  color: '#64748b',
                  border: '1px solid rgba(15, 23, 42, 0.08)',
                  borderRadius: '10px',
                  cursor: 'pointer',
                  textAlign: 'center'
                }}
              >
                ❌ 选项 C：取消上传并关闭
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
