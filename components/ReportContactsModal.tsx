import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';

export interface ReportContact {
  id: number | string;
  email: string;
  company_name: string;
  contact_name: string;
  job_title: string;
  phone: string;
  fax: string;
  address: string;
  country: string;
  industry: string;
  products: string;
  website_domain: string;
  verify_status: 'unverified' | 'valid' | 'invalid' | 'catch_all' | string;
  last_verified_at: string | null;
  gender?: string;
  birthday?: string;
  department?: string;
  social_linkedin?: string;
  social_whatsapp?: string;
  notes?: string;
}

interface ReportContactsModalProps {
  isOpen: boolean;
  onClose: () => void;
  companyName: string;
  websiteDomain: string;
  contacts: ReportContact[];
}

export default function ReportContactsModal({
  isOpen,
  onClose,
  companyName,
  websiteDomain,
  contacts: initialContacts,
}: ReportContactsModalProps) {
  const [mounted, setMounted] = useState(false);
  const [contacts, setContacts] = useState<ReportContact[]>(initialContacts);
  const [verifyingEmail, setVerifyingEmail] = useState<string | null>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    setContacts(initialContacts);
  }, [initialContacts]);

  // Esc 键关闭
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown);
      document.body.style.overflow = 'hidden';
    }
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = 'unset';
    };
  }, [isOpen, onClose]);

  if (!isOpen || !mounted) return null;

  const copyToClipboard = (text: string, key: string) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const handleVerify = async (contact: ReportContact) => {
    if (verifyingEmail) return;
    setVerifyingEmail(contact.email);

    try {
      const res = await fetch('/api/contacts/verify-single', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: contact.email, contactId: contact.id }),
      });
      const data = await res.json();
      if (data.success && data.status) {
        setContacts(prev =>
          prev.map(c =>
            c.email === contact.email
              ? { ...c, verify_status: data.status, last_verified_at: data.verifiedAt || new Date().toISOString() }
              : c
          )
        );
      } else {
        alert(data.reason || '验证失败，请稍后重试');
      }
    } catch {
      alert('连接验证服务器失败');
    } finally {
      setVerifyingEmail(null);
    }
  };

  const filteredContacts = contacts.filter(c => {
    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();
    return (
      c.contact_name?.toLowerCase().includes(term) ||
      c.email?.toLowerCase().includes(term) ||
      c.phone?.includes(term) ||
      c.company_name?.toLowerCase().includes(term)
    );
  });

  const getVerifyBadge = (status: string, email: string) => {
    if (verifyingEmail === email) {
      return (
        <span style={{
          background: 'rgba(59, 130, 246, 0.1)',
          color: '#2563eb',
          border: '1px solid rgba(59, 130, 246, 0.3)',
          padding: '2px 8px',
          borderRadius: '6px',
          fontSize: '0.75rem',
          display: 'inline-flex',
          alignItems: 'center',
          gap: '4px',
          fontWeight: 500,
        }}>
          <span style={{
            display: 'inline-block',
            width: '6px',
            height: '6px',
            borderRadius: '50%',
            background: '#2563eb',
            animation: 'pulse 1s infinite'
          }} />
          校验中...
        </span>
      );
    }

    if (status === 'valid') {
      return (
        <span style={{
          background: 'rgba(34, 197, 94, 0.1)',
          color: '#16a34a',
          border: '1px solid rgba(34, 197, 94, 0.3)',
          padding: '2px 8px',
          borderRadius: '6px',
          fontSize: '0.75rem',
          display: 'inline-flex',
          alignItems: 'center',
          gap: '4px',
          fontWeight: 500,
        }}>
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="20 6 9 17 4 12" />
          </svg>
          有效 (已验证)
        </span>
      );
    }

    if (status === 'invalid') {
      return (
        <span style={{
          background: 'rgba(239, 68, 68, 0.1)',
          color: '#dc2626',
          border: '1px solid rgba(239, 68, 68, 0.3)',
          padding: '2px 8px',
          borderRadius: '6px',
          fontSize: '0.75rem',
          display: 'inline-flex',
          alignItems: 'center',
          gap: '4px',
          fontWeight: 500,
        }}>
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
          无效邮箱
        </span>
      );
    }

    // 默认未验证
    return (
      <span style={{
        background: 'rgba(100, 116, 139, 0.08)',
        color: '#64748b',
        border: '1px solid rgba(100, 116, 139, 0.2)',
        padding: '2px 8px',
        borderRadius: '6px',
        fontSize: '0.75rem',
        fontWeight: 400,
      }}>
        未验证
      </span>
    );
  };

  return createPortal(
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(15, 23, 42, 0.45)',
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
        zIndex: 99999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '20px',
        animation: 'fadeIn 0.2s ease-out',
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: '#ffffff',
          borderRadius: '20px',
          width: '100%',
          maxWidth: '820px',
          maxHeight: '85vh',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25), 0 0 0 1px rgba(0, 0, 0, 0.05)',
          overflow: 'hidden',
          animation: 'scaleUp 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
        }}
      >
        {/* 弹窗头部 */}
        <div style={{
          padding: '24px 28px',
          borderBottom: '1px solid #f1f5f9',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          background: 'linear-gradient(to right, #f8fafc, #ffffff)',
        }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px', flexWrap: 'wrap' }}>
              <span style={{
                background: 'rgba(59, 130, 246, 0.1)',
                color: '#2563eb',
                fontSize: '0.75rem',
                padding: '2px 8px',
                borderRadius: '6px',
                fontWeight: 600,
              }}>
                企业潜客联系库
              </span>
              {websiteDomain && (
                <span style={{
                  background: '#f1f5f9',
                  color: '#475569',
                  fontSize: '0.75rem',
                  padding: '2px 8px',
                  borderRadius: '6px',
                  fontFamily: 'monospace',
                }}>
                  🌐 {websiteDomain}
                </span>
              )}
              <span style={{
                background: '#f1f5f9',
                color: '#64748b',
                fontSize: '0.75rem',
                padding: '2px 8px',
                borderRadius: '6px',
              }}>
                共匹配到 {contacts.length} 位联系人
              </span>
            </div>
            <h2 style={{
              margin: 0,
              fontSize: '1.25rem',
              fontWeight: 600,
              color: '#0f172a',
              lineHeight: 1.3,
            }}>
              {companyName}
            </h2>
          </div>

          <button
            onClick={onClose}
            style={{
              background: '#f1f5f9',
              border: 'none',
              borderRadius: '50%',
              width: '32px',
              height: '32px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              color: '#64748b',
              transition: 'all 0.2s',
            }}
            title="关闭 (Esc)"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* 搜索过滤条 (多于 3 条时展示) */}
        {contacts.length > 3 && (
          <div style={{ padding: '12px 28px', background: '#f8fafc', borderBottom: '1px solid #f1f5f9' }}>
            <input
              type="text"
              placeholder="快速搜索联系人姓名、邮箱、电话或子公司..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              style={{
                width: '100%',
                background: '#ffffff',
                border: '1px solid #e2e8f0',
                borderRadius: '10px',
                padding: '8px 14px',
                fontSize: '0.85rem',
                color: '#0f172a',
                outline: 'none',
                boxSizing: 'border-box',
              }}
            />
          </div>
        )}

        {/* 联系人列表内容区 */}
        <div style={{
          padding: '20px 28px',
          overflowY: 'auto',
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          gap: '14px',
        }}>
          {filteredContacts.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px 0', color: '#94a3b8' }}>
              <div style={{ fontSize: '2rem', marginBottom: '10px' }}>🔍</div>
              <p style={{ margin: 0, fontSize: '0.9rem' }}>
                {contacts.length === 0 ? '暂未在该企业旗下检索到已沉淀的联系人信息' : '未找到匹配搜索条件的联系人'}
              </p>
            </div>
          ) : (
            filteredContacts.map((c, idx) => (
              <div
                key={c.email || idx}
                style={{
                  background: '#ffffff',
                  border: '1px solid #e2e8f0',
                  borderRadius: '14px',
                  padding: '16px 20px',
                  boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.04)',
                  transition: 'all 0.2s ease',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '10px',
                }}
              >
                {/* 顶栏: 姓名、公司分部与国家 */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div style={{
                      width: '36px',
                      height: '36px',
                      borderRadius: '50%',
                      background: 'linear-gradient(135deg, #3b82f6, #1d4ed8)',
                      color: '#ffffff',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '0.85rem',
                      fontWeight: 600,
                    }}>
                      {(c.contact_name ? c.contact_name[0] : '买').toUpperCase()}
                    </div>
                    <div>
                      <div style={{ fontSize: '0.95rem', fontWeight: 600, color: '#0f172a' }}>
                        {c.contact_name || '海外采购决策人'}
                        {c.job_title && (
                          <span style={{ marginLeft: '8px', fontSize: '0.75rem', color: '#64748b', fontWeight: 400 }}>
                            {c.job_title}
                          </span>
                        )}
                      </div>
                      <div style={{ fontSize: '0.75rem', color: '#64748b' }}>
                        {c.company_name}
                      </div>
                    </div>
                  </div>

                  {c.country && (
                    <span style={{
                      background: '#f8fafc',
                      border: '1px solid #e2e8f0',
                      color: '#475569',
                      fontSize: '0.75rem',
                      padding: '3px 8px',
                      borderRadius: '6px',
                    }}>
                      📍 {c.country}
                    </span>
                  )}
                </div>

                {/* 联系方式展示行 */}
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
                  gap: '10px',
                  background: '#f8fafc',
                  padding: '12px 14px',
                  borderRadius: '10px',
                  alignItems: 'center',
                }}>
                  {/* 邮箱区域 */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', minWidth: 0 }}>
                      <span style={{ fontSize: '0.85rem' }}>✉️</span>
                      <span style={{
                        fontSize: '0.85rem',
                        fontWeight: 500,
                        color: '#0f172a',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}>
                        {c.email}
                      </span>
                    </div>

                    <button
                      onClick={() => copyToClipboard(c.email, `email_${c.email}`)}
                      style={{
                        background: 'transparent',
                        border: 'none',
                        cursor: 'pointer',
                        padding: '4px',
                        color: copiedKey === `email_${c.email}` ? '#16a34a' : '#94a3b8',
                        fontSize: '0.75rem',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '2px',
                      }}
                      title="复制邮箱"
                    >
                      {copiedKey === `email_${c.email}` ? '已复制' : '复制'}
                    </button>
                  </div>

                  {/* 电话区域 */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', minWidth: 0 }}>
                      <span style={{ fontSize: '0.85rem' }}>📞</span>
                      <span style={{
                        fontSize: '0.85rem',
                        color: c.phone ? '#0f172a' : '#94a3b8',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}>
                        {c.phone || '未留电话'}
                      </span>
                    </div>

                    {c.phone && (
                      <button
                        onClick={() => copyToClipboard(c.phone, `phone_${c.email}`)}
                        style={{
                          background: 'transparent',
                          border: 'none',
                          cursor: 'pointer',
                          padding: '4px',
                          color: copiedKey === `phone_${c.email}` ? '#16a34a' : '#94a3b8',
                          fontSize: '0.75rem',
                        }}
                        title="复制电话"
                      >
                        {copiedKey === `phone_${c.email}` ? '已复制' : '复制'}
                      </button>
                    )}
                  </div>
                </div>

                {/* 验证操作与状态栏 */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '4px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    {getVerifyBadge(c.verify_status, c.email)}
                    {c.last_verified_at && (
                      <span style={{ fontSize: '0.7rem', color: '#94a3b8' }}>
                        验证于 {new Date(c.last_verified_at).toLocaleDateString()}
                      </span>
                    )}
                  </div>

                  {/* 仅在未验证或无效状态下提供触发验证按钮 */}
                  {c.verify_status !== 'valid' && (
                    <button
                      onClick={() => handleVerify(c)}
                      disabled={verifyingEmail === c.email}
                      style={{
                        background: '#ffffff',
                        border: '1px solid #cbd5e1',
                        borderRadius: '8px',
                        padding: '4px 10px',
                        fontSize: '0.75rem',
                        color: '#334155',
                        cursor: verifyingEmail === c.email ? 'wait' : 'pointer',
                        fontWeight: 500,
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px',
                        transition: 'all 0.15s ease',
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.borderColor = '#2563eb';
                        e.currentTarget.style.color = '#2563eb';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.borderColor = '#cbd5e1';
                        e.currentTarget.style.color = '#334155';
                      }}
                    >
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                        <polyline points="22 4 12 14.01 9 11.01" />
                      </svg>
                      {verifyingEmail === c.email ? '握手探测中...' : '点击验证邮箱'}
                    </button>
                  )}
                </div>
              </div>
            ))
          )}
        </div>

        {/* 底部保护与风控提示 */}
        <div style={{
          padding: '14px 28px',
          background: '#f8fafc',
          borderTop: '1px solid #f1f5f9',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          fontSize: '0.75rem',
          color: '#64748b',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span>🛡️</span>
            <span>单条实时握手探测已启用，完全隔离并保护您的发信域名信誉。</span>
          </div>
          <button
            onClick={onClose}
            style={{
              background: '#0f172a',
              color: '#ffffff',
              border: 'none',
              padding: '6px 14px',
              borderRadius: '8px',
              fontSize: '0.75rem',
              cursor: 'pointer',
              fontWeight: 500,
            }}
          >
            完成
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
