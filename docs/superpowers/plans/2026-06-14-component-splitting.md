# 巨型前端页面/组件拆分 实现计划

> **面向 AI 代理的工作者：** 必需子技能：使用 superpowers:subagent-driven-development（推荐）或 superpowers:executing-plans 逐任务实现此计划。步骤使用复选框（`- [ ]`）语法来跟踪进度。

**目标：** 优化前端架构，将 pages/index.tsx 和 pages/my-graph.tsx 两个巨型页面拆分成独立高内聚组件 AdminPanel、ReportList、NodeProfilePanel，并使用 TDD 模式与类型检查确保修改不破坏已有功能。

**架构：** 
- 将 `pages/index.tsx` 中的管理员上传报告 Modal 移至 `components/AdminPanel.tsx`，保持自包含状态。
- 将 `pages/index.tsx` 中的报告大厅与过滤逻辑提取至 `components/ReportList.tsx`，由其维护过滤状态，并导出独立的 `filterReports` 纯函数用于 TDD 验证。
- 将 `pages/my-graph.tsx` 的右侧详情面板 Profile Tab 抽取至 `components/NodeProfilePanel.tsx`，合并实体别名、竞争对手/合作伙伴管理和报告标记逻辑。

**技术栈：** Next.js, React, TypeScript, Vitest

---

### 任务 1：创建报告过滤逻辑单元测试 (TDD 准备)

**文件：**
- 创建：`tests/report-filter.test.ts`

- [ ] **步骤 1：编写失败的测试**

在 `tests/report-filter.test.ts` 中编写对即将导出的 `filterReports` 纯函数的测试用例，覆盖关键字匹配、分类过滤和地区过滤。

```typescript
import { describe, it, expect } from 'vitest';
import { filterReports, PlatformReport } from '../components/ReportList';

describe('Report Filter Helper Logic', () => {
  const mockReports: PlatformReport[] = [
    { id: '1', title: '美国汽配报告', category: 'customer', market_region: '北美', summary: 'A公司采购详情', isUnlocked: true },
    { id: '2', title: '德国刹车片行业分析', category: 'product', market_region: '欧盟', summary: '德国工业分析', isUnlocked: false },
    { id: '3', title: '全球大豆市场', category: 'product', market_region: '全球', summary: '全球大豆分析', isUnlocked: true }
  ];

  it('should filter by search query on title or summary', () => {
    const result = filterReports(mockReports, '汽配', 'All', 'All');
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('1');
  });

  it('should filter by category', () => {
    const result = filterReports(mockReports, '', 'customer', 'All');
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('1');
  });

  it('should filter by region including "全球"', () => {
    const result = filterReports(mockReports, '', 'All', '北美');
    // 应该匹配 1 (北美) 和 3 (全球)
    expect(result.map(r => r.id)).toEqual(expect.arrayContaining(['1', '3']));
  });
});
```

- [ ] **步骤 2：运行测试验证失败**

运行：`npm run test tests/report-filter.test.ts`
预期：FAIL，报错 "filterReports is not a function" 或找不到 `../components/ReportList` 模块。

---

### 任务 2：创建 ReportList 组件并实现过滤逻辑

**文件：**
- 创建：`components/ReportList.tsx`
- 修改：`tests/report-filter.test.ts`

- [ ] **步骤 1：编写最少实现代码**

创建 `components/ReportList.tsx` 并实现 `filterReports` 导出函数，使其通过步骤 1 的测试。同时实现 `ReportList` 组件的完整 JSX 骨架与过滤、解锁行为。

