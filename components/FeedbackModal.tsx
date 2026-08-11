import React, { useState, useEffect } from 'react';

interface FeedbackModalProps {
  isOpen: boolean;
  onClose: () => void;
  userEmail?: string;
}

export default function FeedbackModal({ isOpen, onClose, userEmail = '' }: FeedbackModalProps) {
  // 主模式: 'custom_report' (调研报告定制) | 'feedback' (平台改善意见)
  const [mainTab, setMainTab] = useState<'custom_report' | 'feedback'>('custom_report');
  
  // 研报定制类型: 'category_insight' (渠道品类调研) | 'company_insight' (企业战略洞察)
  const [reportSubTab, setReportSubTab] = useState<'category_insight' | 'company_insight'>('category_insight');

  // 表单状态 - 品类调研
  const [targetChannel, setTargetChannel] = useState('');
  const [productName, setProductName] = useState('');
  const [categoryMarket, setCategoryMarket] = useState('');

  // 表单状态 - 企业洞察
  const [companyName, setCompanyName] = useState('');
  const [companyUrl, setCompanyUrl] = useState('');
  const [companyMarket, setCompanyMarket] = useState('');

  // 表单状态 - 改善意见
  const [feedbackCategory, setFeedbackCategory] = useState('功能建议');
  const [feedbackContent, setFeedbackContent] = useState('');

  // 状态机
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [isSuccess, setIsSuccess] = useState(false);

  useEffect(() => {
    if (!isOpen) {
      setErrorMsg('');
      setIsSuccess(false);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    const activeEmail = (userEmail || '').trim();
    if (!activeEmail) {
      setErrorMsg('您尚未登录，请先登录后再提交需求或反馈');
      return;
    }

    let requestType = 'feedback';
    let payload: any = {};

    if (mainTab === 'custom_report') {
      requestType = reportSubTab;
      if (reportSubTab === 'category_insight') {
        if (!targetChannel.trim() || !productName.trim() || !categoryMarket.trim()) {
          setErrorMsg('请填写完整的目标销售渠道、具体产品名称和目标市场');
          return;
        }
        payload = {
          channel: targetChannel.trim(),
          productName: productName.trim(),
          marketRegion: categoryMarket.trim()
        };
      } else {
        if (!companyName.trim() || !companyUrl.trim() || !companyMarket.trim()) {
          setErrorMsg('请填写完整的目标公司名称、公司官网地址和目标市场');
          return;
        }
        payload = {
          companyName: companyName.trim(),
          companyUrl: companyUrl.trim(),
          marketRegion: companyMarket.trim()
        };
      }
    } else {
      if (!feedbackContent.trim()) {
        setErrorMsg('请填写具体的平台改善意见内容');
        return;
      }
      payload = {
        category: feedbackCategory,
        content: feedbackContent.trim()
      };
    }

    setIsSubmitting(true);
    try {
      const res = await fetch('/api/user/custom-request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          requestType,
          contactEmail: activeEmail,
          payload
        })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setIsSuccess(true);
      } else {
        setErrorMsg(data.error || '提交失败，请重试');
      }
    } catch (err) {
      setErrorMsg('网络连接异常，请重试');
    } finally {
      setIsSubmitting(false);
    }
  };

  const inputStyle: React.CSSProperties = {
    background: '#f8fafc',
    border: '1px solid #e2e8f0',
    borderRadius: '12px',
    padding: '11px 16px',
    fontSize: '0.85rem',
    color: '#0f172a',
    outline: 'none',
    width: '100%',
    boxSizing: 'border-box'
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
      zIndex: 10000
    }}>
      <div style={{
        background: '#ffffff',
        borderRadius: '20px',
        padding: '32px 28px',
        width: '90%',
        maxWidth: '460px',
        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.15)',
        position: 'relative',
        color: '#0f172a'
      }}>
        {/* 关闭按钮 */}
        <button
          onClick={onClose}
          style={{
            position: 'absolute',
            top: '20px',
            right: '20px',
            background: 'none',
            border: 'none',
            fontSize: '1.2rem',
            cursor: 'pointer',
            color: '#64748b'
          }}
        >
          ✕
        </button>

        <h2 style={{ fontSize: '1.35rem', fontWeight: 600, marginBottom: '20px', textAlign: 'center', color: '#0f172a' }}>
          需求反馈与研报定制
        </h2>

        {/* 成功状态展示 */}
        {isSuccess ? (
          <div style={{ padding: '24px 10px', textAlign: 'center' }}>
            <div style={{
              width: '56px',
              height: '56px',
              borderRadius: '50%',
              background: '#dcfce7',
              color: '#16a34a',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 16px',
              fontSize: '1.8rem'
            }}>
              ✓
            </div>
            <h3 style={{ fontSize: '1.1rem', fontWeight: 600, color: '#0f172a', marginBottom: '8px' }}>
              提交成功
            </h3>
            <p style={{ fontSize: '0.9rem', color: '#475569', lineHeight: 1.6, marginBottom: '24px' }}>
              需求已提交！AI 智能体已接单，完成后您将收到邮件通知。
            </p>
            <button
              onClick={onClose}
              className="sand-btn"
              style={{ padding: '10px 24px', fontSize: '0.9rem', width: '100%' }}
            >
              好的，我知道了
            </button>
          </div>
        ) : (
          <>
            {/* 主模式页签 */}
            <div style={{
              display: 'flex',
              background: '#f1f5f9',
              borderRadius: '12px',
              padding: '4px',
              marginBottom: '20px'
            }}>
              <button
                type="button"
                onClick={() => setMainTab('custom_report')}
                style={{
                  flex: 1,
                  padding: '9px',
                  borderRadius: '9px',
                  border: 'none',
                  fontSize: '0.85rem',
                  fontWeight: mainTab === 'custom_report' ? 600 : 400,
                  background: mainTab === 'custom_report' ? '#ffffff' : 'transparent',
                  color: mainTab === 'custom_report' ? '#0f172a' : '#64748b',
                  boxShadow: mainTab === 'custom_report' ? '0 2px 6px rgba(0,0,0,0.06)' : 'none',
                  cursor: 'pointer',
                  transition: 'all 0.2s'
                }}
              >
                调研报告定制
              </button>
              <button
                type="button"
                onClick={() => setMainTab('feedback')}
                style={{
                  flex: 1,
                  padding: '9px',
                  borderRadius: '9px',
                  border: 'none',
                  fontSize: '0.85rem',
                  fontWeight: mainTab === 'feedback' ? 600 : 400,
                  background: mainTab === 'feedback' ? '#ffffff' : 'transparent',
                  color: mainTab === 'feedback' ? '#0f172a' : '#64748b',
                  boxShadow: mainTab === 'feedback' ? '0 2px 6px rgba(0,0,0,0.06)' : 'none',
                  cursor: 'pointer',
                  transition: 'all 0.2s'
                }}
              >
                平台改善意见
              </button>
            </div>

            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              {mainTab === 'custom_report' ? (
                <>
                  {/* 次级研报类型单选 */}
                  <div style={{ display: 'flex', gap: '12px', marginBottom: '4px' }}>
                    <label style={{
                      flex: 1,
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      padding: '10px 14px',
                      borderRadius: '12px',
                      border: `1.5px solid ${reportSubTab === 'category_insight' ? 'var(--color-accent)' : '#e2e8f0'}`,
                      background: reportSubTab === 'category_insight' ? 'rgba(255, 100, 30, 0.04)' : '#f8fafc',
                      cursor: 'pointer',
                      fontSize: '0.83rem',
                      fontWeight: reportSubTab === 'category_insight' ? 600 : 400,
                      color: reportSubTab === 'category_insight' ? 'var(--color-accent)' : '#475569'
                    }}>
                      <input
                        type="radio"
                        name="reportSubTab"
                        checked={reportSubTab === 'category_insight'}
                        onChange={() => setReportSubTab('category_insight')}
                        style={{ accentColor: 'var(--color-accent)' }}
                      />
                      渠道品类调研
                    </label>
                    <label style={{
                      flex: 1,
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      padding: '10px 14px',
                      borderRadius: '12px',
                      border: `1.5px solid ${reportSubTab === 'company_insight' ? 'var(--color-accent)' : '#e2e8f0'}`,
                      background: reportSubTab === 'company_insight' ? 'rgba(255, 100, 30, 0.04)' : '#f8fafc',
                      cursor: 'pointer',
                      fontSize: '0.83rem',
                      fontWeight: reportSubTab === 'company_insight' ? 600 : 400,
                      color: reportSubTab === 'company_insight' ? 'var(--color-accent)' : '#475569'
                    }}>
                      <input
                        type="radio"
                        name="reportSubTab"
                        checked={reportSubTab === 'company_insight'}
                        onChange={() => setReportSubTab('company_insight')}
                        style={{ accentColor: 'var(--color-accent)' }}
                      />
                      企业战略洞察
                    </label>
                  </div>

                  {reportSubTab === 'category_insight' ? (
                    <>
                      <div>
                        <label style={{ fontSize: '0.78rem', color: '#64748b', marginBottom: '4px', display: 'block' }}>目标销售渠道</label>
                        <input
                          type="text"
                          placeholder="例如：Dollarama, Canadian Tire, Costco"
                          value={targetChannel}
                          onChange={e => setTargetChannel(e.target.value)}
                          style={inputStyle}
                          required
                        />
                      </div>
                      <div>
                        <label style={{ fontSize: '0.78rem', color: '#64748b', marginBottom: '4px', display: 'block' }}>具体产品名称</label>
                        <input
                          type="text"
                          placeholder="例如：泳帽, 手持风扇, 发光绿植环"
                          value={productName}
                          onChange={e => setProductName(e.target.value)}
                          style={inputStyle}
                          required
                        />
                      </div>
                      <div>
                        <label style={{ fontSize: '0.78rem', color: '#64748b', marginBottom: '4px', display: 'block' }}>目标市场 / 地区</label>
                        <input
                          type="text"
                          placeholder="例如：德国，法国，美国，澳大利亚"
                          value={categoryMarket}
                          onChange={e => setCategoryMarket(e.target.value)}
                          style={inputStyle}
                          required
                        />
                      </div>
                    </>
                  ) : (
                    <>
                      <div>
                        <label style={{ fontSize: '0.78rem', color: '#64748b', marginBottom: '4px', display: 'block' }}>目标公司名称</label>
                        <input
                          type="text"
                          placeholder="例如：Anker, Stanley, Makita"
                          value={companyName}
                          onChange={e => setCompanyName(e.target.value)}
                          style={inputStyle}
                          required
                        />
                      </div>
                      <div>
                        <label style={{ fontSize: '0.78rem', color: '#64748b', marginBottom: '4px', display: 'block' }}>公司官网地址</label>
                        <input
                          type="text"
                          placeholder="例如：www.anker.com"
                          value={companyUrl}
                          onChange={e => setCompanyUrl(e.target.value)}
                          style={inputStyle}
                          required
                        />
                      </div>
                      <div>
                        <label style={{ fontSize: '0.78rem', color: '#64748b', marginBottom: '4px', display: 'block' }}>目标市场 / 地区</label>
                        <input
                          type="text"
                          placeholder="例如：德国，法国，美国，澳大利亚"
                          value={companyMarket}
                          onChange={e => setCompanyMarket(e.target.value)}
                          style={inputStyle}
                          required
                        />
                      </div>
                    </>
                  )}
                </>
              ) : (
                <>
                  <div>
                    <label style={{ fontSize: '0.78rem', color: '#64748b', marginBottom: '4px', display: 'block' }}>意见分类</label>
                    <select
                      value={feedbackCategory}
                      onChange={e => setFeedbackCategory(e.target.value)}
                      style={{ ...inputStyle, cursor: 'pointer' }}
                    >
                      <option value="功能建议">功能建议</option>
                      <option value="UI/UX体验">界面与体验优化</option>
                      <option value="报告质量">研报质量与数据建议</option>
                      <option value="其他意见">其他想法</option>
                    </select>
                  </div>
                  <div>
                    <label style={{ fontSize: '0.78rem', color: '#64748b', marginBottom: '4px', display: 'block' }}>详细意见说明</label>
                    <textarea
                      placeholder="请详细描述您的宝贵建议或改进想法..."
                      value={feedbackContent}
                      onChange={e => setFeedbackContent(e.target.value)}
                      style={{ ...inputStyle, height: '100px', resize: 'none' }}
                      required
                    />
                  </div>
                </>
              )}

              {errorMsg && (
                <div style={{ fontSize: '0.8rem', color: '#ef4444', textAlign: 'center' }}>
                  {errorMsg}
                </div>
              )}

              <button
                type="submit"
                disabled={isSubmitting}
                className="sand-btn"
                style={{
                  padding: '12px',
                  fontSize: '0.92rem',
                  width: '100%',
                  marginTop: '6px',
                  opacity: isSubmitting ? 0.7 : 1,
                  cursor: isSubmitting ? 'not-allowed' : 'pointer'
                }}
              >
                {isSubmitting ? '正在提交中...' : '确认提交'}
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
