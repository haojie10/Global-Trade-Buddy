import React, { useState } from 'react';

interface LegalModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialTab?: 'data_compliance' | 'user_agreement';
}

export default function LegalModal({
  isOpen,
  onClose,
  initialTab = 'data_compliance'
}: LegalModalProps) {
  const [activeTab, setActiveTab] = useState<'data_compliance' | 'user_agreement'>(initialTab);

  React.useEffect(() => {
    if (isOpen) {
      setActiveTab(initialTab);
    }
  }, [isOpen, initialTab]);

  if (!isOpen) return null;

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100vw',
        height: '100vh',
        backgroundColor: 'rgba(9, 8, 8, 0.75)',
        backdropFilter: 'blur(10px)',
        WebkitBackdropFilter: 'blur(10px)',
        zIndex: 99999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '20px',
        boxSizing: 'border-box',
        animation: 'fadeIn 0.25s cubic-bezier(0.16, 1, 0.3, 1)'
      }}
      onClick={onClose}
    >
      <div
        style={{
          width: '100%',
          maxWidth: '760px',
          maxHeight: '85vh',
          backgroundColor: '#ffffff',
          borderRadius: '12px',
          border: '1px solid rgba(18, 18, 18, 0.08)',
          boxShadow: '0 24px 60px rgba(0, 0, 0, 0.2)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          animation: 'slideUp 0.3s cubic-bezier(0.16, 1, 0.3, 1)'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* 顶部标题栏与 Tab 切换（无 emoji） */}
        <div
          style={{
            padding: '20px 24px 14px 24px',
            borderBottom: '1px solid rgba(18, 18, 18, 0.06)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            backgroundColor: '#faf8f5'
          }}
        >
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <button
              onClick={() => setActiveTab('data_compliance')}
              style={{
                background: activeTab === 'data_compliance' ? 'var(--color-accent, #ff641e)' : 'transparent',
                color: activeTab === 'data_compliance' ? '#ffffff' : '#555555',
                border: 'none',
                padding: '7px 14px',
                borderRadius: '6px',
                fontSize: '0.86rem',
                fontWeight: activeTab === 'data_compliance' ? 500 : 400,
                cursor: 'pointer',
                transition: 'all 0.2s ease'
              }}
            >
              数据来源与合规声明
            </button>
            <button
              onClick={() => setActiveTab('user_agreement')}
              style={{
                background: activeTab === 'user_agreement' ? 'var(--color-accent, #ff641e)' : 'transparent',
                color: activeTab === 'user_agreement' ? '#ffffff' : '#555555',
                border: 'none',
                padding: '7px 14px',
                borderRadius: '6px',
                fontSize: '0.86rem',
                fontWeight: activeTab === 'user_agreement' ? 500 : 400,
                cursor: 'pointer',
                transition: 'all 0.2s ease'
              }}
            >
              用户服务与免责声明
            </button>
          </div>

          <button
            onClick={onClose}
            style={{
              background: 'transparent',
              border: 'none',
              fontSize: '1.1rem',
              color: '#888888',
              cursor: 'pointer',
              padding: '6px 8px',
              borderRadius: '4px',
              lineHeight: 1
            }}
            title="关闭"
          >
            ✕
          </button>
        </div>

        {/* 内容展示区 */}
        <div
          style={{
            padding: '24px 28px',
            overflowY: 'auto',
            color: '#222222',
            fontSize: '0.9rem',
            lineHeight: 1.75,
            fontWeight: 300
          }}
        >
          {activeTab === 'data_compliance' ? (
            <div>
              <h3 style={{ fontSize: '1.1rem', fontWeight: 600, color: '#111111', margin: '0 0 14px 0' }}>
                数据来源与采编合规说明
              </h3>
              <p style={{ marginBottom: '16px', color: '#444444' }}>
                Market Graphic（外贸智友）致力于为中国制造企业与外贸出海团队提供严谨、真实、高价值的商业智能与品类准入情报。本平台所有研报与资讯内容的生成，均严格遵循以下数据合规准则：
              </p>

              <div style={{ backgroundColor: '#fcfaf7', borderLeft: '3px solid var(--color-accent, #ff641e)', padding: '12px 16px', marginBottom: '16px', borderRadius: '0 6px 6px 0' }}>
                <strong style={{ color: '#111111', fontSize: '0.88rem' }}>1. 全球权威公开数据源</strong>
                <p style={{ margin: '4px 0 0 0', color: '#555555', fontSize: '0.85rem' }}>
                  本平台数据均来源于依法公开的全球渠道，包括各国海关进出口公报通报、跨国上市公司公开财务披露、欧盟符合性声明数据库（EU DoC）、国际行业协会权威公报（如 OPI、Insights-X、EOPA）以及主要海外零售渠道公开在架技术规范。
                </p>
              </div>

              <div style={{ backgroundColor: '#fcfaf7', borderLeft: '3px solid var(--color-accent, #ff641e)', padding: '12px 16px', marginBottom: '16px', borderRadius: '0 6px 6px 0' }}>
                <strong style={{ color: '#111111', fontSize: '0.88rem' }}>2. 算法清洗与交叉核验</strong>
                <p style={{ margin: '4px 0 0 0', color: '#555555', fontSize: '0.85rem' }}>
                  所有原始数据经过 AI 深度解析、事实交叉核验与多模态结构化推导，剥离噪点与虚假信息，为用户呈现高度提炼的供应链穿透全景与品类准入指南。
                </p>
              </div>

              <div style={{ backgroundColor: '#fcfaf7', borderLeft: '3px solid var(--color-accent, #ff641e)', padding: '12px 16px', marginBottom: '16px', borderRadius: '0 6px 6px 0' }}>
                <strong style={{ color: '#111111', fontSize: '0.88rem' }}>3. 知识产权保护与水印机制</strong>
                <p style={{ margin: '4px 0 0 0', color: '#555555', fontSize: '0.85rem' }}>
                  平台研报成果受中华人民共和国知识产权法保护，集成动态显性数字水印与隐形盲水印保护机制，严禁恶意抓取、翻录与倒卖。
                </p>
              </div>
            </div>
          ) : (
            <div>
              <h3 style={{ fontSize: '1.1rem', fontWeight: 600, color: '#111111', margin: '0 0 14px 0' }}>
                用户服务协议与商业免责声明
              </h3>
              
              <h4 style={{ fontSize: '0.95rem', fontWeight: 600, color: '#111111', marginTop: '16px', marginBottom: '6px' }}>
                1. 服务定位与参考性质
              </h4>
              <p style={{ color: '#444444', marginBottom: '14px' }}>
                外贸智友（Market Graphic）所提供的客户画像、供应链数据、行业资讯、品类准入分析及违约风险提示，<strong>仅供您的企业展业与商业决策参考，不构成我们对任何交易实体的担保、法律意见、投资建议或履约承诺。</strong>
              </p>

              <h4 style={{ fontSize: '0.95rem', fontWeight: 600, color: '#111111', marginTop: '16px', marginBottom: '6px' }}>
                2. 免责范围与自主决策
              </h4>
              <p style={{ color: '#444444', marginBottom: '14px' }}>
                由于国际贸易政策调整、海外买家经营状况变动以及算法推导的时效性，平台不对报告内容的绝对完整性与零误差作任何明示或暗示的法律保证。<strong>用户根据平台信息与海外买家进行的任何商业接洽、合同签署、备货生产、跨境运输或结汇支付，其商业风险、贸易纠纷及潜在损失均由交易各方自行评估并承担。</strong>
              </p>

              <h4 style={{ fontSize: '0.95rem', fontWeight: 600, color: '#111111', marginTop: '16px', marginBottom: '6px' }}>
                3. 合规使用与账号守则
              </h4>
              <p style={{ color: '#444444', marginBottom: '14px' }}>
                用户承诺通过合法正当途径使用本平台，严禁使用自动化脚本、网络爬虫恶意抓取未解锁研报或以群控手段刷取平台额度。一旦发现违规行为，平台有权采取包括冻结额度、终止服务并追究相应法律责任的措施。
              </p>

              <h4 style={{ fontSize: '0.95rem', fontWeight: 600, color: '#111111', marginTop: '16px', marginBottom: '6px' }}>
                4. 争议管辖
              </h4>
              <p style={{ color: '#444444', margin: 0 }}>
                本协议之订立、生效、解释与争议解决均适用中华人民共和国法律。如有任何争议，双方应友好协商，协商不成者均可向运营方所在地有管辖权的人民法院提起诉讼。
              </p>
            </div>
          )}
        </div>

        {/* 底部按钮 */}
        <div
          style={{
            padding: '14px 24px',
            borderTop: '1px solid rgba(18, 18, 18, 0.06)',
            display: 'flex',
            justifyContent: 'flex-end',
            backgroundColor: '#faf8f5'
          }}
        >
          <button
            onClick={onClose}
            style={{
              background: 'var(--color-accent, #ff641e)',
              color: '#ffffff',
              border: 'none',
              padding: '7px 20px',
              borderRadius: '6px',
              fontSize: '0.85rem',
              fontWeight: 500,
              cursor: 'pointer',
              transition: 'opacity 0.2s ease'
            }}
          >
            我已阅读并知晓
          </button>
        </div>
      </div>
    </div>
  );
}
