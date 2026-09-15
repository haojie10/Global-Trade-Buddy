import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';

interface FeedbackModalProps {
  isOpen: boolean;
  onClose: () => void;
  userId?: string | null;
  userEmail?: string;
  onShowAuthModal?: () => void;
  mode?: 'custom_report' | 'feedback';
}

export default function FeedbackModal({
  isOpen,
  onClose,
  userId,
  userEmail = '',
  onShowAuthModal,
  mode = 'custom_report'
}: FeedbackModalProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // 研报定制子类型: 'category_insight' (渠道品类调研) | 'company_insight' (企业战略洞察)
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

  // 多源获取客户端登录状态与用户邮箱
  const getClientLoginState = () => {
    let activeUserId = userId || null;
    let activeEmail = userEmail || '';

    if (typeof window !== 'undefined') {
      const cookies = document.cookie.split(';').reduce((acc, current) => {
        const [key, value] = current.trim().split('=');
        if (key && value) acc[key] = decodeURIComponent(value);
        return acc;
      }, {} as Record<string, string>);

      if (!activeUserId && cookies.gtb_user_id) {
        activeUserId = cookies.gtb_user_id;
      }
      if (!activeEmail && cookies.gtb_user_email) {
        activeEmail = cookies.gtb_user_email;
      }

      if (!activeUserId) {
        const localUid = localStorage.getItem('gtb_user_id');
        if (localUid) activeUserId = localUid;
      }
      if (!activeEmail) {
        const localEmail = localStorage.getItem('gtb_user_email');
        if (localEmail) activeEmail = localEmail;
      }
    }

    return {
      isLoggedIn: !!activeUserId || !!activeEmail,
      email: activeEmail
    };
  };

  const { isLoggedIn, email: boundEmail } = getClientLoginState();

  useEffect(() => {
    if (!isOpen) {
      setErrorMsg('');
      setIsSuccess(false);
    }
  }, [isOpen]);

  if (!isOpen || !mounted) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    if (!isLoggedIn) {
      setErrorMsg('您尚未登录，请先登录后再提交需求或反馈');
      if (onShowAuthModal) {
        onClose();
        onShowAuthModal();
      }
      return;
    }

    let requestType = 'feedback';
    let payload: any = {};

    if (mode === 'custom_report') {
      requestType = reportSubTab;
      if (reportSubTab === 'category_insight') {
        if (!targetChannel.trim() || !productName.trim() || !categoryMarket.trim()) {
          setErrorMsg('请填写完整的目标销售渠道、具体产品名称和目标市场');
          return;
        }
        payload = {
          target_channel: targetChannel.trim(),
          product_name: productName.trim(),
          category_market: categoryMarket.trim(),
        };
      } else {
        if (!companyName.trim() || !companyMarket.trim()) {
          setErrorMsg('请填写完整的企业名称和所属市场');
          return;
        }
        payload = {
          company_name: companyName.trim(),
          company_url: companyUrl.trim(),
          company_market: companyMarket.trim(),
        };
      }
    } else {
      if (!feedbackContent.trim()) {
        setErrorMsg('请填写具体的反馈建议内容');
        return;
      }
      payload = {
        category: feedbackCategory,
        content: feedbackContent.trim(),
      };
    }

    setIsSubmitting(true);
    try {
      const res = await fetch('/api/user/custom-request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          request_type: requestType,
          payload,
          user_email: boundEmail
        }),
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

  const modalContent = (
    <div 
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(15, 23, 42, 0.65)',
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 999999,
        padding: '20px',
        boxSizing: 'border-box'
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div 
        className="feedback-modal-content"
        style={{
          background: '#ffffff',
          borderRadius: '24px',
          width: '100%',
          maxWidth: '560px',
          maxHeight: 'min(90vh, 760px)',
          overflowY: 'auto',
          padding: '36px 32px',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
          position: 'relative',
          color: '#0f172a',
          boxSizing: 'border-box'
        }}
      >
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
          {mode === 'custom_report' ? '出海研报定向定制' : '产品问题与建议反馈'}
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
              {mode === 'custom_report'
                ? '定制需求已提交！管理员与 AI 智能体已接单，报告完成后您将收到邮件通知。'
                : '感谢您的宝贵反馈！管理员已收到通知，我们将在后续版本中持续改进优化。'}
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
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
            {/* 模式一：研报定制专属界面 (不含任何反馈tab) */}
            {mode === 'custom_report' && (
              <div>
                {/* 研报类型子页签 */}
                <div style={{ display: 'flex', gap: '10px', marginBottom: '18px' }}>
                  <button
                    type="button"
                    onClick={() => setReportSubTab('category_insight')}
                    style={{
                      flex: 1,
                      padding: '10px 14px',
                      borderRadius: '10px',
                      border: reportSubTab === 'category_insight' ? '1.5px solid #ff641e' : '1px solid #e2e8f0',
                      background: reportSubTab === 'category_insight' ? 'rgba(255, 100, 30, 0.05)' : '#ffffff',
                      color: reportSubTab === 'category_insight' ? '#ff641e' : '#64748b',
                      fontSize: '0.85rem',
                      fontWeight: reportSubTab === 'category_insight' ? 600 : 400,
                      cursor: 'pointer',
                      transition: 'all 0.2s'
                    }}
                  >
                    渠道品类深度调研
                  </button>
                  <button
                    type="button"
                    onClick={() => setReportSubTab('company_insight')}
                    style={{
                      flex: 1,
                      padding: '10px 14px',
                      borderRadius: '10px',
                      border: reportSubTab === 'company_insight' ? '1.5px solid #ff641e' : '1px solid #e2e8f0',
                      background: reportSubTab === 'company_insight' ? 'rgba(255, 100, 30, 0.05)' : '#ffffff',
                      color: reportSubTab === 'company_insight' ? '#ff641e' : '#64748b',
                      fontSize: '0.85rem',
                      fontWeight: reportSubTab === 'company_insight' ? 600 : 400,
                      cursor: 'pointer',
                      transition: 'all 0.2s'
                    }}
                  >
                    海外企业战略洞察
                  </button>
                </div>

                {reportSubTab === 'category_insight' ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 500, marginBottom: '6px' }}>
                        目标销售渠道 / 大卖场 <span style={{ color: '#ef4444' }}>*</span>
                      </label>
                      <input
                        type="text"
                        placeholder="例如: Dollarama, Target, Canadian Tire, Costco..."
                        value={targetChannel}
                        onChange={(e) => setTargetChannel(e.target.value)}
                        style={inputStyle}
                      />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 500, marginBottom: '6px' }}>
                        具体产品品类 / 名称 <span style={{ color: '#ef4444' }}>*</span>
                      </label>
                      <input
                        type="text"
                        placeholder="例如: 便携制冰机, 智能扫地机, 硅胶厨具..."
                        value={productName}
                        onChange={(e) => setProductName(e.target.value)}
                        style={inputStyle}
                      />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 500, marginBottom: '6px' }}>
                        目标国家或地区市场 <span style={{ color: '#ef4444' }}>*</span>
                      </label>
                      <input
                        type="text"
                        placeholder="例如: 美国, 加拿大, 德国, 欧洲..."
                        value={categoryMarket}
                        onChange={(e) => setCategoryMarket(e.target.value)}
                        style={inputStyle}
                      />
                    </div>
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 500, marginBottom: '6px' }}>
                        目标企业名称 <span style={{ color: '#ef4444' }}>*</span>
                      </label>
                      <input
                        type="text"
                        placeholder="例如: Anker, Stanley Black & Decker, SharkNinja..."
                        value={companyName}
                        onChange={(e) => setCompanyName(e.target.value)}
                        style={inputStyle}
                      />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 500, marginBottom: '6px' }}>
                        企业官方网址 (选填)
                      </label>
                      <input
                        type="text"
                        placeholder="例如: https://www.anker.com"
                        value={companyUrl}
                        onChange={(e) => setCompanyUrl(e.target.value)}
                        style={inputStyle}
                      />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 500, marginBottom: '6px' }}>
                        所属国家或主要运营市场 <span style={{ color: '#ef4444' }}>*</span>
                      </label>
                      <input
                        type="text"
                        placeholder="例如: 美国, 英国, 跨国企业..."
                        value={companyMarket}
                        onChange={(e) => setCompanyMarket(e.target.value)}
                        style={inputStyle}
                      />
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* 模式二：问题反馈专属界面 (不含任何定制tab) */}
            {mode === 'feedback' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 500, marginBottom: '6px' }}>
                    反馈分类
                  </label>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                    {['功能建议', '体验优化', '研报质量', '数据纠错', '其他问题'].map((cat) => (
                      <button
                        key={cat}
                        type="button"
                        onClick={() => setFeedbackCategory(cat)}
                        style={{
                          padding: '6px 14px',
                          borderRadius: '8px',
                          border: feedbackCategory === cat ? '1.5px solid #ff641e' : '1px solid #e2e8f0',
                          background: feedbackCategory === cat ? 'rgba(255, 100, 30, 0.08)' : '#f8fafc',
                          color: feedbackCategory === cat ? '#ff641e' : '#475569',
                          fontSize: '0.82rem',
                          fontWeight: feedbackCategory === cat ? 600 : 400,
                          cursor: 'pointer'
                        }}
                      >
                        {cat}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 500, marginBottom: '6px' }}>
                    详细反馈内容 <span style={{ color: '#ef4444' }}>*</span>
                  </label>
                  <textarea
                    rows={4}
                    placeholder="请详细描述您遇到的问题或宝贵的改善建议，帮助我们做得更好..."
                    value={feedbackContent}
                    onChange={(e) => setFeedbackContent(e.target.value)}
                    style={{ ...inputStyle, resize: 'vertical' }}
                  />
                </div>
              </div>
            )}

            {/* 账号通知提示 */}
            <div style={{
              background: '#f8fafc',
              border: '1px solid #e2e8f0',
              borderRadius: '12px',
              padding: '10px 14px',
              fontSize: '0.8rem',
              color: '#64748b',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}>
              <span>📧</span>
              <span>
                {isLoggedIn ? (
                  <>通知将发送至您的注册账号：<strong style={{ color: '#0f172a' }}>{boundEmail || '已登录账号'}</strong></>
                ) : (
                  <>提交前请先登录，以便接收处理进展通知与完成提醒</>
                )}
              </span>
            </div>

            {errorMsg && (
              <div style={{
                color: '#ef4444',
                fontSize: '0.85rem',
                background: '#fef2f2',
                border: '1px solid #fee2e2',
                padding: '8px 12px',
                borderRadius: '8px',
                textAlign: 'center'
              }}>
                {errorMsg}
              </div>
            )}

            <button
              type="submit"
              disabled={isSubmitting}
              className="sand-btn"
              style={{
                padding: '12px 24px',
                fontSize: '0.95rem',
                fontWeight: 600,
                marginTop: '6px',
                width: '100%',
                opacity: isSubmitting ? 0.7 : 1,
                cursor: isSubmitting ? 'not-allowed' : 'pointer'
              }}
            >
              {isSubmitting 
                ? '正在提交...' 
                : (mode === 'custom_report' ? '立即提交研报定制需求' : '提交反馈建议')}
            </button>
          </form>
        )}
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
}