```typescript
import React, { useState } from 'react';
import Link from 'next/link';

export interface PlatformReport {
  id: string;
  title: string;
  category: string;
  market_region: string;
  summary: string;
  isUnlocked: boolean;
}

export function filterReports(
  reports: PlatformReport[],
  searchQuery: string,
  category: string,
  region: string
): PlatformReport[] {
  const query = searchQuery.trim().toLowerCase();
  return reports.filter(r => {
    const matchQuery = !query || r.title.toLowerCase().includes(query) || r.summary.toLowerCase().includes(query);
    const matchCat = category === 'All' || r.category === category;
    const matchRegion = region === 'All' || r.market_region === region || r.market_region === '全球';
    return matchQuery && matchCat && matchRegion;
  });
}

interface ReportListProps {
  reports: PlatformReport[];
  userId: string;
  userRole: string;
  quota: number;
  onUnlockSuccess: (newQuota: number, unlockedReportId: string) => void;
}

export default function ReportList({ reports, userId, userRole, quota, onUnlockSuccess }: ReportListProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [selectedRegion, setSelectedRegion] = useState('All');

  const filtered = filterReports(reports, searchQuery, selectedCategory, selectedRegion);
  const regions = ['All', ...Array.from(new Set(reports.map(r => r.market_region).filter(Boolean)))];

  const handleUnlock = async (e: React.MouseEvent, reportId: string) => {
    e.preventDefault();
    if (!userId) {
      alert('请先登录后再解锁！');
      return;
    }
    try {
      const res = await fetch('/api/user/unlock-action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, reportId }),
      });
      const data = await res.json();
      if (data.success) {
        alert('解锁成功！');
        onUnlockSuccess(quota - 1, reportId);
      } else {
        alert(data.error || '解锁失败，请充值额度');
      }
    } catch (err) {
      alert('连接支付网关失败');
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
    transition: 'border-color 0.3s ease',
  };

  return (
    <div>
      {/* 筛选栏 */}
      <div style={{
        display: 'flex',
        gap: '16px',
        marginBottom: '40px',
        alignItems: 'center',
        flexWrap: 'wrap',
        background: 'rgba(255, 255, 255, 0.45)',
        backdropFilter: 'blur(16px)',
        padding: '16px 24px',
        borderRadius: '20px',
        border: '1px solid rgba(15, 23, 42, 0.08)',
        boxShadow: '0 4px 20px rgba(15, 23, 42, 0.02)'
      }}>
        <input
          type="text"
          placeholder="🔍 搜索报告标题或摘要内容..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          style={{ ...inputStyle, flex: 1, minWidth: '240px' }}
        />
        
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <span style={{ fontSize: '0.85rem', color: '#475569', fontWeight: 500 }}>类别</span>
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            style={{ ...inputStyle, padding: '8px 12px', cursor: 'pointer' }}
          >
            <option value="All">全部类别</option>
            <option value="customer">👥 客户洞察</option>
            <option value="product">📈 品类分析</option>
          </select>
        </div>

        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <span style={{ fontSize: '0.85rem', color: '#475569', fontWeight: 500 }}>市场</span>
          <select
            value={selectedRegion}
            onChange={(e) => setSelectedRegion(e.target.value)}
            style={{ ...inputStyle, padding: '8px 12px', cursor: 'pointer' }}
          >
            {regions.map(r => (
              <option key={r} value={r}>
                {r === 'All' ? '全部地区' : `🎯 ${r}`}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* 列表网格 */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: '24px' }}>
        {filtered.length > 0 ? (
          filtered.map((report) => (
            <Link 
              href={`/reports/${report.id}`} 
              key={report.id} 
              style={{ textDecoration: 'none' }}
            >
              <div style={{
                border: '1px solid rgba(15, 23, 42, 0.08)',
                borderRadius: '24px',
                padding: '28px',
                background: 'rgba(255, 255, 255, 0.75)',
                backdropFilter: 'blur(20px)',
                cursor: 'pointer',
                transition: 'all 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                height: '260px',
                boxShadow: '0 8px 30px rgba(15, 23, 42, 0.03)'
              }}
              onMouseOver={(e) => {
                e.currentTarget.style.borderColor = 'rgba(37, 99, 235, 0.4)';
                e.currentTarget.style.transform = 'translateY(-6px)';
                e.currentTarget.style.boxShadow = '0 20px 40px rgba(37, 99, 235, 0.08)';
                e.currentTarget.style.background = 'rgba(255, 255, 255, 0.95)';
              }}
              onMouseOut={(e) => {
                e.currentTarget.style.borderColor = 'rgba(15, 23, 42, 0.08)';
                e.currentTarget.style.transform = 'none';
                e.currentTarget.style.boxShadow = '0 8px 30px rgba(15, 23, 42, 0.03)';
                e.currentTarget.style.background = 'rgba(255, 255, 255, 0.75)';
              }}
              >
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                    <span style={{
                      fontSize: '0.75rem',
                      fontWeight: 500,
                      color: report.category === 'customer' ? '#2563eb' : '#b45309',
                      background: report.category === 'customer' ? 'rgba(37, 99, 235, 0.06)' : 'rgba(217, 119, 6, 0.06)',
                      padding: '5px 12px',
                      borderRadius: '8px'
                    }}>
                      {report.category === 'customer' ? '👥 客户洞察' : '📈 品类分析'}
                    </span>
                    <span style={{ fontSize: '0.8rem', color: '#475569', fontWeight: 500 }}>
                      🎯 {report.market_region}
                    </span>
                  </div>
                  <h4 style={{
                    margin: '0 0 10px 0',
                    fontSize: '1.05rem',
                    color: '#0f172a',
                    fontWeight: 500,
                    lineHeight: 1.4,
                    display: '-webkit-box',
                    WebkitLineClamp: 2,
                    WebkitBoxOrient: 'vertical',
                    overflow: 'hidden'
                  }}>
                    {report.title}
                  </h4>
                  <p style={{
                    margin: 0,
                    fontSize: '0.85rem',
                    color: '#475569',
                    lineHeight: 1.5,
                    display: '-webkit-box',
                    WebkitLineClamp: 2,
                    WebkitBoxOrient: 'vertical',
                    overflow: 'hidden',
                    fontWeight: 300
                  }}>
                    {report.summary}
                  </p>
                </div>
                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginTop: '16px',
                  borderTop: '1px solid rgba(15, 23, 42, 0.06)',
                  paddingTop: '16px'
                }}>
                  {report.isUnlocked ? (
                    <span style={{
                      fontSize: '0.75rem',
                      fontWeight: 500,
                      padding: '4px 10px',
                      borderRadius: '8px',
                      background: 'rgba(16, 185, 129, 0.08)',
                      color: '#059669'
                    }}>
                      ✅ 已解锁
                    </span>
                  ) : (
                    <button
                      onClick={(e) => handleUnlock(e, report.id)}
                      style={{
                        background: 'rgba(217, 119, 6, 0.08)',
                        border: 'none',
                        color: '#b45309',
                        fontSize: '0.75rem',
                        fontWeight: 500,
                        padding: '4px 10px',
                        borderRadius: '8px',
                        cursor: 'pointer',
                        transition: 'background 0.2s'
                      }}
                      onMouseOver={(e) => e.currentTarget.style.background = 'rgba(217, 119, 6, 0.15)'}
                      onMouseOut={(e) => e.currentTarget.style.background = 'rgba(217, 119, 6, 0.08)'}
                    >
                      🔒 未解锁 (点击解锁)
                    </button>
                  )}
                  <span style={{ fontSize: '0.8rem', color: '#2563eb', fontWeight: 500 }}>
                    立即预览与解锁 →
                  </span>
                </div>
              </div>
            </Link>
          ))
        ) : (
          <div style={{ gridColumn: '1 / -1', padding: '80px 40px', textAlign: 'center', color: '#64748b', fontWeight: 300 }}>
            📭 没有符合筛选条件的报告。
          </div>
        )}
      </div>
    </div>
  );
}
```

