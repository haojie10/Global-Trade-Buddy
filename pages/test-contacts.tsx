import React, { useState, useEffect } from 'react';
import Head from 'next/head';
import ReportContactsModal, { ReportContact } from '../components/ReportContactsModal';

const DEMO_COMPANIES = [
  { name: "Lowe's Companies, Inc.", website: 'https://www.lowes.com', note: '全美第二大家居零售巨头 (精准命中 1 位专属直采负责人)' },
  { name: 'Whirlpool Corporation', website: 'https://www.whirlpoolcorp.com', note: '惠而浦全球家电巨头 (精准命中 19 位采销联系人)' },
  { name: 'Groupe SEB', website: 'https://www.groupeseb.com', note: '法国特福/苏泊尔母公司 (精准命中 13 位亚洲采购负责人)' },
  { name: 'Comet S.p.A.', website: 'https://www.comet.it', note: '意大利电气分销商 (未曾参展，严格如实返回 0 位，绝不胡乱匹配)' },
];

export default function TestContactsPage() {
  const [selectedIdx, setSelectedIdx] = useState(0);
  const [contacts, setContacts] = useState<ReportContact[]>([]);
  const [loading, setLoading] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [customDomain, setCustomDomain] = useState('');
  const [activeTitle, setActiveTitle] = useState('');
  const [activeDomain, setActiveDomain] = useState('');

  const currentComp = DEMO_COMPANIES[selectedIdx];

  const fetchContactsByCompany = async (comp: typeof DEMO_COMPANIES[0]) => {
    setLoading(true);
    setActiveTitle(comp.name);
    setActiveDomain(comp.website.replace('https://www.', '').replace('https://', ''));
    try {
      const url = `/api/reports/test-demo/contacts?domain=${encodeURIComponent(comp.website)}&company=${encodeURIComponent(comp.name)}`;
      const res = await fetch(url);
      const data = await res.json();
      if (data.success) {
        setContacts(data.contacts || []);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleCustomSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customDomain.trim()) return;
    setLoading(true);
    const domainClean = customDomain.trim().toLowerCase();
    setActiveTitle(`自定义域名检索: ${domainClean}`);
    setActiveDomain(domainClean);
    try {
      const url = `/api/reports/test-demo/contacts?domain=${encodeURIComponent(domainClean)}`;
      const res = await fetch(url);
      const data = await res.json();
      if (data.success) {
        setContacts(data.contacts || []);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchContactsByCompany(currentComp);
  }, [selectedIdx]);

  return (
    <div style={{ minHeight: '100vh', background: '#f8fafc', color: '#0f172a', padding: '40px 20px', fontFamily: 'sans-serif' }}>
      <Head>
        <title>CRM 联系人联动本地联调沙盒 | GTB</title>
      </Head>

      <div style={{ maxWidth: '900px', margin: '0 auto' }}>
        <div style={{ background: '#ffffff', borderRadius: '16px', padding: '30px', boxShadow: '0 4px 20px rgba(0,0,0,0.06)', marginBottom: '30px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
            <span style={{ fontSize: '1.4rem' }}>🛠️</span>
            <h1 style={{ fontSize: '1.5rem', fontWeight: 700, margin: 0 }}>企业采购联系人本地联调测试台</h1>
          </div>
          <p style={{ color: '#64748b', fontSize: '0.9rem', margin: '0 0 24px 0' }}>
            此页面用于在本地直接验证研报联系人匹配、前端弹窗交互以及单条邮箱实时握手验证功能。
          </p>

          {/* 切换演示企业 */}
          <div style={{ marginBottom: '24px' }}>
            <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: '#334155', marginBottom: '8px' }}>
              点击选择预置企业研报进行联调：
            </label>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '10px' }}>
              {DEMO_COMPANIES.map((comp, idx) => (
                <button
                  key={comp.name}
                  onClick={() => setSelectedIdx(idx)}
                  style={{
                    background: selectedIdx === idx ? '#eff6ff' : '#ffffff',
                    border: selectedIdx === idx ? '2px solid #3b82f6' : '1px solid #e2e8f0',
                    borderRadius: '12px',
                    padding: '12px 14px',
                    textAlign: 'left',
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                  }}
                >
                  <div style={{ fontWeight: 600, fontSize: '0.9rem', color: selectedIdx === idx ? '#1d4ed8' : '#0f172a' }}>
                    {comp.name}
                  </div>
                  <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '4px', lineHeight: 1.4 }}>
                    {comp.note}
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* 自定义检索任意企业官网根域名 */}
          <form onSubmit={handleCustomSearch} style={{ marginBottom: '24px', display: 'flex', gap: '10px' }}>
            <input
              type="text"
              placeholder="输入任意企业官网根域名 (如 lowes.com, whirlpoolcorp.com, groupeseb.com, lifung.com...)"
              value={customDomain}
              onChange={(e) => setCustomDomain(e.target.value)}
              style={{
                flex: 1,
                background: '#f8fafc',
                border: '1px solid #cbd5e1',
                borderRadius: '10px',
                padding: '10px 14px',
                fontSize: '0.85rem',
                outline: 'none',
              }}
            />
            <button
              type="submit"
              disabled={loading || !customDomain.trim()}
              style={{
                background: '#0f172a',
                color: '#ffffff',
                border: 'none',
                borderRadius: '10px',
                padding: '10px 18px',
                fontSize: '0.85rem',
                fontWeight: 600,
                cursor: loading || !customDomain.trim() ? 'not-allowed' : 'pointer',
              }}
            >
              按域名精准检索
            </button>
          </form>

          {/* 模拟报告详情页操作栏 */}
          <div style={{
            background: '#f1f5f9',
            borderRadius: '12px',
            padding: '18px 20px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '12px',
          }}>
            <div>
              <div style={{ fontSize: '0.75rem', color: '#64748b', marginBottom: '2px' }}>当前研报所属企业 / 检索标的</div>
              <div style={{ fontSize: '1.1rem', fontWeight: 600, color: '#0f172a' }}>
                {activeTitle || currentComp.name}
                {activeDomain && (
                  <span style={{ marginLeft: '8px', fontSize: '0.8rem', color: '#3b82f6', fontWeight: 400 }}>
                    ({activeDomain})
                  </span>
                )}
              </div>
            </div>

            {/* 核心挂载按钮 */}
            <div>
              <button
                onClick={() => setShowModal(true)}
                disabled={loading || contacts.length === 0}
                style={{
                  background: contacts.length > 0 ? '#2563eb' : '#94a3b8',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: '10px',
                  padding: '10px 18px',
                  fontSize: '0.9rem',
                  fontWeight: 600,
                  cursor: contacts.length > 0 ? 'pointer' : 'not-allowed',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  boxShadow: contacts.length > 0 ? '0 4px 12px rgba(37, 99, 235, 0.25)' : 'none',
                  transition: 'all 0.2s',
                }}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                  <circle cx="8.5" cy="7" r="4" />
                  <line x1="20" y1="8" x2="20" y2="14" />
                  <line x1="23" y1="11" x2="17" y2="11" />
                </svg>
                {loading ? '正在检索...' : `💼 采购联系人 (${contacts.length} 位)`}
              </button>
            </div>
          </div>
        </div>

        {/* 提示框 */}
        <div style={{ background: '#ffffff', borderRadius: '16px', padding: '24px', border: '1px solid #e2e8f0', fontSize: '0.85rem', color: '#475569' }}>
          <h3 style={{ margin: '0 0 10px 0', fontSize: '1rem', color: '#0f172a' }}>📋 严谨检索规则说明：</h3>
          <ul style={{ margin: 0, paddingLeft: '20px', lineHeight: 1.8 }}>
            <li><strong>精准域名强等匹配</strong>：只认企业唯一根域名（如 <code>lowes.com</code> 匹配出 1 位专属采购负责人），杜绝把包含类似字符的无关公司带进来。</li>
            <li><strong>如实反映无记录</strong>：若目标企业从未在广交会登记（如 Comet S.p.A.），系统严格返回 0 位，坚决杜绝把无关的“哈雷彗星”等噪音拉来凑数。</li>
            <li><strong>单点验证无污染</strong>：点击「点击验证邮箱」，毫秒级发起真实 DNS/MX 查询，保护发信域名信誉。</li>
          </ul>
        </div>
      </div>

      {/* 弹窗组件 */}
      <ReportContactsModal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        companyName={activeTitle || currentComp.name}
        websiteDomain={activeDomain || currentComp.website}
        contacts={contacts}
      />
    </div>
  );
}
