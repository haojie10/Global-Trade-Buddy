import React from 'react';

interface MembershipTiersSectionProps {
  userId?: string | null;
  userRole?: string;
  memberType?: string;
  onSelectTier?: (tier: 'free' | 'pro' | 'enterprise') => void;
  onShowAuthModal?: () => void;
}

export default function MembershipTiersSection({
  userId,
  userRole,
  memberType = 'free',
  onSelectTier,
  onShowAuthModal
}: MembershipTiersSectionProps) {
  const isPro = memberType === 'pro';

  return (
    <section id="membership-tiers" style={{
      maxWidth: '1200px',
      margin: '60px auto 40px auto',
      padding: '0 24px',
      color: '#121212'
    }}>
      <div style={{ textAlign: 'center', marginBottom: '48px' }}>
        <div style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '6px',
          padding: '5px 16px',
          borderRadius: '9999px',
          background: 'rgba(255, 100, 30, 0.08)',
          border: '1px solid rgba(255, 100, 30, 0.25)',
          color: '#ff641e',
          fontSize: '0.85rem',
          fontWeight: 600,
          marginBottom: '16px'
        }}>
          💎 推广期权益特惠 · 阶梯赋能出海团队
        </div>
        <h2 style={{
          fontSize: 'clamp(1.8rem, 4vw, 2.4rem)',
          fontWeight: 700,
          letterSpacing: '-0.5px',
          marginBottom: '14px',
          color: '#121212'
        }}>
          选择适合您出海业务的研报方案
        </h2>
        <p style={{
          color: '#64748b',
          fontSize: '1rem',
          maxWidth: '650px',
          margin: '0 auto',
          lineHeight: 1.6
        }}>
          从初探海外买家画像到深度穿透全球供应链拓扑网络，为您提供高确定性的海外大客户决策情报。
        </p>
      </div>

      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
        gap: '24px',
        alignItems: 'stretch'
      }}>
        {/* Tier 1: 免费版 Free */}
        <div style={{
          background: '#ffffff',
          border: '1px solid rgba(18, 18, 18, 0.08)',
          borderRadius: '20px',
          padding: '36px 28px',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          position: 'relative',
          boxShadow: '0 10px 30px rgba(0, 0, 0, 0.03)',
          transition: 'all 0.3s ease'
        }}>
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <span style={{ fontSize: '1.25rem', fontWeight: 700, color: '#121212' }}>免费版 (Free)</span>
              <span style={{
                background: 'rgba(16, 185, 129, 0.12)',
                color: '#059669',
                border: '1px solid rgba(16, 185, 129, 0.25)',
                padding: '2px 10px',
                borderRadius: '6px',
                fontSize: '0.78rem',
                fontWeight: 600
              }}>
                推广期专享
              </span>
            </div>
            <div style={{ marginBottom: '20px' }}>
              <span style={{ fontSize: '2.5rem', fontWeight: 800, color: '#121212' }}>¥0</span>
              <span style={{ color: '#64748b', fontSize: '0.9rem', marginLeft: '6px' }}>/ 永久免费</span>
            </div>
            <p style={{ color: '#64748b', fontSize: '0.92rem', marginBottom: '24px', lineHeight: 1.5 }}>
              零门槛体验海外买家分析，沉淀基础客户资产与知识图谱。
            </p>

            <div style={{ height: '1px', background: 'rgba(18, 18, 18, 0.08)', marginBottom: '24px' }} />

            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', fontSize: '0.92rem', color: '#334155' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <span style={{ color: '#059669', fontWeight: 700 }}>✓</span>
                <span><b>10 次</b> 深度研报在线解锁 (注册立领)</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <span style={{ color: '#059669', fontWeight: 700 }}>✓</span>
                <span><b>🎁 5 份</b> HTML 离线完整报告下载 (推广期特权)</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <span style={{ color: '#059669', fontWeight: 700 }}>✓</span>
                <span><b>已解锁报告无限制收藏</b> 与 3 级拓扑网图</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <span style={{ color: '#059669', fontWeight: 700 }}>✓</span>
                <span><b>无限制</b> 专属研报笔记与跟进记录</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <span style={{ color: '#059669', fontWeight: 700 }}>✓</span>
                <span>邀请好友双方各得 <b>+3 次</b> 解锁额度</span>
              </div>
            </div>
          </div>

          <div style={{ marginTop: '36px' }}>
            {!userId ? (
              <button
                onClick={() => onShowAuthModal?.()}
                style={{
                  width: '100%',
                  padding: '12px',
                  borderRadius: '10px',
                  border: '1px solid rgba(18, 18, 18, 0.15)',
                  background: '#f8fafc',
                  color: '#121212',
                  fontSize: '0.95rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  transition: 'all 0.2s ease'
                }}
                onMouseOver={(e) => (e.currentTarget.style.background = '#f1f5f9')}
                onMouseOut={(e) => (e.currentTarget.style.background = '#f8fafc')}
              >
                免费注册领取
              </button>
            ) : (
              <button
                disabled
                style={{
                  width: '100%',
                  padding: '12px',
                  borderRadius: '10px',
                  border: '1px solid rgba(18, 18, 18, 0.1)',
                  background: '#f8fafc',
                  color: '#94a3b8',
                  fontSize: '0.92rem',
                  cursor: 'default'
                }}
              >
                {!isPro ? '当前等级 (已激活)' : '包含在 Pro 权益内'}
              </button>
            )}
          </div>
        </div>

        {/* Tier 2: 专业版 Pro (高亮推荐) */}
        <div style={{
          background: 'linear-gradient(180deg, #ffffff 0%, #fffaf5 100%)',
          border: '2px solid #ff641e',
          borderRadius: '20px',
          padding: '36px 28px',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          position: 'relative',
          boxShadow: '0 16px 45px rgba(255, 100, 30, 0.12)',
          transform: 'scale(1.02)',
          zIndex: 2
        }}>
          <div style={{
            position: 'absolute',
            top: '-13px',
            right: '24px',
            background: 'linear-gradient(135deg, #ff641e, #ea580c)',
            color: '#fff',
            padding: '4px 14px',
            borderRadius: '9999px',
            fontSize: '0.78rem',
            fontWeight: 700,
            letterSpacing: '0.5px',
            boxShadow: '0 4px 12px rgba(255, 100, 30, 0.3)'
          }}>
            ★ 业务骨干首选
          </div>

          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <span style={{ fontSize: '1.25rem', fontWeight: 800, color: '#ff641e' }}>专业版 (Pro)</span>
              <span style={{
                background: 'rgba(255, 100, 30, 0.1)',
                color: '#ff641e',
                border: '1px solid rgba(255, 100, 30, 0.25)',
                padding: '2px 8px',
                borderRadius: '6px',
                fontSize: '0.78rem',
                fontWeight: 600
              }}>
                月度充能
              </span>
            </div>
            <div style={{ marginBottom: '20px' }}>
              <span style={{ fontSize: '2.5rem', fontWeight: 800, color: '#121212' }}>¥199</span>
              <span style={{ color: '#64748b', fontSize: '0.9rem', marginLeft: '6px' }}>/ 月 (按开通日计期)</span>
            </div>
            <p style={{ color: '#64748b', fontSize: '0.92rem', marginBottom: '24px', lineHeight: 1.5 }}>
              面向重度外贸业务员、SOHO 及出海团队的高频情报生产力。
            </p>

            <div style={{ height: '1px', background: 'rgba(255, 100, 30, 0.15)', marginBottom: '24px' }} />

            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', fontSize: '0.92rem', color: '#1e293b' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <span style={{ color: '#ff641e', fontWeight: 700 }}>✓</span>
                <span><b>50 次 / 月</b> 深度研报在线解锁 (周期自动充能)</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <span style={{ color: '#ff641e', fontWeight: 700 }}>✓</span>
                <span><b>10 份 / 月</b> HTML 完整离线报告下载归档</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <span style={{ color: '#ff641e', fontWeight: 700 }}>✓</span>
                <span><b>全局行业实体拓扑图谱</b> 自由穿透探查</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <span style={{ color: '#ff641e', fontWeight: 700 }}>✓</span>
                <span><b>全功能无限制笔记</b> 与客户画像线索沉淀</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <span style={{ color: '#ff641e', fontWeight: 700 }}>★</span>
                <span><b>专属裂变返佣</b>：邀请立赠 <b>+10 解锁 + 2 离线下载</b></span>
              </div>
            </div>
          </div>

          <div style={{ marginTop: '36px' }}>
            <button
              onClick={() => onSelectTier ? onSelectTier('pro') : onShowAuthModal?.()}
              style={{
                width: '100%',
                padding: '13px',
                borderRadius: '10px',
                border: 'none',
                background: 'linear-gradient(135deg, #ff641e 0%, #ea580c 100%)',
                color: '#ffffff',
                fontSize: '1rem',
                fontWeight: 700,
                cursor: 'pointer',
                boxShadow: '0 4px 16px rgba(255, 100, 30, 0.35)',
                transition: 'transform 0.15s ease'
              }}
              onMouseOver={(e) => (e.currentTarget.style.transform = 'scale(1.02)')}
              onMouseOut={(e) => (e.currentTarget.style.transform = 'scale(1)')}
            >
              {isPro ? '👑 已是专业版尊贵会员' : '立即开通 / 升级 Pro'}
            </button>
          </div>
        </div>

        {/* Tier 3: 企业版 Enterprise */}
        <div style={{
          background: '#ffffff',
          border: '1px solid rgba(18, 18, 18, 0.08)',
          borderRadius: '20px',
          padding: '36px 28px',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          position: 'relative',
          boxShadow: '0 10px 30px rgba(0, 0, 0, 0.03)'
        }}>
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <span style={{ fontSize: '1.25rem', fontWeight: 700, color: '#121212' }}>企业版 (Enterprise)</span>
              <span style={{
                background: 'rgba(59, 130, 246, 0.1)',
                color: '#2563eb',
                border: '1px solid rgba(59, 130, 246, 0.25)',
                padding: '2px 8px',
                borderRadius: '6px',
                fontSize: '0.78rem',
                fontWeight: 600
              }}>
                多账号池
              </span>
            </div>
            <div style={{ marginBottom: '20px' }}>
              <span style={{ fontSize: '2.5rem', fontWeight: 800, color: '#121212' }}>定制咨询</span>
            </div>
            <p style={{ color: '#64748b', fontSize: '0.92rem', marginBottom: '24px', lineHeight: 1.5 }}>
              为工贸一体制造厂、出海品牌商及跨境大团队提供行业私有化图谱。
            </p>

            <div style={{ height: '1px', background: 'rgba(18, 18, 18, 0.08)', marginBottom: '24px' }} />

            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', fontSize: '0.92rem', color: '#334155' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <span style={{ color: '#2563eb', fontWeight: 700 }}>✓</span>
                <span><b>300+ 次 / 月</b> 团队共享解锁额度池</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <span style={{ color: '#2563eb', fontWeight: 700 }}>✓</span>
                <span><b>50+ 份 / 月</b> 离线下载与批量导出</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <span style={{ color: '#2563eb', fontWeight: 700 }}>✓</span>
                <span>多子账号统一管理与协同笔记共享</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <span style={{ color: '#2563eb', fontWeight: 700 }}>✓</span>
                <span>企业私有产业链拓扑网络定制</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <span style={{ color: '#2563eb', fontWeight: 700 }}>✓</span>
                <span>1v1 专属出海战略顾问服务</span>
              </div>
            </div>
          </div>

          <div style={{ marginTop: '36px' }}>
            <button
              onClick={() => {
                alert('请联系客服或发送邮件至 contact@marketgraphic.cn 咨询企业团队定制方案。');
              }}
              style={{
                width: '100%',
                padding: '12px',
                borderRadius: '10px',
                border: '1px solid rgba(59, 130, 246, 0.3)',
                background: 'rgba(59, 130, 246, 0.06)',
                color: '#2563eb',
                fontSize: '0.95rem',
                fontWeight: 600,
                cursor: 'pointer',
                transition: 'all 0.2s ease'
              }}
              onMouseOver={(e) => (e.currentTarget.style.background = 'rgba(59, 130, 246, 0.12)')}
              onMouseOut={(e) => (e.currentTarget.style.background = 'rgba(59, 130, 246, 0.06)')}
            >
              联系企业顾问定制 →
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