- [ ] **步骤 2：运行测试验证通过**

运行：`npm run test tests/report-filter.test.ts`
预期：PASS。

- [ ] **步骤 3：Commit**

```bash
git add tests/report-filter.test.ts components/ReportList.tsx
git commit -m "feat: create ReportList component and verify with unit tests (TDD)"
```

---

### 任务 3：创建 AdminPanel.tsx 组件

**文件：**
- 创建：`components/AdminPanel.tsx`

- [ ] **步骤 1：编写最少实现代码**

将 `pages/index.tsx` 中的管理员上传报告弹窗逻辑封装至 `components/AdminPanel.tsx`。

```typescript
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
```

- [ ] **步骤 2：Commit**

```bash
git add components/AdminPanel.tsx
git commit -m "feat: create AdminPanel component for admin report upload modal"
```

---

### 任务 4：重构主页 `pages/index.tsx`

**文件：**
- 修改：`pages/index.tsx`

- [ ] **步骤 1：重构代码**

重构 `pages/index.tsx`，移除冗余的发布和展示逻辑，引入 `AdminPanel` 和 `ReportList`。

```typescript
// 替换 imports
import AdminPanel from '../components/AdminPanel';
import ReportList from '../components/ReportList';

// 初始化 reports state 并接收
const [reports, setReports] = useState(allReports);
```

- [ ] **步骤 2：编译测试并验证**

运行：`npm run test` 和 `npm run build`
预期：全部通过，没有编译报错。

- [ ] **步骤 3：Commit**

```bash
git add pages/index.tsx
git commit -m "refactor: split index.tsx into AdminPanel and ReportList components"
```

---

### 任务 5：创建 NodeProfilePanel.tsx 组件

**文件：**
- 创建：`components/NodeProfilePanel.tsx`

- [ ] **步骤 1：编写最少实现代码**

将 `pages/my-graph.tsx` 右边侧边栏看板逻辑抽出至 `components/NodeProfilePanel.tsx`，由其自身托管表单输入状态和网络 API 请求。

