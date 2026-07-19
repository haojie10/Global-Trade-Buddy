import React, { useState } from 'react';
import Head from 'next/head';

const fontOptions = [
  {
    id: 1,
    name: 'Playfair Display (雅致衬线体)',
    family: "'Playfair Display', serif",
    category: 'Serif (衬线)',
    desc: '传统高雅，充满社论和学术感。非常适合《金融时报》、彭博社等高端财经媒体的严肃质感。',
    exampleText: 'MG',
    fullName: 'Market Graphic'
  },
  {
    id: 2,
    name: 'Outfit (现代几何无衬线)',
    family: "'Outfit', sans-serif",
    category: 'Sans-serif (无衬线)',
    desc: '极简科技感，圆润现代。目前很多硅谷 AI 独角兽和前沿 SaaS 平台的首选几何设计风。',
    exampleText: 'MG',
    fullName: 'Market Graphic'
  },
  {
    id: 3,
    name: 'Cinzel (罗马古典石刻体)',
    family: "'Cinzel', serif",
    category: 'Serif (罗马衬线)',
    desc: '极高权威感与历史厚重感。字形端庄古典，展现跨国集团、世界级智库或金融巨擘的公信力。',
    exampleText: 'MG',
    fullName: 'Market Graphic'
  },
  {
    id: 4,
    name: 'Space Grotesk (工业科技风)',
    family: "'Space Grotesk', sans-serif",
    category: 'Sans-serif (科技单宽)',
    desc: '利落的极客工业风。兼具极强的极简结构 and 未来感，适合数据可视化和高科技分析工具。',
    exampleText: 'MG',
    fullName: 'Market Graphic'
  },
  {
    id: 5,
    name: 'Syne (先锋设计艺术体)',
    family: "'Syne', sans-serif",
    category: 'Display (艺术展示)',
    desc: '艺术先锋气息，宽扁且厚重，极具张力 and 年轻的设计感。适合时尚前沿、突破常规的平台。',
    exampleText: 'MG',
    fullName: 'Market Graphic'
  },
  {
    id: 6,
    name: 'Unbounded (无界未来粗体)',
    family: "'Unbounded', sans-serif",
    category: 'Display (潮流无衬线)',
    desc: '极端粗犷和未来无界感。强壮敦实，视觉冲击力极强，在导航栏中具有极高的识别度。',
    exampleText: 'MG',
    fullName: 'Market Graphic'
  },
  {
    id: 7,
    name: 'Cormorant Garamond (至臻奢华细衬线)',
    family: "'Cormorant Garamond', serif",
    category: 'Serif (人文衬线)',
    desc: '超纤细人文衬线，高贵优雅。笔锋极为细腻考究，充满人文主义和奢华的研究气质。',
    exampleText: 'MG',
    fullName: 'Market Graphic'
  },
  {
    id: 8,
    name: 'Inter (经典瑞士理性无衬线)',
    family: "'Inter', sans-serif",
    category: 'Sans-serif (理性中立)',
    desc: '中性、精准、绝对理性。极其标准的现代化文字排版，低调不张扬，突出专业数据工具属性。',
    exampleText: 'MG',
    fullName: 'Market Graphic'
  }
];

