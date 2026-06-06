import React, { useState, useEffect } from 'react';

export default function ToolsPanel() {
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

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', padding: '20px', fontFamily: 'system-ui, sans-serif' }}>
      
      {/* 1. 汇率换算与 HS Code 检索 */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
        
        {/* 汇率 */}
        <div style={{ background: '#ffffff', border: '1px solid #d1d1d6', borderRadius: '12px', padding: '20px' }}>
          <h3 style={{ margin: '0 0 15px 0', fontSize: '1rem', color: '#1d1d1f' }}>💵 结汇汇率实时换算</h3>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', color: '#86868b', marginBottom: '15px' }}>
            <span>🇺🇸 美金 (USD): <b>{rates.USD}</b></span>
            <span>🇪🇺 欧元 (EUR): <b>{rates.EUR}</b></span>
            <span>🇬🇧 英镑 (GBP): <b>{rates.GBP}</b></span>
          </div>
          <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
            <input 
              type="number" 
              value={usdInput} 
              onChange={(e) => handleUsdChange(e.target.value)}
              style={{ flex: 1, padding: '8px', borderRadius: '6px', border: '1px solid #d1d1d6' }} 
              placeholder="输入美金 (USD)"
            />
            <span style={{ fontSize: '1.2rem' }}>≈</span>
            <div style={{ flex: 1, padding: '8px', background: '#f5f5f7', borderRadius: '6px', border: '1px solid #d1d1d6', fontWeight: 600 }}>
              ¥ {cnyResult} CNY
            </div>
          </div>
        </div>

        {/* HS Code */}
        <div style={{ background: '#ffffff', border: '1px solid #d1d1d6', borderRadius: '12px', padding: '20px' }}>
          <h3 style={{ margin: '0 0 12px 0', fontSize: '1rem', color: '#1d1d1f' }}>🏷️ HS Code 通关与退税率查询</h3>
          <div style={{ display: 'flex', gap: '8px', marginBottom: '15px' }}>
            <input 
              type="text" 
              value={hsQuery}
              onChange={(e) => setHsQuery(e.target.value)}
              placeholder="输入品类名称 (如 轮毂/刹车片)" 
              style={{ flex: 1, padding: '8px', borderRadius: '6px', border: '1px solid #d1d1d6', fontSize: '0.9rem' }}
            />
            <button 
              onClick={handleHsSearch}
              style={{ background: '#0071e3', color: '#fff', border: 'none', padding: '8px 16px', borderRadius: '6px', cursor: 'pointer', fontSize: '0.9rem' }}
            >
              查询
            </button>
          </div>
          {hsResult && (
            <div style={{ fontSize: '0.85rem', background: '#f5f5f7', padding: '12px', borderRadius: '8px' }}>
              <div style={{ marginBottom: '6px' }}><b>海关编码:</b> <span style={{ color: '#0071e3', fontWeight: 600 }}>{hsResult.code}</span></div>
              <div style={{ marginBottom: '6px' }}><b>申报品名:</b> {hsResult.name}</div>
              <div style={{ marginBottom: '6px' }}><b>出口退税率:</b> <span style={{ color: '#34c759', fontWeight: 600 }}>{hsResult.refund}</span></div>
              <div><b>监管条件:</b> {hsResult.condition}</div>
            </div>
          )}
        </div>
      </div>

      {/* 2. 时区看板与 AI 商品图美化 */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
        
        {/* 时区看板 */}
        <div style={{ background: '#ffffff', border: '1px solid #d1d1d6', borderRadius: '12px', padding: '20px' }}>
          <h3 style={{ margin: '0 0 15px 0', fontSize: '1rem', color: '#1d1d1f' }}>⏰ 海外客户时区与最佳沟通窗口</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {/* London */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.9rem' }}>
              <span>🇬🇧 英国伦敦 (GMT)</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontFamily: 'monospace', fontWeight: 600 }}>{times.London || '00:00:00'}</span>
                <span style={{
                  fontSize: '0.7rem',
                  padding: '2px 6px',
                  borderRadius: '4px',
                  background: isGoldenHour(times.London) ? '#e2fbe8' : '#fee2e2',
                  color: isGoldenHour(times.London) ? '#34c759' : '#ff3b30'
                }}>
                  {isGoldenHour(times.London) ? '🟢 推荐联络' : '🔴 客户休假'}
                </span>
              </div>
            </div>
            {/* New York */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.9rem' }}>
              <span>🇺🇸 美国纽约 (EST)</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontFamily: 'monospace', fontWeight: 600 }}>{times.NewYork || '00:00:00'}</span>
                <span style={{
                  fontSize: '0.7rem',
                  padding: '2px 6px',
                  borderRadius: '4px',
                  background: isGoldenHour(times.NewYork) ? '#e2fbe8' : '#fee2e2',
                  color: isGoldenHour(times.NewYork) ? '#34c759' : '#ff3b30'
                }}>
                  {isGoldenHour(times.NewYork) ? '🟢 推荐联络' : '🔴 客户休假'}
                </span>
              </div>
            </div>
            {/* Dubai */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.9rem' }}>
              <span>🇦🇪 阿联酋迪拜 (GST)</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontFamily: 'monospace', fontWeight: 600 }}>{times.Dubai || '00:00:00'}</span>
                <span style={{
                  fontSize: '0.7rem',
                  padding: '2px 6px',
                  borderRadius: '4px',
                  background: isGoldenHour(times.Dubai) ? '#e2fbe8' : '#fee2e2',
                  color: isGoldenHour(times.Dubai) ? '#34c759' : '#ff3b30'
                }}>
                  {isGoldenHour(times.Dubai) ? '🟢 推荐联络' : '🔴 客户休假'}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* AI 抠图 */}
        <div style={{ background: '#ffffff', border: '1px solid #d1d1d6', borderRadius: '12px', padding: '20px' }}>
          <h3 style={{ margin: '0 0 10px 0', fontSize: '1rem', color: '#1d1d1f' }}>📸 AI 商品图抠图美化 (展厅背景)</h3>
          <p style={{ margin: '0 0 15px 0', fontSize: '0.8rem', color: '#86868b' }}>随手拍上传车间实物照，一键提取产品边缘，并合成高端 3D 展台背景。</p>
          
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', border: '2px dashed #d1d1d6', borderRadius: '8px', height: '140px', background: '#f5f5f7', position: 'relative', overflow: 'hidden' }}>
            {uploading ? (
              <div style={{ textAlign: 'center' }}>
                <div style={{ border: '4px solid #f3f3f3', borderTop: '4px solid #0071e3', borderRadius: '50%', width: '30px', height: '30px', animation: 'spin 1s linear infinite', margin: '0 auto 10px auto' }} />
                <span style={{ fontSize: '0.85rem', color: '#86868b' }}>AI 智能抠图、优化光影与展厅背景融合中...</span>
                <style>{`@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }`}</style>
              </div>
            ) : processedUrl ? (
              <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                <span style={{ fontSize: '0.75rem', color: '#34c759', fontWeight: 600, marginBottom: '6px' }}>🎉 AI 展台级渲染图生成成功！</span>
                <button 
                  onClick={() => alert('已触发模拟下载')}
                  style={{ background: '#34c759', color: '#fff', border: 'none', padding: '6px 12px', borderRadius: '4px', fontSize: '0.8rem', cursor: 'pointer' }}
                >
                  💾 下载渲染高清图
                </button>
              </div>
            ) : (
              <div style={{ textAlign: 'center', cursor: 'pointer' }} onClick={handleImageUpload}>
                <div style={{ fontSize: '2rem', marginBottom: '8px' }}>📤</div>
                <span style={{ fontSize: '0.85rem', color: '#0071e3', fontWeight: 500 }}>点击选择或拖拽车间产品照</span>
              </div>
            )}
          </div>
        </div>

      </div>

    </div>
  );
}