```typescript
import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { GraphNode } from '../lib/graph-helpers';

interface NodeProfilePanelProps {
  selectedNode: GraphNode | null;
  userRole: string;
  entityDetail: any;
  onRefreshGraph: () => Promise<void>;
  onNodeSelectUpdate: (node: any) => void;
  onFetchEntityDetail: (entityId: string) => Promise<void>;
  onDeleteNodeSuccess: () => void;
}

export default function NodeProfilePanel({
  selectedNode,
  userRole,
  entityDetail,
  onRefreshGraph,
  onNodeSelectUpdate,
  onFetchEntityDetail,
  onDeleteNodeSuccess
}: NodeProfilePanelProps) {
  const [newAlias, setNewAlias] = useState('');
  const [newCompetitor, setNewCompetitor] = useState('');
  const [newSupplier, setNewSupplier] = useState('');
  const [marketRegion, setMarketRegion] = useState('');

  const [newReportCompany, setNewReportCompany] = useState('');
  const [newReportProduct, setNewReportProduct] = useState('');
  const [newReportChannel, setNewReportChannel] = useState('');

  // 监听 selectedNode 的变化，清空子组件内部输入状态
  useEffect(() => {
    setNewAlias('');
    setNewCompetitor('');
    setNewSupplier('');
    setMarketRegion('');
    setNewReportCompany('');
    setNewReportProduct('');
    setNewReportChannel('');
  }, [selectedNode]);

  if (!selectedNode) {
    return (
      <div style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '40px 20px',
        textAlign: 'center',
        color: '#64748b'
      }}>
        <span style={{ fontSize: '2.5rem', marginBottom: '16px' }}>💡</span>
        <p style={{ margin: 0, fontSize: '0.85rem', lineHeight: 1.6, color: '#64748b' }}>
          点击图谱中的任意报告节点，即可在此查看该报告的智能商业画像与核心供需实体线索。
        </p>
      </div>
    );
  }

  const handleMergeAlias = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAlias.trim()) return;
    try {
      const res = await fetch('/api/admin/entities/merge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          targetEntityId: selectedNode.id,
          aliasName: newAlias.trim()
        })
      });
      if (res.ok) {
        alert('别名合并成功！');
        setNewAlias('');
        await onFetchEntityDetail(selectedNode.id);
        await onRefreshGraph();
      } else {
        const data = await res.json();
        alert(data.error || '合并失败');
      }
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleAddRelation = async (e: React.FormEvent, relationType: 'competitor' | 'supplier') => {
    e.preventDefault();
    const relatedName = relationType === 'competitor' ? newCompetitor : newSupplier;
    if (!relatedName.trim()) return;

    try {
      const res = await fetch('/api/admin/entities/relation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          entityIdA: selectedNode.id,
          relatedEntityName: relatedName.trim(),
          relationType,
          marketRegion: marketRegion.trim() || null
        })
      });
      if (res.ok) {
        alert('关系添加成功！');
        if (relationType === 'competitor') setNewCompetitor('');
        else setNewSupplier('');
        setMarketRegion('');
        await onFetchEntityDetail(selectedNode.id);
        await onRefreshGraph();
      } else {
        const data = await res.json();
        alert(data.error || '添加关系失败');
      }
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleTagReport = async (e: React.FormEvent, entityType: 'company' | 'product' | 'channel') => {
    e.preventDefault();
    let entityName = '';
    if (entityType === 'company') entityName = newReportCompany;
    else if (entityType === 'product') entityName = newReportProduct;
    else if (entityType === 'channel') entityName = newReportChannel;

    if (!entityName.trim()) return;

    try {
      const res = await fetch('/api/admin/reports/tag', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reportId: selectedNode.id,
          entityName: entityName.trim(),
          entityType
        })
      });

      if (res.ok) {
        alert('关联实体成功！');
        if (entityType === 'company') setNewReportCompany('');
        else if (entityType === 'product') setNewReportProduct('');
        else if (entityType === 'channel') setNewReportChannel('');

        await onRefreshGraph();
        
        // 触发父级状态更新
        const next = { ...selectedNode };
        if (entityType === 'company') {
          next.companies = [...(selectedNode.companies || []), entityName.trim()];
        } else if (entityType === 'product') {
          next.products = [...(selectedNode.products || []), entityName.trim()];
        } else if (entityType === 'channel') {
          next.channels = [...(selectedNode.channels || []), entityName.trim()];
        }
        onNodeSelectUpdate(next);
      } else {
        const data = await res.json();
        alert(data.error || '关联失败');
      }
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleDeleteNode = async () => {
    const isReport = selectedNode.node_type === 'report';
    const confirmMsg = isReport 
      ? `⚠️ 您确定要永久删除报告【${selectedNode.title}】吗？\n删除后该报告的所有解锁数据、笔记、收藏以及关联边线都将随之丢失，此操作不可恢复！`
      : `⚠️ 您确定要永久删除该实体【${selectedNode.title}】吗？\n删除后该实体的别名、关联线、竞争或供应商关系都将一并删除，此操作不可恢复！`;

    if (!window.confirm(confirmMsg)) return;

    try {
      const res = await fetch('/api/admin/delete-node', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: selectedNode.id,
          nodeType: selectedNode.node_type
        })
      });

      if (res.ok) {
        alert('删除成功！');
        onDeleteNodeSuccess();
        await onRefreshGraph();
      } else {
        const data = await res.json();
        alert(data.error || '删除失败');
      }
    } catch (err: any) {
      alert('请求网络失败：' + err.message);
    }
  };

  const isCompany = selectedNode.node_type === 'entity' && selectedNode.entity_type === 'company';

  return (
    <div style={{ flex: 1, padding: '20px', overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>
      {isCompany ? (
        /* 🏢 公司/渠道 商业画像面板 */
        <div style={{
          background: 'rgba(255, 255, 255, 0.65)',
          backdropFilter: 'blur(10px)',
          borderRadius: '20px',
          border: '1px solid rgba(15, 23, 42, 0.06)',
          padding: '24px',
          boxShadow: '0 8px 32px 0 rgba(31, 38, 135, 0.04)',
          display: 'flex',
          flexDirection: 'column',
          gap: '20px'
        }}>
          <div>
            <div style={{ fontSize: '0.75rem', color: '#3b82f6', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>🏢 商业实体画像</div>
            <h4 style={{ margin: '4px 0 0 0', fontSize: '1.25rem', color: '#0f172a', fontWeight: 700 }}>
              {selectedNode.title}
            </h4>
          </div>

          {/* 1. 同义别称 */}
          <div style={{ borderTop: '1px solid rgba(15, 23, 42, 0.06)', paddingTop: '14px' }}>
            <div style={{ fontSize: '0.8rem', color: '#475569', fontWeight: 600, marginBottom: '8px' }}>🏷️ 同义别称 (别名)</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '12px' }}>
              {entityDetail?.aliases && entityDetail.aliases.length > 0 ? (
                entityDetail.aliases.map((a: string, i: number) => (
                  <span key={i} style={{
                    background: 'rgba(148, 163, 184, 0.08)',
                    color: '#64748b',
                    border: '1px solid rgba(148, 163, 184, 0.15)',
                    padding: '4px 10px',
                    borderRadius: '12px',
                    fontSize: '0.75rem',
                    fontWeight: 500
                  }}>
                    {a}
                  </span>
                ))
              ) : (
                <span style={{ fontSize: '0.75rem', color: '#94a3b8', fontStyle: 'italic' }}>暂无其他别名</span>
              )}
            </div>
            <form onSubmit={handleMergeAlias} style={{ display: 'flex', gap: '8px' }}>
              <input
                type="text"
                placeholder="输入新别称，如：儿童世界"
                value={newAlias}
                onChange={(e) => setNewAlias(e.target.value)}
                style={{
                  flex: 1,
                  padding: '6px 12px',
                  fontSize: '0.8rem',
                  border: '1px solid rgba(15, 23, 42, 0.1)',
                  borderRadius: '8px',
                  outline: 'none',
                  background: 'rgba(255,255,255,0.8)'
                }}
              />
              <button type="submit" className="water-drop-btn" style={{ padding: '6px 12px', fontSize: '0.75rem', fontWeight: 600 }}>绑定别名</button>
            </form>
          </div>

          {/* 2. 竞争对手 */}
          <div style={{ borderTop: '1px solid rgba(15, 23, 42, 0.06)', paddingTop: '14px' }}>
            <div style={{ fontSize: '0.8rem', color: '#ef4444', fontWeight: 600, marginBottom: '8px' }}>⚡ 竞争对手关系网</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '12px' }}>
              {entityDetail?.competitors && entityDetail.competitors.length > 0 ? (
                entityDetail.competitors.map((c: any, i: number) => (
                  <span key={i} style={{
                    background: 'rgba(239, 68, 68, 0.06)',
                    color: '#ef4444',
                    border: '1px solid rgba(239, 68, 68, 0.15)',
                    padding: '4px 10px',
                    borderRadius: '12px',
                    fontSize: '0.75rem',
                    fontWeight: 500
                  }}>
                    {c.name} {c.market ? `(${c.market})` : ''}
                  </span>
                ))
              ) : (
                <span style={{ fontSize: '0.75rem', color: '#94a3b8', fontStyle: 'italic' }}>暂无竞争对手记录</span>
              )}
            </div>
            <form onSubmit={(e) => handleAddRelation(e, 'competitor')} style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <div style={{ display: 'flex', gap: '8px' }}>
                <input
                  type="text"
                  placeholder="输入竞争对手，如：Wildberries"
                  value={newCompetitor}
                  onChange={(e) => setNewCompetitor(e.target.value)}
                  style={{
                    flex: 1,
                    padding: '6px 12px',
                    fontSize: '0.8rem',
                    border: '1px solid rgba(15, 23, 42, 0.1)',
                    borderRadius: '8px',
                    outline: 'none',
                    background: 'rgba(255,255,255,0.8)'
                  }}
                />
                <input
                  type="text"
                  placeholder="地区 (可选)"
                  value={marketRegion}
                  onChange={(e) => setMarketRegion(e.target.value)}
                  style={{
                    width: '100px',
                    padding: '6px 12px',
                    fontSize: '0.8rem',
                    border: '1px solid rgba(15, 23, 42, 0.1)',
                    borderRadius: '8px',
                    outline: 'none',
                    background: 'rgba(255,255,255,0.8)'
                  }}
                />
              </div>
              <button type="submit" className="water-drop-btn" style={{ padding: '6px 12px', fontSize: '0.75rem', fontWeight: 600, background: '#ef4444', border: '1px solid #ef4444', color: '#fff', alignSelf: 'flex-end' }}>添加竞争对手</button>
            </form>
          </div>

          {/* 3. 供应商与合作伙伴 */}
          <div style={{ borderTop: '1px solid rgba(15, 23, 42, 0.06)', paddingTop: '14px' }}>
            <div style={{ fontSize: '0.8rem', color: '#2563eb', fontWeight: 600, marginBottom: '8px' }}>🤝 合作商与供应商</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '12px' }}>
              {entityDetail?.suppliers && entityDetail.suppliers.length > 0 ? (
                entityDetail.suppliers.map((s: any, i: number) => (
                  <span key={i} style={{
                    background: 'rgba(37, 99, 235, 0.06)',
                    color: '#2563eb',
                    border: '1px solid rgba(37, 99, 235, 0.15)',
                    padding: '4px 10px',
                    borderRadius: '12px',
                    fontSize: '0.75rem',
                    fontWeight: 500
                  }}>
                    {s.name} {s.market ? `(${s.market})` : ''}
                  </span>
                ))
              ) : (
                <span style={{ fontSize: '0.75rem', color: '#94a3b8', fontStyle: 'italic' }}>暂无合作伙伴记录</span>
              )}
            </div>
            <form onSubmit={(e) => handleAddRelation(e, 'supplier')} style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <div style={{ display: 'flex', gap: '8px' }}>
                <input
                  type="text"
                  placeholder="输入供应商，如：A公司"
                  value={newSupplier}
                  onChange={(e) => setNewSupplier(e.target.value)}
                  style={{
                    flex: 1,
                    padding: '6px 12px',
                    fontSize: '0.8rem',
                    border: '1px solid rgba(15, 23, 42, 0.1)',
                    borderRadius: '8px',
                    outline: 'none',
                    background: 'rgba(255,255,255,0.8)'
                  }}
                />
                <input
                  type="text"
                  placeholder="地区 (可选)"
                  value={marketRegion}
                  onChange={(e) => setMarketRegion(e.target.value)}
                  style={{
                    width: '100px',
                    padding: '6px 12px',
                    fontSize: '0.8rem',
                    border: '1px solid rgba(15, 23, 42, 0.1)',
                    borderRadius: '8px',
                    outline: 'none',
                    background: 'rgba(255,255,255,0.8)'
                  }}
                />
              </div>
              <button type="submit" className="water-drop-btn" style={{ padding: '6px 12px', fontSize: '0.75rem', fontWeight: 600, alignSelf: 'flex-end' }}>添加合作伙伴</button>
            </form>
          </div>

          {/* 管理员专有删除 */}
          {userRole === 'admin' && (
            <div style={{ borderTop: '1px solid rgba(239, 68, 68, 0.1)', paddingTop: '16px', marginTop: '8px', display: 'flex', justifyContent: 'flex-end' }}>
              <button
                onClick={handleDeleteNode}
                style={{
                  background: 'rgba(239, 68, 68, 0.08)',
                  color: '#ef4444',
                  border: '1px solid rgba(239, 68, 68, 0.25)',
                  borderRadius: '20px',
                  padding: '6px 16px',
                  fontSize: '0.8rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  width: '100%'
                }}
              >
                🗑️ 永久删除此公司实体
              </button>
            </div>
          )}
        </div>
      ) : (
        /* 📄 报告 详情面板 */
        <div style={{
          background: 'rgba(255, 255, 255, 0.65)',
          backdropFilter: 'blur(10px)',
          borderRadius: '20px',
          border: '1px solid rgba(15, 23, 42, 0.06)',
          padding: '24px',
          boxShadow: '0 8px 32px 0 rgba(31, 38, 135, 0.04)',
          display: 'flex',
          flexDirection: 'column',
          gap: '16px'
        }}>
          <div>
            <h4 style={{ margin: '0 0 6px 0', fontSize: '1.1rem', color: '#0f172a', fontWeight: 600, lineHeight: 1.4 }}>
              {selectedNode.title}
            </h4>
            <span style={{ fontSize: '0.8rem', color: '#64748b' }}>报告 ID: {selectedNode.id.substring(0, 8)}...</span>
          </div>

          {/* 国家/市场 */}
          <div>
            <div style={{ fontSize: '0.8rem', color: '#475569', fontWeight: 600, marginBottom: '6px' }}>🌍 所涉国家/市场</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
              {selectedNode.market_region ? (
                <span style={{
                  background: 'rgba(37, 99, 235, 0.08)',
                  color: '#2563eb',
                  border: '1px solid rgba(37, 99, 235, 0.15)',
                  padding: '4px 10px',
                  borderRadius: '12px',
                  fontSize: '0.75rem',
                  fontWeight: 500
                }}>
                  {selectedNode.market_region}
                </span>
              ) : (
                <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>暂无</span>
              )}
            </div>
          </div>

          {/* 经营玩家/品牌 */}
          <div>
            <div style={{ fontSize: '0.8rem', color: '#475569', fontWeight: 600, marginBottom: '6px' }}>🏢 经营玩家/品牌</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '8px' }}>
              {selectedNode.companies && selectedNode.companies.length > 0 ? (
                selectedNode.companies.map((c, i) => (
                  <span key={i} style={{
                    background: 'rgba(16, 185, 129, 0.08)',
                    color: '#10b981',
                    border: '1px solid rgba(16, 185, 129, 0.15)',
                    padding: '4px 10px',
                    borderRadius: '12px',
                    fontSize: '0.75rem',
                    fontWeight: 500
                  }}>
                    {c}
                  </span>
                ))
              ) : (
                <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>暂无</span>
              )}
            </div>
            <form onSubmit={(e) => handleTagReport(e, 'company')} style={{ display: 'flex', gap: '8px' }}>
              <input
                type="text"
                placeholder="关联新品牌，如：Wildberries"
                value={newReportCompany}
                onChange={(e) => setNewReportCompany(e.target.value)}
                style={{
                  flex: 1,
                  padding: '6px 12px',
                  fontSize: '0.8rem',
                  border: '1px solid rgba(15, 23, 42, 0.1)',
                  borderRadius: '8px',
                  outline: 'none',
                  background: 'rgba(255,255,255,0.8)'
                }}
              />
              <button type="submit" className="water-drop-btn" style={{ padding: '6px 12px', fontSize: '0.75rem', fontWeight: 600 }}>关联</button>
            </form>
          </div>

          {/* 涉及品类 */}
          <div>
            <div style={{ fontSize: '0.8rem', color: '#475569', fontWeight: 600, marginBottom: '6px' }}>📦 涉及品类</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '8px' }}>
              {selectedNode.products && selectedNode.products.length > 0 ? (
                selectedNode.products.map((p, i) => (
                  <span key={i} style={{
                    background: 'rgba(249, 115, 22, 0.08)',
                    color: '#ea580c',
                    border: '1px solid rgba(249, 115, 22, 0.15)',
                    padding: '4px 10px',
                    borderRadius: '12px',
                    fontSize: '0.75rem',
                    fontWeight: 500
                  }}>
                    {p}
                  </span>
                ))
              ) : (
                <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>暂无</span>
              )}
            </div>
            <form onSubmit={(e) => handleTagReport(e, 'product')} style={{ display: 'flex', gap: '8px' }}>
              <input
                type="text"
                placeholder="关联新品类，如：刹车片"
                value={newReportProduct}
                onChange={(e) => setNewReportProduct(e.target.value)}
                style={{
                  flex: 1,
                  padding: '6px 12px',
                  fontSize: '0.8rem',
                  border: '1px solid rgba(15, 23, 42, 0.1)',
                  borderRadius: '8px',
                  outline: 'none',
                  background: 'rgba(255,255,255,0.8)'
                }}
              />
              <button type="submit" className="water-drop-btn" style={{ padding: '6px 12px', fontSize: '0.75rem', fontWeight: 600 }}>关联</button>
            </form>
          </div>

          {/* 覆盖渠道 */}
          <div>
            <div style={{ fontSize: '0.8rem', color: '#475569', fontWeight: 600, marginBottom: '6px' }}>🛣️ 覆盖渠道</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '8px' }}>
              {selectedNode.channels && selectedNode.channels.length > 0 ? (
                selectedNode.channels.map((ch, i) => (
                  <span key={i} style={{
                    background: 'rgba(147, 51, 234, 0.08)',
                    color: '#9333ea',
                    border: '1px solid rgba(147, 51, 234, 0.15)',
                    padding: '4px 10px',
                    borderRadius: '12px',
                    fontSize: '0.75rem',
                    fontWeight: 500
                  }}>
                    {ch}
                  </span>
                ))
              ) : (
                <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>暂无</span>
              )}
            </div>
            <form onSubmit={(e) => handleTagReport(e, 'channel')} style={{ display: 'flex', gap: '8px' }}>
              <input
                type="text"
                placeholder="关联新渠道，如：配件超市"
                value={newReportChannel}
                onChange={(e) => setNewReportChannel(e.target.value)}
                style={{
                  flex: 1,
                  padding: '6px 12px',
                  fontSize: '0.8rem',
                  border: '1px solid rgba(15, 23, 42, 0.1)',
                  borderRadius: '8px',
                  outline: 'none',
                  background: 'rgba(255,255,255,0.8)'
                }}
              />
              <button type="submit" className="water-drop-btn" style={{ padding: '6px 12px', fontSize: '0.75rem', fontWeight: 600 }}>关联</button>
            </form>
          </div>

          {/* 简要概述 */}
          <div style={{ borderTop: '1px solid rgba(15, 23, 42, 0.06)', paddingTop: '12px' }}>
            <div style={{ fontSize: '0.8rem', color: '#475569', fontWeight: 600, marginBottom: '6px' }}>📝 报告概述</div>
            <p style={{
              margin: 0,
              fontSize: '0.85rem',
              color: '#475569',
              lineHeight: 1.6,
              whiteSpace: 'pre-line'
            }}>
              {selectedNode.summary || '暂无概述'}
            </p>
          </div>

          <Link
            href={`/reports/${selectedNode.id}`}
            className="water-drop-btn"
            style={{
              padding: '10px 0',
              fontSize: '0.85rem',
              width: '100%',
              textDecoration: 'none',
              fontWeight: 500,
              marginTop: '8px',
              textAlign: 'center'
            }}
          >
            📖 阅读报告详情
          </Link>

          {/* 管理员专有删除 */}
          {userRole === 'admin' && (
            <div style={{ borderTop: '1px solid rgba(239, 68, 68, 0.1)', paddingTop: '16px', marginTop: '12px' }}>
              <button
                onClick={handleDeleteNode}
                style={{
                  background: 'rgba(239, 68, 68, 0.08)',
                  color: '#ef4444',
                  border: '1px solid rgba(239, 68, 68, 0.25)',
                  borderRadius: '20px',
                  padding: '10px 0',
                  fontSize: '0.85rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  width: '100%'
                }}
              >
                🗑️ 永久删除此报告
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
```

- [ ] **步骤 2：Commit**

```bash
git add components/NodeProfilePanel.tsx
git commit -m "feat: create NodeProfilePanel component for sidebar detail tab"
```

---

### 任务 6：重构拓扑页面 `pages/my-graph.tsx`

**文件：**
- 修改：`pages/my-graph.tsx`

- [ ] **步骤 1：重构代码**

重构 `pages/my-graph.tsx`，引入 `NodeProfilePanel` 并移除冗余的表单和关系处理逻辑。

```typescript
// 替换 imports
import NodeProfilePanel from '../components/NodeProfilePanel';

// 删除 newAlias, newCompetitor, newSupplier 等不需要的状态以及 handleMergeAlias, handleAddRelation 等被组件封装的函数。
// 使用 <NodeProfilePanel> 替换 Profile Tab 内的臃肿 JSX 逻辑。
```

- [ ] **步骤 2：编译测试与验证**

运行：`npm run test` 和 `npm run build`
预期：所有测试全部通过，TypeScript 类型检查无报错，成功构建。

- [ ] **步骤 3：Commit**

```bash
git add pages/my-graph.tsx
git commit -m "refactor: split my-graph.tsx into NodeProfilePanel component"
```
