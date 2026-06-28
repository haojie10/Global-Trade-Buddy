import React from 'react';

interface ThemeCustomizerProps {
  isOpen: boolean;
  onClose: () => void;
  accentColor: string;
  setAccentColor: (color: string) => void;
  bgSub: string;
  setBgSub: (bg: string) => void;
  ambientOpacity: number;
  setAmbientOpacity: (opacity: number) => void;
  brandWeight: 'standard' | 'vibrant';
  setBrandWeight: (weight: 'standard' | 'vibrant') => void;
}

export default function ThemeCustomizer({
  isOpen,
  onClose,
  accentColor,
  setAccentColor,
  bgSub,
  setBgSub,
  ambientOpacity,
  setAmbientOpacity,
  brandWeight,
  setBrandWeight
}: ThemeCustomizerProps) {
  if (!isOpen) return null;

  return (
    <div style={{
      position: 'fixed',
      bottom: '100px',
      right: '30px',
      width: '360px',
      background: 'rgba(253, 251, 247, 0.85)',
      backdropFilter: 'blur(20px)',
      WebkitBackdropFilter: 'blur(20px)',
      border: '1px solid rgba(160, 109, 68, 0.08)',
      borderRadius: '24px',
      padding: '24px',
      boxShadow: '0 20px 50px rgba(160, 109, 68, 0.1)',
      zIndex: 1050,
      color: 'var(--color-text)',
      animation: 'float 0.4s cubic-bezier(0.16, 1, 0.3, 1)'
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <h3 className="font-editorial" style={{ margin: 0, fontSize: '1.25rem', fontWeight: 500 }}>
          实时色彩与视觉定制
        </h3>
        <button 
          onClick={onClose}
          style={{
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            color: 'var(--color-muted)',
            padding: '4px'
          }}
        >
          ✕
        </button>
      </div>

      {/* 预设选择 */}
      <div style={{ marginBottom: '20px' }}>
        <label style={{ fontSize: '0.8rem', color: 'var(--color-muted)', display: 'block', marginBottom: '8px' }}>配色预设</label>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '10px' }}>
          <button 
            onClick={() => { setAccentColor('#ff641e'); setBgSub('#f6f3ec'); }}
            style={{
              background: '#f6f3ec',
              border: accentColor === '#ff641e' ? '2px solid #ff641e' : '1px solid rgba(0,0,0,0.05)',
              padding: '8px',
              borderRadius: '12px',
              fontSize: '0.8rem',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}
          >
            <span style={{ width: '12px', height: '12px', background: '#ff641e', borderRadius: '50%', display: 'inline-block' }} />
            琥珀暖橘
          </button>
          <button 
            onClick={() => { setAccentColor('#d94126'); setBgSub('#f5efeb'); }}
            style={{
              background: '#f5efeb',
              border: accentColor === '#d94126' ? '2px solid #d94126' : '1px solid rgba(0,0,0,0.05)',
              padding: '8px',
              borderRadius: '12px',
              fontSize: '0.8rem',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}
          >
            <span style={{ width: '12px', height: '12px', background: '#d94126', borderRadius: '50%', display: 'inline-block' }} />
            焦糖朱红
          </button>
          <button 
            onClick={() => { setAccentColor('#e14d0a'); setBgSub('#fbf5ee'); }}
            style={{
              background: '#fbf5ee',
              border: accentColor === '#e14d0a' ? '2px solid #e14d0a' : '1px solid rgba(0,0,0,0.05)',
              padding: '8px',
              borderRadius: '12px',
              fontSize: '0.8rem',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}
          >
            <span style={{ width: '12px', height: '12px', background: '#e14d0a', borderRadius: '50%', display: 'inline-block' }} />
            盛夏夕阳
          </button>
          <button 
            onClick={() => { setAccentColor('#c23a3a'); setBgSub('#f8ecec'); }}
            style={{
              background: '#f8ecec',
              border: accentColor === '#c23a3a' ? '2px solid #c23a3a' : '1px solid rgba(0,0,0,0.05)',
              padding: '8px',
              borderRadius: '12px',
              fontSize: '0.8rem',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}
          >
            <span style={{ width: '12px', height: '12px', background: '#c23a3a', borderRadius: '50%', display: 'inline-block' }} />
            火山熔岩
          </button>
        </div>
      </div>

      {/* 细致调色 */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginBottom: '20px' }}>
        <div>
          <label style={{ fontSize: '0.8rem', color: 'var(--color-muted)', display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
            <span>自选强调色 (Accent)</span>
            <code>{accentColor}</code>
          </label>
          <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
            <input 
              type="color" 
              value={accentColor}
              onChange={(e) => setAccentColor(e.target.value)}
              style={{ width: '40px', height: '36px', border: 'none', borderRadius: '8px', cursor: 'pointer', background: 'none' }}
            />
            <input 
              type="text" 
              value={accentColor}
              onChange={(e) => setAccentColor(e.target.value)}
              style={{ flex: 1, padding: '8px 12px', fontSize: '0.85rem', border: '1px solid rgba(160,109,68,0.15)', borderRadius: '8px', background: '#ffffff', color: 'var(--color-text)' }}
            />
          </div>
        </div>

        <div>
          <label style={{ fontSize: '0.8rem', color: 'var(--color-muted)', display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
            <span>卡片副背景 (Bg Sub)</span>
            <code>{bgSub}</code>
          </label>
          <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
            <input 
              type="color" 
              value={bgSub}
              onChange={(e) => setBgSub(e.target.value)}
              style={{ width: '40px', height: '36px', border: 'none', borderRadius: '8px', cursor: 'pointer', background: 'none' }}
            />
            <input 
              type="text" 
              value={bgSub}
              onChange={(e) => setBgSub(e.target.value)}
              style={{ flex: 1, padding: '8px 12px', fontSize: '0.85rem', border: '1px solid rgba(160,109,68,0.15)', borderRadius: '8px', background: '#ffffff', color: 'var(--color-text)' }}
            />
          </div>
        </div>

        <div>
          <label style={{ fontSize: '0.8rem', color: 'var(--color-muted)', display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
            <span>背景流光浓度 (Glow)</span>
            <code>{Math.round(ambientOpacity * 100)}%</code>
          </label>
          <input 
            type="range" 
            min="0.0" 
            max="0.30" 
            step="0.01" 
            value={ambientOpacity}
            onChange={(e) => setAmbientOpacity(parseFloat(e.target.value))}
            style={{ width: '100%', accentColor: 'var(--color-accent)' }}
          />
        </div>

        {/* 品牌色背景占比 */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '8px', borderTop: '1px solid rgba(160,109,68,0.06)' }}>
          <div>
            <span style={{ fontSize: '0.85rem', fontWeight: 500, display: 'block' }}>品牌大色块背景</span>
            <span style={{ fontSize: '0.7rem', color: 'var(--color-muted)' }}>让 Hero 区与订阅区背景铺满强调色</span>
          </div>
          <button 
            onClick={() => setBrandWeight(brandWeight === 'vibrant' ? 'standard' : 'vibrant')}
            style={{
              background: brandWeight === 'vibrant' ? 'var(--color-accent)' : '#e2e8f0',
              color: brandWeight === 'vibrant' ? '#ffffff' : 'var(--color-text)',
              border: 'none',
              padding: '8px 16px',
              borderRadius: '20px',
              fontSize: '0.8rem',
              fontWeight: 500,
              cursor: 'pointer',
              boxShadow: brandWeight === 'vibrant' ? '0 4px 12px rgba(255, 100, 30, 0.2)' : 'none',
              transition: 'all 0.3s'
            }}
          >
            {brandWeight === 'vibrant' ? '已开启' : '已关闭'}
          </button>
        </div>
      </div>

      {/* 固化代码输出 */}
      <div style={{
        background: 'var(--bg-sub)',
        borderRadius: '12px',
        padding: '12px',
        fontSize: '0.75rem',
        border: '1px dashed rgba(160, 109, 68, 0.2)'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px', color: 'var(--color-muted)' }}>
          <span>固化配置代码</span>
          <button 
            onClick={() => {
              const configStr = `Accent: ${accentColor}\nBgSub: ${bgSub}\nGlow: ${ambientOpacity}\nWeight: ${brandWeight}`;
              navigator.clipboard.writeText(configStr);
              alert('配置代码已复制！请直接发送给 AI 助手进行固化保存。');
            }}
            style={{
              background: 'var(--color-accent)',
              color: '#ffffff',
              border: 'none',
              padding: '3px 8px',
              borderRadius: '4px',
              fontSize: '0.7rem',
              cursor: 'pointer',
              fontWeight: 500
            }}
          >
            点击复制
          </button>
        </div>
        <pre style={{ margin: 0, overflowX: 'auto', fontFamily: 'monospace', color: 'var(--color-text)' }}>
{`--color-accent: ${accentColor};
--bg-sub: ${bgSub};
--ambient-opacity: ${ambientOpacity};
--brand-weight: ${brandWeight};`}
        </pre>
      </div>
    </div>
  );
}
