import React, { useState, useEffect } from 'react';

export default function ToolsPanel({ layout = 'column' }: { layout?: 'row' | 'column' }) {
  // 1. 汇率换算状态
  const [rates, setRates] = useState<Record<string, number>>({ USD: 7.24, EUR: 7.85, GBP: 9.18 });
  const [usdInput, setUsdInput] = useState('100');
  const [cnyResult, setCnyResult] = useState('724.00');

  // 2. HS Code 检索状态
  const [hsQuery, setHsQuery] = useState('');
  const [hsResult, setHsResult] = useState<any>(null);

  // 3. 时区状态
  const [times, setTimes] = useState<Record<string, string>>({});
  
  // 4. AI 抠图状态
  const [uploading, setUploading] = useState(false);
  const [processedUrl, setProcessedUrl] = useState('');

  // 初始化汇率与时区时钟
  useEffect(() => {
    // 调汇率 API
    fetch('/api/tools/currency')
      .then(res => res.json())
      .then(data => {
        if (data.success && data.rates) setRates(data.rates);
      })
      .catch(() => {});

    // 更新时区的定时器
    const updateClocks = () => {
      const getFormatTime = (timeZone: string) => {
        return new Intl.DateTimeFormat('zh-CN', {
          timeZone,
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
          hour12: false
        }).format(new Date());
      };
      setTimes({
        London: getFormatTime('Europe/London'),
        NewYork: getFormatTime('America/New_York'),
        Dubai: getFormatTime('Asia/Dubai'),
      });
    };

    updateClocks();
    const interval = setInterval(updateClocks, 1000);
    return () => clearInterval(interval);
  }, []);

  // 汇率计算
  const handleUsdChange = (val: string) => {
    setUsdInput(val);
    const num = parseFloat(val);
    if (!isNaN(num)) {
      setCnyResult((num * rates.USD).toFixed(2));
    } else {
      setCnyResult('0.00');
    }
  };

  // HS Code 检索模拟
  const handleHsSearch = () => {
    if (hsQuery.includes('轮毂')) {
      setHsResult({
        code: '8708.70.6000',
        name: '铝合金制车轮及其零附件 (轮毂)',
        refund: '13%',
        condition: 'A/B (需要进出口商品检验检疫)'
      });
    } else if (hsQuery.includes('刹车')) {
      setHsResult({
        code: '8708.30.9500',
        name: '装于底盘的制动器及其零件 (刹车片)',
        refund: '13%',
        condition: '无特殊商检监管'
      });
    } else {
      setHsResult({
        code: '未找到',
        name: '请尝试搜索“轮毂”或“刹车片”进行示例匹配',
        refund: '-',
        condition: '-'
      });
    }
  };

  // 模拟 AI 抠图美化上传
  const handleImageUpload = () => {
    setUploading(true);
    setProcessedUrl('');
    
    // 模拟 2.5 秒的云端 AI 抠图渲染计算
    setTimeout(() => {
      setUploading(false);
      setProcessedUrl('https://cdn.globaltradebuddy.com/studio/studio_render_demo_valve.png');
    }, 2500);
  };

  // 判定是否是客户上班联络黄金窗口 (上午9点到下午5点)
  const isGoldenHour = (timeStr: string) => {
    if (!timeStr) return false;
    const hour = parseInt(timeStr.split(':')[0]);
    return hour >= 9 && hour < 17;
  };

  const isRow = layout === 'row';

  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: isRow ? 'repeat(auto-fit, minmax(280px, 1fr))' : '1fr',
      gap: '20px',
      padding: isRow ? '0' : '0 20px 20px 20px',
      fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, sans-serif',
      width: '100%'
    }}>
      
      {/* 汇率 */}
      <div style={{
        background: 'rgba(255, 255, 255, 0.8)',
        border: '1px solid rgba(15, 23, 42, 0.08)',
        borderRadius: '16px',
        padding: '20px',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        boxShadow: '0 10px 30px rgba(15, 23, 42, 0.03)'
      }}>
        <h3 style={{
          margin: '0 0 15px 0',
          fontSize: '0.95rem',
          fontWeight: 500,
          color: '#0f172a',
          letterSpacing: '-0.3px'
        }}>
          结汇汇率实时换算
        </h3>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', color: '#64748b', marginBottom: '15px', fontWeight: 300 }}>
          <span>美金 (USD): <b style={{ color: '#0f172a', fontWeight: 400 }}>{rates.USD}</b></span>
          <span>欧元 (EUR): <b style={{ color: '#0f172a', fontWeight: 400 }}>{rates.EUR}</b></span>
          <span>英镑 (GBP): <b style={{ color: '#0f172a', fontWeight: 400 }}>{rates.GBP}</b></span>
        </div>
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          <input 
            type="number" 
            value={usdInput} 
            onChange={(e) => handleUsdChange(e.target.value)}
            style={{
              flex: 1,
              padding: '10px 12px',
              borderRadius: '30px',
              background: 'rgba(15, 23, 42, 0.03)',
              border: '1px solid rgba(15, 23, 42, 0.08)',
              color: '#0f172a',
              outline: 'none',
              fontSize: '0.85rem',
              fontWeight: 300,
              transition: 'border-color 0.2s'
            }} 
            placeholder="输入美金 (USD)"
            onFocus={(e) => e.target.style.borderColor = '#2563eb'}
            onBlur={(e) => e.target.style.borderColor = 'rgba(15, 23, 42, 0.08)'}
          />
          <span style={{ fontSize: '1.2rem', color: '#64748b', fontWeight: 300 }}>≈</span>
          <div style={{
            flex: 1,
            padding: '10px 16px',
            background: 'rgba(37, 99, 235, 0.04)',
            color: '#2563eb',
            borderRadius: '30px',
            border: '1px solid rgba(37, 99, 235, 0.12)',
            fontWeight: 500,
            fontSize: '0.85rem'
          }}>
            ¥ {cnyResult} CNY
          </div>
        </div>
      </div>

      {/* HS Code */}
      <div style={{
        background: 'rgba(255, 255, 255, 0.8)',
        border: '1px solid rgba(15, 23, 42, 0.08)',
        borderRadius: '16px',
        padding: '20px',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        boxShadow: '0 10px 30px rgba(15, 23, 42, 0.03)'
      }}>
        <h3 style={{
          margin: '0 0 12px 0',
          fontSize: '0.95rem',
          fontWeight: 500,
          color: '#0f172a',
          letterSpacing: '-0.3px'
        }}>
          HS Code 通关与退税率查询
        </h3>
        <div style={{ display: 'flex', gap: '8px', marginBottom: '15px' }}>
          <input 
            type="text" 
            value={hsQuery}
            onChange={(e) => setHsQuery(e.target.value)}
            placeholder="输入品类 (如 轮毂/刹车片)" 
            style={{
              flex: 1,
              padding: '10px 12px',
              borderRadius: '30px',
              background: 'rgba(15, 23, 42, 0.03)',
              border: '1px solid rgba(15, 23, 42, 0.08)',
              color: '#0f172a',
              outline: 'none',
              fontSize: '0.85rem',
              fontWeight: 300,
              transition: 'border-color 0.2s'
            }}
            onFocus={(e) => e.target.style.borderColor = '#2563eb'}
            onBlur={(e) => e.target.style.borderColor = 'rgba(15, 23, 42, 0.08)'}
          />
          <button 
            onClick={handleHsSearch}
            className="water-drop-btn"
            style={{
              padding: '10px 20px',
              fontSize: '0.85rem',
              fontWeight: 500
            }}
          >
            查询
          </button>
        </div>
        {hsResult && (
          <div style={{
            fontSize: '0.8rem',
            background: 'rgba(15, 23, 42, 0.02)',
            border: '1px solid rgba(15, 23, 42, 0.05)',
            padding: '14px',
            borderRadius: '12px',
            color: '#475569',
            fontWeight: 300
          }}>
            <div style={{ marginBottom: '6px' }}>
              <b style={{ color: '#0f172a', fontWeight: 400 }}>海关编码:</b> <span style={{ color: '#2563eb', fontWeight: 500 }}>{hsResult.code}</span>
            </div>
            <div style={{ marginBottom: '6px' }}><b style={{ color: '#0f172a', fontWeight: 400 }}>申报品名:</b> {hsResult.name}</div>
            <div style={{ marginBottom: '6px' }}>
              <b style={{ color: '#0f172a', fontWeight: 400 }}>出口退税率:</b> <span style={{ color: '#10b981', fontWeight: 500 }}>{hsResult.refund}</span>
            </div>
            <div><b style={{ color: '#0f172a', fontWeight: 400 }}>监管条件:</b> {hsResult.condition}</div>
          </div>
        )}
      </div>

      {/* 时区看板 */}
      <div style={{
        background: 'rgba(255, 255, 255, 0.8)',
        border: '1px solid rgba(15, 23, 42, 0.08)',
        borderRadius: '16px',
        padding: '20px',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        boxShadow: '0 10px 30px rgba(15, 23, 42, 0.03)'
      }}>
        <h3 style={{
          margin: '0 0 15px 0',
          fontSize: '0.95rem',
          fontWeight: 500,
          color: '#0f172a',
          letterSpacing: '-0.3px'
        }}>
          海外客户时区与沟通窗口
        </h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {/* London */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.85rem', color: '#334155', fontWeight: 300 }}>
            <span>英国伦敦 (GMT)</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontFamily: 'monospace', fontWeight: 400, color: '#0f172a', fontSize: '0.9rem' }}>{times.London || '00:00:00'}</span>
              <span style={{
                fontSize: '0.65rem',
                fontWeight: 500,
                padding: '4px 8px',
                borderRadius: '20px',
                background: isGoldenHour(times.London) ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.08)',
                color: isGoldenHour(times.London) ? '#059669' : '#dc2626'
              }}>
                {isGoldenHour(times.London) ? '🟢 黄金联络' : '🔴 客户休假'}
              </span>
            </div>
          </div>
          {/* New York */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.85rem', color: '#334155', fontWeight: 300 }}>
            <span>美国纽约 (EST)</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontFamily: 'monospace', fontWeight: 400, color: '#0f172a', fontSize: '0.9rem' }}>{times.NewYork || '00:00:00'}</span>
              <span style={{
                fontSize: '0.65rem',
                fontWeight: 500,
                padding: '4px 8px',
                borderRadius: '20px',
                background: isGoldenHour(times.NewYork) ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.08)',
                color: isGoldenHour(times.NewYork) ? '#059669' : '#dc2626'
              }}>
                {isGoldenHour(times.NewYork) ? '🟢 黄金联络' : '🔴 客户休假'}
              </span>
            </div>
          </div>
          {/* Dubai */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.85rem', color: '#334155', fontWeight: 300 }}>
            <span>阿联酋迪拜 (GST)</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontFamily: 'monospace', fontWeight: 400, color: '#0f172a', fontSize: '0.9rem' }}>{times.Dubai || '00:00:00'}</span>
              <span style={{
                fontSize: '0.65rem',
                fontWeight: 500,
                padding: '4px 8px',
                borderRadius: '20px',
                background: isGoldenHour(times.Dubai) ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.08)',
                color: isGoldenHour(times.Dubai) ? '#059669' : '#dc2626'
              }}>
                {isGoldenHour(times.Dubai) ? '🟢 黄金联络' : '🔴 客户休假'}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* AI 抠图 */}
      <div style={{
        background: 'rgba(255, 255, 255, 0.8)',
        border: '1px solid rgba(15, 23, 42, 0.08)',
        borderRadius: '16px',
        padding: '20px',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        boxShadow: '0 10px 30px rgba(15, 23, 42, 0.03)'
      }}>
        <h3 style={{
          margin: '0 0 10px 0',
          fontSize: '0.95rem',
          fontWeight: 500,
          color: '#0f172a',
          letterSpacing: '-0.3px'
        }}>
          AI 商品图抠图美化
        </h3>
        <p style={{ margin: '0 0 15px 0', fontSize: '0.75rem', color: '#64748b', lineHeight: 1.5, fontWeight: 300 }}>
          提取产品边缘，并智能融合合成高端 3D 展台背景。
        </p>
        
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          border: '2px dashed rgba(37, 99, 235, 0.2)',
          borderRadius: '12px',
          height: '145px',
          background: 'rgba(37, 99, 235, 0.015)',
          position: 'relative',
          overflow: 'hidden',
          transition: 'border-color 0.2s, background-color 0.2s'
        }}
        onMouseOver={(e) => {
          e.currentTarget.style.borderColor = '#2563eb';
          e.currentTarget.style.backgroundColor = 'rgba(37, 99, 235, 0.03)';
        }}
        onMouseOut={(e) => {
          e.currentTarget.style.borderColor = 'rgba(37, 99, 235, 0.2)';
          e.currentTarget.style.backgroundColor = 'rgba(37, 99, 235, 0.015)';
        }}
        >
          {uploading ? (
            <div style={{ textAlign: 'center', padding: '20px' }}>
              <div style={{
                border: '4px solid rgba(15, 23, 42, 0.06)',
                borderTop: '4px solid #2563eb',
                borderRadius: '50%',
                width: '32px',
                height: '32px',
                animation: 'spin 1s linear infinite',
                margin: '0 auto 12px auto'
              }} />
              <span style={{ fontSize: '0.8rem', color: '#64748b', fontWeight: 300 }}>AI 抠图渲染中...</span>
            </div>
          ) : processedUrl ? (
            <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
              <span style={{ fontSize: '0.75rem', color: '#059669', fontWeight: 500, marginBottom: '10px' }}>🎉 AI 渲染成功！</span>
              <button 
                onClick={() => alert('已触发模拟下载')}
                className="water-drop-btn"
                style={{
                  padding: '8px 16px',
                  fontSize: '0.75rem',
                  fontWeight: 500
                }}
              >
                💾 下载高清渲染图
              </button>
            </div>
          ) : (
            <div style={{ textAlign: 'center', cursor: 'pointer', padding: '20px' }} onClick={handleImageUpload}>
              <div style={{ fontSize: '1.8rem', marginBottom: '8px' }}>📤</div>
              <span style={{ fontSize: '0.8rem', color: '#2563eb', fontWeight: 400 }}>点击或拖拽产品照</span>
            </div>
          )}
        </div>
      </div>

    </div>
  );
}