export default function LogoPreviewPage() {
  const [customText, setCustomText] = useState('MG');
  const [customSubText, setCustomSubText] = useState('Market Graphic');
  const [bgColor, setBgColor] = useState('dark'); // 'dark' | 'light'

  return (
    <div style={{
      minHeight: '100vh',
      background: bgColor === 'dark' ? '#090808' : '#f5f5f7',
      color: bgColor === 'dark' ? '#ffffff' : '#121212',
      fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
      padding: '40px 24px',
      transition: 'all 0.3s ease'
    }}>
      <Head>
        <title>Market Graphic - 品牌 LOGO 字体风格预览</title>
        <style dangerouslySetInnerHTML={{ __html: `
          @import url('https://fonts.googleapis.com/css2?family=Cinzel:wght@500;700;800&family=Cormorant+Garamond:ital,wght@0,500;0,700;1,500&family=Inter:wght@400;600;800&family=Outfit:wght@500;700;800&family=Playfair+Display:ital,wght@0,600;0,800;1,600&family=Space+Grotesk:wght@500;700&family=Syne:wght@700;800&family=Unbounded:wght@700;800&display=swap');
          
          .preview-card {
            border: 1px solid ${bgColor === 'dark' ? 'rgba(255,255,255,0.08)' : 'rgba(18,18,18,0.08)'};
            background: ${bgColor === 'dark' ? 'rgba(255,255,255,0.03)' : 'rgba(255,255,255,0.7)'};
            backdrop-filter: blur(15px);
            border-radius: 12px;
            padding: 24px;
            transition: all 0.3s ease;
          }
          
          .preview-card:hover {
            transform: translateY(-4px);
            box-shadow: 0 10px 30px ${bgColor === 'dark' ? 'rgba(0,0,0,0.5)' : 'rgba(0,0,0,0.05)'};
            border-color: #ff641e;
          }
        `}} />
      </Head>

      <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
        {/* 页头 */}
        <header style={{ marginBottom: '40px', borderBottom: `1px solid ${bgColor === 'dark' ? 'rgba(255,255,255,0.1)' : 'rgba(18,18,18,0.05)'}`, paddingBottom: '24px' }}>
          <h1 style={{ fontSize: '2.2rem', fontWeight: 500, margin: '0 0 12px 0', letterSpacing: '-0.5px' }}>
            品牌 LOGO 字体风格预览器 (Font Previewer)
          </h1>
          <p style={{ color: bgColor === 'dark' ? 'rgba(255,255,255,0.6)' : 'rgba(18,18,18,0.6)', margin: 0, lineHeight: 1.6, fontWeight: 300 }}>
            为了让左上角的 Logo 告别图片并直接使用动态的高保真矢量文字渲染，我们可以在这里直接预览各种顶级 Google Fonts 在品牌专属橙色（<span style={{ color: '#ff641e', fontWeight: 500 }}>#ff641e</span>）下的表现。请选择您最钟爱的字体风格方案并告诉智能体。
          </p>
        </header>

        {/* 交互控制台 */}
        <div style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: '24px',
          padding: '24px',
          background: bgColor === 'dark' ? 'rgba(255,255,255,0.05)' : 'rgba(18,18,18,0.02)',
          borderRadius: '12px',
          marginBottom: '40px',
          alignItems: 'center',
          justifyContent: 'space-between'
        }}>
          <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap', flex: 1 }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <label style={{ fontSize: '0.8rem', fontWeight: 600, color: '#ff641e' }}>Logo 首字母</label>
              <input 
                type="text" 
                value={customText} 
                onChange={(e) => setCustomText(e.target.value)}
                style={{
                  padding: '10px 16px',
                  background: bgColor === 'dark' ? '#121212' : '#ffffff',
                  border: '1px solid rgba(18,18,18,0.15)',
                  color: bgColor === 'dark' ? '#ffffff' : '#121212',
                  borderRadius: '8px',
                  fontSize: '0.9rem',
                  outline: 'none',
                  width: '120px'
                }}
              />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', flex: 1, minWidth: '200px' }}>
              <label style={{ fontSize: '0.8rem', fontWeight: 600, color: '#ff641e' }}>全称文字 (选填)</label>
              <input 
                type="text" 
                value={customSubText} 
                onChange={(e) => setCustomSubText(e.target.value)}
                style={{
                  padding: '10px 16px',
                  background: bgColor === 'dark' ? '#121212' : '#ffffff',
                  border: '1px solid rgba(18,18,18,0.15)',
                  color: bgColor === 'dark' ? '#ffffff' : '#121212',
                  borderRadius: '8px',
                  fontSize: '0.9rem',
                  outline: 'none',
                  width: '100%'
                }}
              />
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <span style={{ fontSize: '0.8rem', fontWeight: 600, color: '#ff641e' }}>切换背景底色</span>
            <div style={{ display: 'flex', background: 'rgba(0,0,0,0.1)', padding: '4px', borderRadius: '8px' }}>
              <button 
                onClick={() => setBgColor('dark')}
                style={{
                  padding: '8px 16px',
                  background: bgColor === 'dark' ? '#ff641e' : 'transparent',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontSize: '0.85rem',
                  fontWeight: 500,
                  transition: 'all 0.2s'
                }}
              >
                深色模式 (导航栏)
              </button>
              <button 
                onClick={() => setBgColor('light')}
                style={{
                  padding: '8px 16px',
                  background: bgColor === 'light' ? '#ff641e' : 'transparent',
                  color: bgColor === 'light' ? '#ffffff' : (bgColor === 'dark' ? 'rgba(255,255,255,0.6)' : '#121212'),
                  border: 'none',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontSize: '0.85rem',
                  fontWeight: 500,
                  transition: 'all 0.2s'
                }}
              >
                浅色模式 (画廊)
              </button>
            </div>
          </div>
        </div>

        {/* 字体展示网格 */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))',
          gap: '24px'
        }}>
          {fontOptions.map((opt) => (
            <div key={opt.id} className="preview-card">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                <span style={{ fontSize: '0.8rem', color: '#ff641e', fontWeight: 600, background: 'rgba(255,100,30,0.08)', padding: '4px 10px', borderRadius: '4px' }}>
                  方案 {opt.id}
                </span>
                <span style={{ fontSize: '0.75rem', opacity: 0.6 }}>{opt.category}</span>
              </div>
              
              <h3 style={{ fontSize: '1rem', margin: '0 0 8px 0', fontWeight: 500 }}>
                {opt.name}
              </h3>
              <p style={{ fontSize: '0.8rem', opacity: 0.7, margin: '0 0 20px 0', lineHeight: 1.5, minHeight: '36px' }}>
                {opt.desc}
              </p>

              {/* 渲染预览区 */}
              <div style={{
                background: bgColor === 'dark' ? '#121212' : '#ffffff',
                borderRadius: '8px',
                padding: '24px 16px',
                display: 'flex',
                flexDirection: 'column',
                gap: '12px',
                alignItems: 'center',
                justifyContent: 'center',
                border: `1px solid ${bgColor === 'dark' ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.04)'}`
              }}>
                {/* 缩写大字 Logo */}
                <div style={{
                  fontFamily: opt.family,
                  fontSize: '2.5rem',
                  color: '#ff641e',
                  fontWeight: 800,
                  letterSpacing: '-1px',
                  lineHeight: 1
                }}>
                  {customText}
                </div>

                {/* 组合 LOGO (首字母 + 细体英文) */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', borderTop: `1px dashed ${bgColor === 'dark' ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)'}`, paddingTop: '12px', width: '100%', justifyContent: 'center' }}>
                  <span style={{
                    fontFamily: opt.family,
                    fontSize: '1.4rem',
                    color: '#ff641e',
                    fontWeight: 800,
                    lineHeight: 1
                  }}>
                    {customText}
                  </span>
                  <span style={{
                    fontSize: '0.8rem',
                    fontWeight: 300,
                    color: bgColor === 'dark' ? '#ffffff' : '#121212',
                    letterSpacing: '1.5px',
                    textTransform: 'uppercase',
                    lineHeight: 1,
                    marginTop: '2px'
                  }}>
                    {customSubText}
                  </span>
                </div>
              </div>

              {/* 模拟顶栏预览 */}
              <div style={{ marginTop: '16px' }}>
                <span style={{ fontSize: '0.7rem', opacity: 0.5, display: 'block', marginBottom: '6px' }}>顶栏模拟 (Header Simulation):</span>
                <div style={{
                  background: bgColor === 'dark' ? 'rgba(0,0,0,0.3)' : '#eaeaea',
                  padding: '8px 12px',
                  borderRadius: '6px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span style={{ fontFamily: opt.family, fontSize: '1rem', color: '#ff641e', fontWeight: 800 }}>{customText}</span>
                    <span style={{ fontSize: '0.6rem', fontWeight: 300, color: bgColor === 'dark' ? '#fff' : '#121212', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{customSubText}</span>
                  </div>
                  <div style={{ display: 'flex', gap: '8px', fontSize: '0.6rem', opacity: 0.6 }}>
                    <span>资讯</span>
                    <span>大厅</span>
                    <span>图谱</span>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
        
        {/* 底部导航 */}
        <footer style={{ marginTop: '60px', textAlign: 'center', borderTop: `1px solid ${bgColor === 'dark' ? 'rgba(255,255,255,0.1)' : 'rgba(18,18,18,0.05)'}`, paddingTop: '24px', paddingBottom: '40px' }}>
          <button 
            onClick={() => window.location.href = '/'}
            style={{
              padding: '10px 24px',
              background: 'transparent',
              border: '1px solid rgba(18, 18, 18, 0.15)',
              color: bgColor === 'dark' ? '#ffffff' : '#121212',
              borderRadius: '8px',
              cursor: 'pointer',
              fontSize: '0.9rem',
              fontWeight: 500
            }}
          >
            返回主页
          </button>
        </footer>
      </div>
    </div>
  );
}
