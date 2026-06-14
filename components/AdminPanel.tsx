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
  const [manualProducts, setManualProducts] = useState<string[]>(['']);
  const [manualRegions, setManualRegions] = useState<string[]>(['']);
  const [manualChannels, setManualChannels] = useState<string[]>(['']);

  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isDragActive, setIsDragActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

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
      } catch (err) {
        alert('读取或解析文件失败，请检查编码格式');
      }
    };
    reader.onerror = () => {
      alert('读取文件出错');
    };
    reader.readAsArrayBuffer(file);
  };

  const handleUploadReport = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!rawHtmlContent.trim()) return;
    setUploadLoading(true);
    try {
      const res = await fetch('/api/admin/reports/upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          rawHtml: rawHtmlContent,
          manualTags: {
            companies: manualCompanies.map(c => c.trim()).filter(Boolean),
            products: manualProducts.map(p => p.trim()).filter(Boolean),
            regions: manualRegions.map(r => r.trim()).filter(Boolean),
            channels: manualChannels.map(c => c.trim()).filter(Boolean)
          }
        })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        alert('报告上传成功！');
        setRawHtmlContent('');
        setSelectedFile(null);
        setIsDragActive(false);
        setManualCompanies(['']);
        setManualProducts(['']);
        setManualRegions(['']);
        setManualChannels(['']);
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
            {renderTagListInput('📦 产品名称 (Product)', manualProducts, setManualProducts, '例如: 锂电池, 刹车片')}
            {renderTagListInput('🌍 市场地区 (Region)', manualRegions, setManualRegions, '例如: 北美, 欧盟')}
            {renderTagListInput('🤝 渠道类型 (Channel)', manualChannels, setManualChannels, '例如: 一级供应链')}
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
    </div>
  );
}
