import React, { useState, useEffect, useRef } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import AdminLayout from '../../../components/admin/AdminLayout';

interface MatchedReport {
  id: string;
  title: string;
  category: string;
  market_region: string;
}

interface CrmContactDetail {
  id: number;
  email: string;
  company_name: string;
  clean_company_name: string | null;
  website: string | null;
  website_domain: string | null;
  email_domain: string | null;
  contact_name: string | null;
  job_title: string | null;
  phone: string | null;
  fax: string | null;
  address: string | null;
  zip_code: string | null;
  country: string | null;
  industry: string | null;
  products: string | null;
  verify_status: string;
  last_verified_at: string | null;
  verify_provider: string | null;
  gender: string | null;
  birthday: string | null;
  department: string | null;
  social_linkedin: string | null;
  social_whatsapp: string | null;
  notes: string | null;
  source_session: string | null;
  created_at: string;
  updated_at: string;
  is_referenced: boolean;
  matched_reports: MatchedReport[];
}

interface ContactStats {
  total_contacts: number;
  total_domains: number;
  valid_contacts: number;
  unverified_contacts: number;
}

export default function AdminContactsPage() {
  const [contacts, setContacts] = useState<CrmContactDetail[]>([]);
  const [stats, setStats] = useState<ContactStats>({
    total_contacts: 0,
    total_domains: 0,
    valid_contacts: 0,
    unverified_contacts: 0,
  });
  const [loading, setLoading] = useState(true);

  // 搜索与筛选状态
  const [searchQuery, setSearchQuery] = useState('');
  const [searchType, setSearchType] = useState('all');
  const [refStatus, setRefStatus] = useState('all');
  const [verifyStatus, setVerifyStatus] = useState('all');

  // 分页状态
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [totalRecords, setTotalRecords] = useState(0);
  const [totalPages, setTotalPages] = useState(1);

  // 抽屉详情弹窗选中的联系人
  const [selectedContact, setSelectedContact] = useState<CrmContactDetail | null>(null);

  // 单条核验 loading 状态
  const [verifyingId, setVerifyingId] = useState<number | null>(null);

  // 防抖计时器
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // 获取数据
  const fetchContacts = async (pageToFetch = currentPage) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: pageToFetch.toString(),
        pageSize: pageSize.toString(),
        search: searchQuery.trim(),
        searchType,
        refStatus,
        verifyStatus,
      });

      const res = await fetch(`/api/admin/contacts?${params.toString()}`);
      if (res.ok) {
        const json = await res.json();
        setContacts(json.data || []);
        setTotalRecords(json.pagination?.total || 0);
        setTotalPages(json.pagination?.totalPages || 1);
        if (json.stats) {
          setStats(json.stats);
        }
      } else {
        console.error('Failed to load contacts');
      }
    } catch (err) {
      console.error('Error fetching contacts:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchContacts(1);
  }, [searchType, refStatus, verifyStatus, pageSize]);

  // 搜索框输入防抖
  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setSearchQuery(val);
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    searchTimeoutRef.current = setTimeout(() => {
      setCurrentPage(1);
      fetchContacts(1);
    }, 400);
  };

  // 分页切换
  const handlePageChange = (newPage: number) => {
    if (newPage < 1 || newPage > totalPages) return;
    setCurrentPage(newPage);
    fetchContacts(newPage);
  };

  // 快捷验证单个联系人邮箱
  const handleVerifyEmail = async (contact: CrmContactDetail, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (!contact.email) return;

    setVerifyingId(contact.id);
    try {
      const res = await fetch('/api/contacts/verify-single', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: contact.email }),
      });
      const data = await res.json();
      if (data.success) {
        // 更新列表中的状态
        setContacts(prev =>
          prev.map(c =>
            c.id === contact.id
              ? {
                  ...c,
                  verify_status: data.status,
                  last_verified_at: data.verifiedAt,
                }
              : c
          )
        );
        if (selectedContact && selectedContact.id === contact.id) {
          setSelectedContact(prev =>
            prev
              ? {
                  ...prev,
                  verify_status: data.status,
                  last_verified_at: data.verifiedAt,
                }
              : null
          );
        }
      } else {
        alert(data.error || '验证失败');
      }
    } catch (err) {
      console.error('Verify error:', err);
      alert('网络请求出错');
    } finally {
      setVerifyingId(null);
    }
  };

  // 复制文本提示
  const copyToClipboard = (text: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    navigator.clipboard.writeText(text);
    alert(`已复制: ${text}`);
  };

  return (
    <AdminLayout currentPage="contacts">
      <Head>
        <title>买手联系人数据管理 (CRM) | Market Graphic</title>
      </Head>

      <div style={{ padding: '24px 32px' }}>
        {/* 顶部标题区 */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
          <div>
            <h1 style={{ fontSize: '1.5rem', fontWeight: '700', color: '#fff', margin: '0 0 6px 0' }}>
              💼 全球买手联系人管理 (CRM 数据库)
            </h1>
            <p style={{ margin: 0, color: 'var(--admin-text-secondary)', fontSize: '0.875rem' }}>
              检索 19 万+ 全球采购商联系人完整画像，实时穿透报告引用关联状态与邮箱存活性
            </p>
          </div>
          <button
            onClick={() => fetchContacts(currentPage)}
            className="admin-btn-secondary"
            style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
          >
            🔄 刷新数据
          </button>
        </div>

        {/* 核心指标统计卡片 */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', marginBottom: '24px' }}>
          <div className="admin-card" style={{ padding: '16px 20px' }}>
            <div style={{ color: 'var(--admin-text-secondary)', fontSize: '0.8rem', marginBottom: '4px' }}>全库有效买手总数</div>
            <div style={{ fontSize: '1.5rem', fontWeight: '700', color: 'var(--admin-accent-light)' }}>
              {stats.total_contacts.toLocaleString()} 位
            </div>
          </div>
          <div className="admin-card" style={{ padding: '16px 20px' }}>
            <div style={{ color: 'var(--admin-text-secondary)', fontSize: '0.8rem', marginBottom: '4px' }}>独立企业官网/域名</div>
            <div style={{ fontSize: '1.5rem', fontWeight: '700', color: '#60a5fa' }}>
              {stats.total_domains.toLocaleString()} 家
            </div>
          </div>
          <div className="admin-card" style={{ padding: '16px 20px' }}>
            <div style={{ color: 'var(--admin-text-secondary)', fontSize: '0.8rem', marginBottom: '4px' }}>已完成 MX 存活验证</div>
            <div style={{ fontSize: '1.5rem', fontWeight: '700', color: 'var(--admin-success)' }}>
              {stats.valid_contacts.toLocaleString()} 位
            </div>
          </div>
          <div className="admin-card" style={{ padding: '16px 20px' }}>
            <div style={{ color: 'var(--admin-text-secondary)', fontSize: '0.8rem', marginBottom: '4px' }}>待核验联系人</div>
            <div style={{ fontSize: '1.5rem', fontWeight: '700', color: 'var(--admin-warning)' }}>
              {stats.unverified_contacts.toLocaleString()} 位
            </div>
          </div>
        </div>

        {/* 筛选与搜索工具栏 */}
        <div className="admin-card" style={{ padding: '16px 20px', marginBottom: '20px' }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', alignItems: 'center' }}>
            {/* 搜索分类下拉 */}
            <select
              value={searchType}
              onChange={e => setSearchType(e.target.value)}
              className="admin-select"
              style={{ width: '130px', padding: '8px 12px', fontSize: '0.875rem' }}
            >
              <option value="all">🔍 综合搜索</option>
              <option value="company">🏢 公司名称</option>
              <option value="domain">🌐 网站域名</option>
              <option value="email_suffix">📧 邮箱后缀</option>
              <option value="email">✉️ 完整邮箱</option>
              <option value="contact_name">👤 联系人姓名</option>
            </select>

            {/* 搜索输入框 */}
            <div style={{ position: 'relative', flex: '1', minWidth: '240px' }}>
              <input
                type="text"
                placeholder={
                  searchType === 'company'
                    ? '输入公司名称，例如: walmart、lowes、toledo...'
                    : searchType === 'domain'
                    ? '输入网站域名，例如: walmart.com、lowes.com...'
                    : searchType === 'email_suffix'
                    ? '输入邮箱后缀，例如: @wal-mart.com、@target.com...'
                    : searchType === 'contact_name'
                    ? '输入联系人名字...'
                    : '搜索公司名称、网址域名、邮箱后缀或联系人姓名...'
                }
                value={searchQuery}
                onChange={handleSearchChange}
                className="admin-input"
                style={{ width: '100%', padding: '8px 12px', fontSize: '0.875rem' }}
              />
            </div>

            {/* 引用状态筛选 */}
            <select
              value={refStatus}
              onChange={e => setRefStatus(e.target.value)}
              className="admin-select"
              style={{ width: '160px', padding: '8px 12px', fontSize: '0.875rem' }}
            >
              <option value="all">📑 全部报告引用</option>
              <option value="referenced">✅ 已被报告引用</option>
              <option value="unreferenced">⏳ 尚未被报告引用</option>
            </select>

            {/* 验证状态筛选 */}
            <select
              value={verifyStatus}
              onChange={e => setVerifyStatus(e.target.value)}
              className="admin-select"
              style={{ width: '140px', padding: '8px 12px', fontSize: '0.875rem' }}
            >
              <option value="all">🛡️ 全部核验状态</option>
              <option value="valid">🟢 验证有效 (Valid)</option>
              <option value="unverified">⚪ 未验证 (Unverified)</option>
              <option value="invalid">🔴 无效邮箱 (Invalid)</option>
              <option value="catch_all">🟡 全域接收 (Catch All)</option>
            </select>

            {/* 每页条数 */}
            <select
              value={pageSize}
              onChange={e => setPageSize(parseInt(e.target.value, 10))}
              className="admin-select"
              style={{ width: '110px', padding: '8px 12px', fontSize: '0.875rem' }}
            >
              <option value="20">20 条/页</option>
              <option value="50">50 条/页</option>
              <option value="100">100 条/页</option>
            </select>
          </div>
        </div>

        {/* 联系人数据表格 */}
        <div className="admin-card">
          <div className="admin-table-container">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>企业名称 / 官网</th>
                  <th>买手姓名 / 职位</th>
                  <th>工作邮箱 / 域名后缀</th>
                  <th>国家 / 行业品类</th>
                  <th>报告关联状态</th>
                  <th>邮箱存活性</th>
                  <th style={{ textAlign: 'right' }}>操作</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={7} style={{ textAlign: 'center', padding: '50px', color: 'var(--admin-text-secondary)' }}>
                      正在从 PostgreSQL 检索买手数据...
                    </td>
                  </tr>
                ) : contacts.length === 0 ? (
                  <tr>
                    <td colSpan={7} style={{ textAlign: 'center', padding: '50px', color: 'var(--admin-text-secondary)' }}>
                      未检索到匹配的买手联系人
                    </td>
                  </tr>
                ) : (
                  contacts.map(c => {
                    return (
                      <tr
                        key={c.id}
                        onClick={() => setSelectedContact(c)}
                        style={{ cursor: 'pointer', transition: 'background 0.2s' }}
                      >
                        {/* 企业名称与官网 */}
                        <td>
                          <div style={{ fontWeight: '600', color: '#fff', fontSize: '0.9rem' }}>
                            {c.company_name}
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '3px' }}>
                            {c.website_domain ? (
                              <span style={{ fontSize: '0.75rem', color: 'var(--admin-accent-light)', fontFamily: 'monospace' }}>
                                🌐 {c.website_domain}
                              </span>
                            ) : c.website ? (
                              <span style={{ fontSize: '0.75rem', color: 'var(--admin-text-secondary)' }}>
                                🔗 {c.website}
                              </span>
                            ) : (
                              <span style={{ fontSize: '0.75rem', color: 'var(--admin-text-secondary)' }}>无官网</span>
                            )}
                          </div>
                        </td>

                        {/* 买手姓名与职位 */}
                        <td>
                          <div style={{ fontWeight: '500', color: '#e2e8f0', display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <span>👤 {c.contact_name || '未填姓名'}</span>
                            {c.gender === 'male' && <span style={{ fontSize: '0.75rem', color: '#60a5fa' }}>先生</span>}
                            {c.gender === 'female' && <span style={{ fontSize: '0.75rem', color: '#f472b6' }}>女士</span>}
                          </div>
                          <div style={{ fontSize: '0.75rem', color: 'var(--admin-text-secondary)', marginTop: '2px' }}>
                            {c.job_title || c.department || '采购决策人'}
                          </div>
                        </td>

                        {/* 工作邮箱与后缀 */}
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <span style={{ fontFamily: 'monospace', color: '#fff', fontSize: '0.85rem' }}>
                              {c.email}
                            </span>
                            <button
                              onClick={e => copyToClipboard(c.email, e)}
                              className="admin-btn-secondary"
                              style={{ padding: '2px 6px', fontSize: '0.7rem' }}
                              title="点击复制邮箱"
                            >
                              📋
                            </button>
                          </div>
                          {c.email_domain && (
                            <div style={{ fontSize: '0.75rem', color: '#94a3b8', marginTop: '2px' }}>
                              后缀: @{c.email_domain}
                            </div>
                          )}
                        </td>

                        {/* 国家与品类 */}
                        <td>
                          <div style={{ fontSize: '0.85rem', color: '#e2e8f0' }}>
                            🌍 {c.country || '海外'}
                          </div>
                          <div
                            style={{
                              fontSize: '0.75rem',
                              color: 'var(--admin-text-secondary)',
                              marginTop: '2px',
                              maxWidth: '180px',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                            }}
                            title={c.industry || c.products || ''}
                          >
                            🏷️ {c.industry || c.products || '综合商品'}
                          </div>
                        </td>

                        {/* 报告关联状态 */}
                        <td>
                          {c.is_referenced ? (
                            <div>
                              <span
                                style={{
                                  display: 'inline-block',
                                  padding: '2px 8px',
                                  borderRadius: '4px',
                                  fontSize: '0.75rem',
                                  fontWeight: '600',
                                  background: 'rgba(16, 185, 129, 0.15)',
                                  color: '#10b981',
                                  border: '1px solid rgba(16, 185, 129, 0.3)',
                                }}
                              >
                                🔗 关联 {c.matched_reports.length} 份报告
                              </span>
                              <div style={{ marginTop: '4px' }}>
                                <Link
                                  href={`/reports/${c.matched_reports[0].id}`}
                                  target="_blank"
                                  onClick={e => e.stopPropagation()}
                                  style={{
                                    fontSize: '0.75rem',
                                    color: 'var(--admin-accent-light)',
                                    textDecoration: 'underline',
                                    maxWidth: '160px',
                                    display: 'inline-block',
                                    overflow: 'hidden',
                                    textOverflow: 'ellipsis',
                                    whiteSpace: 'nowrap',
                                  }}
                                  title={c.matched_reports[0].title}
                                >
                                  查看: {c.matched_reports[0].title.split(' - ')[0]}
                                </Link>
                              </div>
                            </div>
                          ) : (
                            <span
                              style={{
                                display: 'inline-block',
                                padding: '2px 8px',
                                borderRadius: '4px',
                                fontSize: '0.75rem',
                                background: 'rgba(255, 255, 255, 0.05)',
                                color: 'var(--admin-text-secondary)',
                                border: '1px solid var(--admin-border)',
                              }}
                            >
                              ⏳ 待生成报告
                            </span>
                          )}
                        </td>

                        {/* 邮箱存活性 */}
                        <td>
                          {c.verify_status === 'valid' ? (
                            <span
                              style={{
                                display: 'inline-block',
                                padding: '2px 8px',
                                borderRadius: '4px',
                                fontSize: '0.75rem',
                                background: 'rgba(16, 185, 129, 0.15)',
                                color: '#10b981',
                              }}
                            >
                              🟢 有效
                            </span>
                          ) : c.verify_status === 'invalid' ? (
                            <span
                              style={{
                                display: 'inline-block',
                                padding: '2px 8px',
                                borderRadius: '4px',
                                fontSize: '0.75rem',
                                background: 'rgba(239, 68, 68, 0.15)',
                                color: '#ef4444',
                              }}
                            >
                              🔴 无效
                            </span>
                          ) : (
                            <span
                              style={{
                                display: 'inline-block',
                                padding: '2px 8px',
                                borderRadius: '4px',
                                fontSize: '0.75rem',
                                background: 'rgba(245, 158, 11, 0.15)',
                                color: '#f59e0b',
                              }}
                            >
                              ⚪ 未验证
                            </span>
                          )}
                        </td>

                        {/* 操作栏 */}
                        <td style={{ textAlign: 'right' }}>
                          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '6px' }}>
                            <button
                              onClick={e => handleVerifyEmail(c, e)}
                              disabled={verifyingId === c.id}
                              className="admin-btn-secondary"
                              style={{ padding: '4px 10px', fontSize: '0.75rem' }}
                            >
                              {verifyingId === c.id ? '验证中...' : '⚡ 验证'}
                            </button>
                            <button
                              onClick={() => setSelectedContact(c)}
                              className="admin-btn-secondary"
                              style={{ padding: '4px 10px', fontSize: '0.75rem', color: 'var(--admin-accent-light)' }}
                            >
                              画像 ➔
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* 分页控制栏 */}
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: '16px 20px',
              borderTop: '1px solid var(--admin-border)',
            }}
          >
            <div style={{ color: 'var(--admin-text-secondary)', fontSize: '0.85rem' }}>
              共检索出 <span style={{ color: '#fff', fontWeight: '600' }}>{totalRecords.toLocaleString()}</span> 条联系人记录，
              当前第 {currentPage} / {totalPages} 页
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                onClick={() => handlePageChange(1)}
                disabled={currentPage <= 1}
                className="admin-btn-secondary"
                style={{ padding: '6px 12px', fontSize: '0.8rem' }}
              >
                首页
              </button>
              <button
                onClick={() => handlePageChange(currentPage - 1)}
                disabled={currentPage <= 1}
                className="admin-btn-secondary"
                style={{ padding: '6px 12px', fontSize: '0.8rem' }}
              >
                上一页
              </button>
              <span
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  padding: '0 12px',
                  fontSize: '0.85rem',
                  color: 'var(--admin-accent-light)',
                  fontWeight: '600',
                }}
              >
                {currentPage}
              </span>
              <button
                onClick={() => handlePageChange(currentPage + 1)}
                disabled={currentPage >= totalPages}
                className="admin-btn-secondary"
                style={{ padding: '6px 12px', fontSize: '0.8rem' }}
              >
                下一页
              </button>
              <button
                onClick={() => handlePageChange(totalPages)}
                disabled={currentPage >= totalPages}
                className="admin-btn-secondary"
                style={{ padding: '6px 12px', fontSize: '0.8rem' }}
              >
                末页
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* 侧边滑出/模态详情弹窗: 显示完整 CRM 结构信息 */}
      {selectedContact && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.75)',
            backdropFilter: 'blur(5px)',
            zIndex: 1000,
            display: 'flex',
            justifyContent: 'flex-end',
          }}
          onClick={() => setSelectedContact(null)}
        >
          <div
            style={{
              width: '560px',
              maxWidth: '90vw',
              height: '100vh',
              backgroundColor: 'var(--admin-bg-card)',
              borderLeft: '1px solid var(--admin-border)',
              display: 'flex',
              flexDirection: 'column',
              padding: '24px 28px',
              overflowY: 'auto',
              boxShadow: '-8px 0 30px rgba(0,0,0,0.5)',
            }}
            onClick={e => e.stopPropagation()}
          >
            {/* 抽屉头部 */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <div>
                <div style={{ fontSize: '0.8rem', color: 'var(--admin-accent-light)', fontWeight: '600', marginBottom: '2px' }}>
                  CRM 联系人档案 #{selectedContact.id}
                </div>
                <h2 style={{ fontSize: '1.25rem', fontWeight: '700', color: '#fff', margin: 0 }}>
                  {selectedContact.company_name}
                </h2>
              </div>
              <button
                onClick={() => setSelectedContact(null)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--admin-text-secondary)',
                  fontSize: '1.5rem',
                  cursor: 'pointer',
                }}
              >
                ×
              </button>
            </div>

            {/* 报告引用情况 */}
            <div
              style={{
                background: selectedContact.is_referenced ? 'rgba(16, 185, 129, 0.08)' : 'rgba(255, 255, 255, 0.03)',
                border: selectedContact.is_referenced ? '1px solid rgba(16, 185, 129, 0.2)' : '1px solid var(--admin-border)',
                borderRadius: '8px',
                padding: '14px 16px',
                marginBottom: '20px',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <span style={{ fontSize: '0.85rem', fontWeight: '600', color: selectedContact.is_referenced ? '#10b981' : '#fff' }}>
                  {selectedContact.is_referenced ? '🔗 已被系统报告收录引用' : '⏳ 尚未关联任何前端报告'}
                </span>
                <span style={{ fontSize: '0.75rem', color: 'var(--admin-text-secondary)' }}>
                  {selectedContact.matched_reports.length} 篇关联报告
                </span>
              </div>
              {selectedContact.matched_reports.length > 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  {selectedContact.matched_reports.map(rep => (
                    <div
                      key={rep.id}
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        fontSize: '0.8rem',
                        background: 'rgba(0,0,0,0.2)',
                        padding: '6px 10px',
                        borderRadius: '4px',
                      }}
                    >
                      <span style={{ color: '#e2e8f0' }}>📄 {rep.title}</span>
                      <Link
                        href={`/reports/${rep.id}`}
                        target="_blank"
                        style={{ color: 'var(--admin-accent-light)', textDecoration: 'underline' }}
                      >
                        在新标签打开 ➔
                      </Link>
                    </div>
                  ))}
                </div>
              ) : (
                <div style={{ fontSize: '0.75rem', color: 'var(--admin-text-secondary)' }}>
                  提示: 当在平台生成该公司（{selectedContact.website_domain || selectedContact.company_name}）的调研报告后，前台将自动把该联系人聚合在报告弹窗中。
                </div>
              )}
            </div>

            {/* 字段网格详情 */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ fontWeight: '600', color: '#fff', fontSize: '0.9rem', borderBottom: '1px solid var(--admin-border)', paddingBottom: '6px' }}>
                📇 基础通信与企业信息
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', fontSize: '0.85rem' }}>
                <div>
                  <span style={{ color: 'var(--admin-text-secondary)' }}>工作邮箱:</span>
                  <div style={{ color: '#fff', fontWeight: '500', fontFamily: 'monospace', marginTop: '2px' }}>
                    {selectedContact.email}
                  </div>
                </div>
                <div>
                  <span style={{ color: 'var(--admin-text-secondary)' }}>邮箱后缀:</span>
                  <div style={{ color: '#fff', marginTop: '2px' }}>
                    @{selectedContact.email_domain || '-'}
                  </div>
                </div>
                <div>
                  <span style={{ color: 'var(--admin-text-secondary)' }}>企业官网:</span>
                  <div style={{ color: 'var(--admin-accent-light)', marginTop: '2px' }}>
                    {selectedContact.website || selectedContact.website_domain || '-'}
                  </div>
                </div>
                <div>
                  <span style={{ color: 'var(--admin-text-secondary)' }}>官网根域名:</span>
                  <div style={{ color: '#fff', fontFamily: 'monospace', marginTop: '2px' }}>
                    {selectedContact.website_domain || '-'}
                  </div>
                </div>
                <div>
                  <span style={{ color: 'var(--admin-text-secondary)' }}>电话 / 手机:</span>
                  <div style={{ color: '#fff', marginTop: '2px' }}>
                    {selectedContact.phone || '-'}
                  </div>
                </div>
                <div>
                  <span style={{ color: 'var(--admin-text-secondary)' }}>传真号码:</span>
                  <div style={{ color: '#fff', marginTop: '2px' }}>
                    {selectedContact.fax || '-'}
                  </div>
                </div>
                <div>
                  <span style={{ color: 'var(--admin-text-secondary)' }}>所在国家 / 地区:</span>
                  <div style={{ color: '#fff', marginTop: '2px' }}>
                    {selectedContact.country || '-'}
                  </div>
                </div>
                <div>
                  <span style={{ color: 'var(--admin-text-secondary)' }}>邮政编码:</span>
                  <div style={{ color: '#fff', marginTop: '2px' }}>
                    {selectedContact.zip_code || '-'}
                  </div>
                </div>
              </div>

              <div style={{ fontSize: '0.85rem' }}>
                <span style={{ color: 'var(--admin-text-secondary)' }}>详细办公地址:</span>
                <div style={{ color: '#e2e8f0', marginTop: '2px', background: 'rgba(255,255,255,0.03)', padding: '8px 10px', borderRadius: '4px' }}>
                  {selectedContact.address || '未记录详细地址'}
                </div>
              </div>

              <div style={{ fontWeight: '600', color: '#fff', fontSize: '0.9rem', borderBottom: '1px solid var(--admin-border)', paddingBottom: '6px', marginTop: '10px' }}>
                👤 个人画像与 CRM 扩展字段
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', fontSize: '0.85rem' }}>
                <div>
                  <span style={{ color: 'var(--admin-text-secondary)' }}>联系人姓名:</span>
                  <div style={{ color: '#fff', marginTop: '2px' }}>
                    {selectedContact.contact_name || '-'}
                  </div>
                </div>
                <div>
                  <span style={{ color: 'var(--admin-text-secondary)' }}>性别:</span>
                  <div style={{ color: '#fff', marginTop: '2px' }}>
                    {selectedContact.gender === 'male' ? '男 (Male)' : selectedContact.gender === 'female' ? '女 (Female)' : '未知'}
                  </div>
                </div>
                <div>
                  <span style={{ color: 'var(--admin-text-secondary)' }}>职位头衔:</span>
                  <div style={{ color: '#fff', marginTop: '2px' }}>
                    {selectedContact.job_title || '-'}
                  </div>
                </div>
                <div>
                  <span style={{ color: 'var(--admin-text-secondary)' }}>所在部门:</span>
                  <div style={{ color: '#fff', marginTop: '2px' }}>
                    {selectedContact.department || '-'}
                  </div>
                </div>
                <div>
                  <span style={{ color: 'var(--admin-text-secondary)' }}>生日:</span>
                  <div style={{ color: '#fff', marginTop: '2px' }}>
                    {selectedContact.birthday || '-'}
                  </div>
                </div>
                <div>
                  <span style={{ color: 'var(--admin-text-secondary)' }}>WhatsApp:</span>
                  <div style={{ color: '#fff', marginTop: '2px' }}>
                    {selectedContact.social_whatsapp || '-'}
                  </div>
                </div>
              </div>

              <div style={{ fontSize: '0.85rem' }}>
                <span style={{ color: 'var(--admin-text-secondary)' }}>LinkedIn 领英主页:</span>
                <div style={{ color: 'var(--admin-accent-light)', marginTop: '2px' }}>
                  {selectedContact.social_linkedin ? (
                    <a href={selectedContact.social_linkedin} target="_blank" rel="noreferrer" style={{ color: '#60a5fa' }}>
                      {selectedContact.social_linkedin}
                    </a>
                  ) : (
                    '-'
                  )}
                </div>
              </div>

              <div style={{ fontWeight: '600', color: '#fff', fontSize: '0.9rem', borderBottom: '1px solid var(--admin-border)', paddingBottom: '6px', marginTop: '10px' }}>
                📦 采购业务与系统标签
              </div>

              <div style={{ fontSize: '0.85rem' }}>
                <span style={{ color: 'var(--admin-text-secondary)' }}>所属行业:</span>
                <div style={{ color: '#fff', marginTop: '2px' }}>
                  {selectedContact.industry || '-'}
                </div>
              </div>

              <div style={{ fontSize: '0.85rem' }}>
                <span style={{ color: 'var(--admin-text-secondary)' }}>采购商品/品类描述:</span>
                <div style={{ color: '#e2e8f0', marginTop: '2px', background: 'rgba(255,255,255,0.03)', padding: '8px 10px', borderRadius: '4px' }}>
                  {selectedContact.products || '无'}
                </div>
              </div>

              <div style={{ fontSize: '0.85rem' }}>
                <span style={{ color: 'var(--admin-text-secondary)' }}>广交会历史参展记录 (内部归档字段):</span>
                <div style={{ color: '#f59e0b', marginTop: '2px', fontFamily: 'monospace' }}>
                  {selectedContact.source_session || '无'}
                </div>
              </div>

              {selectedContact.notes && (
                <div style={{ fontSize: '0.85rem' }}>
                  <span style={{ color: 'var(--admin-text-secondary)' }}>备注信息:</span>
                  <div style={{ color: '#e2e8f0', marginTop: '2px' }}>{selectedContact.notes}</div>
                </div>
              )}
            </div>

            {/* 抽屉底部快捷操作 */}
            <div style={{ marginTop: 'auto', paddingTop: '24px', display: 'flex', gap: '12px' }}>
              <button
                onClick={e => handleVerifyEmail(selectedContact, e)}
                disabled={verifyingId === selectedContact.id}
                className="admin-btn-secondary"
                style={{ flex: 1, padding: '10px', fontWeight: '600' }}
              >
                {verifyingId === selectedContact.id ? '正在连接邮件服务器...' : '⚡ 立即执行 MX 活性检测'}
              </button>
              <button
                onClick={() => setSelectedContact(null)}
                className="admin-btn-secondary"
                style={{ padding: '10px 18px' }}
              >
                关闭
              </button>
            </div>
          </div>
        </div>
      )}
    </AdminLayout>
  );
}
