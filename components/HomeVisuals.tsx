import React, { useEffect, useRef } from 'react';

/**
 * 第 1 幕：360° 商业生态穿透罗盘 (立体球体环绕自转示意图)
 */
export function EcosystemRadar() {
  return (
    <div style={{
      position: 'relative',
      width: '100%',
      maxWidth: '460px',
      aspectRatio: '1 / 1',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      margin: '0 auto'
    }}>
      <style>{`
        @keyframes radarOrbitClockwise {
          0% {
            transform: rotate(0deg);
          }
          100% {
            transform: rotate(360deg);
          }
        }
        @keyframes radarCounterRotate {
          0% {
            transform: rotate(0deg);
          }
          100% {
            transform: rotate(-360deg);
          }
        }
        @keyframes pulseCoreGlow {
          0%, 100% {
            transform: scale(1);
            box-shadow: 0 14px 32px rgba(255, 100, 30, 0.22), 0 2px 8px rgba(0,0,0,0.04);
          }
          50% {
            transform: scale(1.03);
            box-shadow: 0 18px 40px rgba(255, 100, 30, 0.32), 0 4px 12px rgba(0,0,0,0.06);
          }
        }
        @keyframes waveFloat {
          0%, 100% {
            transform: translateY(0px);
          }
          50% {
            transform: translateY(-4px);
          }
        }
        @keyframes laserScanVertical {
          0% {
            top: 15%;
            opacity: 0.2;
          }
          50% {
            top: 75%;
            opacity: 0.9;
          }
          100% {
            top: 15%;
            opacity: 0.2;
          }
        }
        @keyframes rippleExpand {
          0% {
            transform: scale(0.85);
            opacity: 0.8;
          }
          100% {
            transform: scale(1.4);
            opacity: 0;
          }
        }
      `}</style>

      {/* 静态底盘与动态轨道网格 */}
      <svg
        viewBox="0 0 400 400"
        style={{
          position: 'absolute',
          inset: 0,
          width: '100%',
          height: '100%',
          overflow: 'visible'
        }}
      >
        <defs>
          <radialGradient id="radarGlow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#ff641e" stopOpacity="0.12" />
            <stop offset="65%" stopColor="#ff641e" stopOpacity="0.02" />
            <stop offset="100%" stopColor="#ff641e" stopOpacity="0" />
          </radialGradient>
        </defs>

        {/* 动态雷达扫描渐变区 */}
        <circle cx="200" cy="200" r="185" fill="url(#radarGlow)" />

        {/* 同心圆轨道 */}
        <circle cx="200" cy="200" r="175" fill="none" stroke="rgba(18, 18, 18, 0.04)" strokeWidth="1" strokeDasharray="3 3" />
        <circle cx="200" cy="200" r="130" fill="none" stroke="rgba(18, 18, 18, 0.08)" strokeWidth="1.2" />
        <circle cx="200" cy="200" r="75" fill="none" stroke="rgba(255, 100, 30, 0.2)" strokeWidth="1.2" strokeDasharray="4 3" />

        {/* 极坐标十字刻度线 */}
        <line x1="200" y1="20" x2="200" y2="380" stroke="rgba(18, 18, 18, 0.04)" strokeWidth="1" />
        <line x1="20" y1="200" x2="380" y2="200" stroke="rgba(18, 18, 18, 0.04)" strokeWidth="1" />
        <line x1="75" y1="75" x2="325" y2="325" stroke="rgba(18, 18, 18, 0.025)" strokeWidth="1" strokeDasharray="2 2" />
        <line x1="325" y1="75" x2="75" y2="325" stroke="rgba(18, 18, 18, 0.025)" strokeWidth="1" strokeDasharray="2 2" />

        {/* 轨道刻度微点 */}
        {[0, 45, 90, 135, 180, 225, 270, 315].map((deg) => {
          const rad = (deg * Math.PI) / 180;
          const cx = 200 + Math.cos(rad) * 130;
          const cy = 200 + Math.sin(rad) * 130;
          return <circle key={deg} cx={cx} cy={cy} r="2" fill="rgba(18, 18, 18, 0.15)" />;
        })}
      </svg>

      {/* 中心核心：目标客户 */}
      <div style={{
        position: 'relative',
        zIndex: 10,
        background: 'radial-gradient(circle at 35% 35%, #ffffff 0%, #fafafc 70%, #f0f0f4 100%)',
        border: '1.5px solid rgba(255, 100, 30, 0.6)',
        borderRadius: '50%',
        width: '94px',
        height: '94px',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        boxShadow: '0 14px 32px rgba(255, 100, 30, 0.22), 0 2px 8px rgba(0,0,0,0.04), inset 0 2px 4px rgba(255,255,255,0.9)',
        textAlign: 'center',
        animation: 'pulseCoreGlow 4s ease-in-out infinite'
      }}>
        <div style={{
          width: '7px',
          height: '7px',
          borderRadius: '50%',
          background: '#ff641e',
          marginBottom: '4px',
          boxShadow: '0 0 8px #ff641e'
        }} />
        <span style={{ fontSize: '0.82rem', fontWeight: 600, color: '#121212' }}>
          目标客户
        </span>
        <span style={{ fontSize: '0.6rem', color: '#ff641e', fontWeight: 500, letterSpacing: '0.5px' }}>
          360° CORE
        </span>
      </div>

      {/* 顺时针旋转容器 (半径 130px，承载 4 个立体球体) */}
      <div style={{
        position: 'absolute',
        inset: 0,
        width: '100%',
        height: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        animation: 'radarOrbitClockwise 36s linear infinite',
        pointerEvents: 'none'
      }}>
        {/* 动态引力连线 SVG */}
        <svg
          viewBox="0 0 400 400"
          style={{
            position: 'absolute',
            inset: 0,
            width: '100%',
            height: '100%',
            overflow: 'visible',
            pointerEvents: 'none'
          }}
        >
          <line x1="200" y1="200" x2="200" y2="70" stroke="rgba(255, 100, 30, 0.35)" strokeWidth="1.2" strokeDasharray="3 2" />
          <line x1="200" y1="200" x2="330" y2="200" stroke="rgba(18, 18, 18, 0.1)" strokeWidth="1.2" strokeDasharray="3 2" />
          <line x1="200" y1="200" x2="200" y2="330" stroke="rgba(18, 18, 18, 0.1)" strokeWidth="1.2" strokeDasharray="3 2" />
          <line x1="200" y1="200" x2="70" y2="200" stroke="rgba(18, 18, 18, 0.1)" strokeWidth="1.2" strokeDasharray="3 2" />
        </svg>

        {/* 球体通用样式生成 */}
        {(() => {
          const sphereStyle: React.CSSProperties = {
            position: 'absolute',
            width: '72px',
            height: '72px',
            borderRadius: '50%',
            background: 'radial-gradient(circle at 32% 28%, #ffffff 0%, #f6f6f8 50%, #e9e9ee 100%)',
            boxShadow: '0 12px 28px rgba(0, 0, 0, 0.08), 0 2px 6px rgba(0, 0, 0, 0.04), inset 0 2px 4px rgba(255, 255, 255, 0.95), inset 0 -2px 5px rgba(0, 0, 0, 0.06)',
            border: '1px solid rgba(255, 255, 255, 0.9)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            textAlign: 'center',
            animation: 'radarCounterRotate 36s linear infinite',
            pointerEvents: 'auto'
          };

          const textStyle: React.CSSProperties = {
            fontSize: '0.78rem',
            fontWeight: 350,
            color: '#555555',
            lineHeight: 1.25,
            letterSpacing: '1px',
            userSelect: 'none'
          };

          return (
            <>
              {/* 1. 上游供应 (Top: 0°) */}
              <div style={{ ...sphereStyle, top: '70px', left: '200px', transform: 'translate(-50%, -50%)' }}>
                <div style={textStyle}>
                  <div>上游</div>
                  <div>供应</div>
                </div>
              </div>

              {/* 2. 竞争格局 (Right: 90°) */}
              <div style={{ ...sphereStyle, top: '200px', left: '330px', transform: 'translate(-50%, -50%)' }}>
                <div style={textStyle}>
                  <div>竞争</div>
                  <div>格局</div>
                </div>
              </div>

              {/* 3. 下游渠道 (Bottom: 180°) */}
              <div style={{ ...sphereStyle, top: '330px', left: '200px', transform: 'translate(-50%, -50%)' }}>
                <div style={textStyle}>
                  <div>下游</div>
                  <div>渠道</div>
                </div>
              </div>

              {/* 4. 市场商机 (Left: 270°) */}
              <div style={{
                ...sphereStyle,
                top: '200px',
                left: '70px',
                transform: 'translate(-50%, -50%)',
                border: '1px solid rgba(255, 100, 30, 0.3)',
                boxShadow: '0 12px 28px rgba(255, 100, 30, 0.12), 0 2px 6px rgba(0, 0, 0, 0.04), inset 0 2px 4px rgba(255, 255, 255, 0.95), inset 0 -2px 5px rgba(255, 100, 30, 0.08)'
              }}>
                <div style={{ ...textStyle, color: '#444444' }}>
                  <div>市场</div>
                  <div>商机</div>
                </div>
              </div>
            </>
          );
        })()}
      </div>
    </div>
  );
}

/**
 * 第 2 幕：三大核心能力纯视觉正方形示意图 (1:1 统一画幅上滑轮播)
 */
export function FeatureCards({ activeIndex }: { activeIndex: number }) {
  const visualCards = [
    // 示意图 1：每周行业资讯 ──「多轨情报动态雷达波形图」 (1:1 正方形)
    {
      id: 0,
      visual: (
        <div style={{
          position: 'relative',
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          padding: '24px',
          boxSizing: 'border-box'
        }}>
          {/* 顶部：动态脉冲波形与雷达扫描小罗盘 */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div style={{
                width: '8px',
                height: '8px',
                borderRadius: '50%',
                background: '#ff641e',
                boxShadow: '0 0 8px #ff641e'
              }} />
              <span style={{ fontSize: '0.75rem', fontWeight: 600, color: '#121212', letterSpacing: '0.5px' }}>
                RADAR STREAM 24H
              </span>
            </div>
            <span style={{
              fontSize: '0.68rem',
              color: '#ff641e',
              background: 'rgba(255, 100, 30, 0.08)',
              border: '1px solid rgba(255, 100, 30, 0.2)',
              padding: '2px 8px',
              borderRadius: '8px',
              fontWeight: 500
            }}>
              实时情报流
            </span>
          </div>

          {/* 中部：SVG 实时动态正弦波形 */}
          <div style={{ position: 'relative', width: '100%', height: '80px', margin: '4px 0' }}>
            <svg viewBox="0 0 300 80" style={{ width: '100%', height: '100%', overflow: 'visible' }}>
              <defs>
                <linearGradient id="waveGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor="#121212" stopOpacity="0.1" />
                  <stop offset="50%" stopColor="#ff641e" stopOpacity="0.8" />
                  <stop offset="100%" stopColor="#121212" stopOpacity="0.1" />
                </linearGradient>
              </defs>
              {/* 背景参考网格 */}
              <line x1="0" y1="40" x2="300" y2="40" stroke="rgba(0,0,0,0.04)" strokeWidth="1" strokeDasharray="3 3" />
              {/* 波形曲线 */}
              <path
                d="M 0 40 Q 35 15 75 40 T 150 40 T 225 20 T 300 40"
                fill="none"
                stroke="url(#waveGrad)"
                strokeWidth="2"
                style={{ animation: 'waveFloat 3s ease-in-out infinite' }}
              />
              <path
                d="M 0 40 Q 45 60 95 40 T 180 50 T 260 30 T 300 40"
                fill="none"
                stroke="rgba(18, 18, 18, 0.15)"
                strokeWidth="1.2"
                strokeDasharray="4 2"
              />
              {/* 脉冲高亮点 */}
              <circle cx="150" cy="40" r="4" fill="#ff641e" />
              <circle cx="225" cy="20" r="3" fill="#121212" />
            </svg>
          </div>

          {/* 下部：3 条立体情报监测轨道 */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {[
              { label: '产品创新与设计预警', width: '85%', color: '#ff641e', status: 'ACTIVE' },
              { label: '渠道采购与配额扩增', width: '70%', color: '#121212', status: 'TRACKING' },
              { label: '高管变动与供应链重组', width: '60%', color: '#666666', status: 'ALERT' }
            ].map((track, i) => (
              <div
                key={i}
                style={{
                  background: 'rgba(0, 0, 0, 0.02)',
                  border: '1px solid rgba(0, 0, 0, 0.05)',
                  borderRadius: '10px',
                  padding: '8px 12px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '8px'
                }}
              >
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.72rem', color: '#555', marginBottom: '4px' }}>
                    <span>{track.label}</span>
                    <span style={{ fontSize: '0.65rem', fontFamily: 'monospace', color: track.color === '#ff641e' ? '#ff641e' : '#888' }}>{track.status}</span>
                  </div>
                  <div style={{ height: '4px', background: 'rgba(0,0,0,0.06)', borderRadius: '2px', overflow: 'hidden' }}>
                    <div style={{ width: track.width, height: '100%', background: track.color, borderRadius: '2px' }} />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )
    },

    // 示意图 2：客户 360° 洞察 ──「3D 悬浮透视分层穿透架构」 (1:1 正方形)
    {
      id: 1,
      visual: (
        <div style={{
          position: 'relative',
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '24px',
          boxSizing: 'border-box'
        }}>
          {/* 顶部状态标识 */}
          <div style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#ff641e' }} />
              <span style={{ fontSize: '0.75rem', fontWeight: 600, color: '#121212', letterSpacing: '0.5px' }}>
                BUYER PENETRATION
              </span>
            </div>
            <span style={{
              fontSize: '0.68rem',
              color: '#ff641e',
              background: 'rgba(255, 100, 30, 0.08)',
              border: '1px solid rgba(255, 100, 30, 0.2)',
              padding: '2px 8px',
              borderRadius: '8px',
              fontWeight: 500
            }}>
              3 层穿透透视图
            </span>
          </div>

          {/* 中部：3D 悬浮分层透视结构 */}
          <div style={{
            position: 'relative',
            width: '100%',
            height: '240px',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-around',
            alignItems: 'center'
          }}>
            {/* 垂直发光穿透轴线 */}
            <div style={{
              position: 'absolute',
              top: '10%',
              bottom: '10%',
              width: '2px',
              background: 'linear-gradient(to bottom, rgba(255,100,30,0.1), #ff641e, rgba(255,100,30,0.1))',
              zIndex: 1,
              left: '50%',
              transform: 'translateX(-50%)'
            }} />

            {/* 激光穿透扫描指示光球 */}
            <div style={{
              position: 'absolute',
              width: '8px',
              height: '8px',
              borderRadius: '50%',
              background: '#ff641e',
              boxShadow: '0 0 10px #ff641e',
              zIndex: 10,
              left: '50%',
              transform: 'translateX(-50%)',
              animation: 'laserScanVertical 4s ease-in-out infinite'
            }} />

            {/* 第 1 层：决策架构拓扑层 */}
            <div style={{
              position: 'relative',
              zIndex: 3,
              width: '88%',
              background: 'radial-gradient(circle at 30% 30%, #ffffff 0%, #f6f6f8 100%)',
              border: '1px solid rgba(18, 18, 18, 0.08)',
              borderRadius: '12px',
              padding: '10px 14px',
              boxShadow: '0 6px 16px rgba(0,0,0,0.04), inset 0 1px 2px rgba(255,255,255,0.9)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between'
            }}>
              <div style={{ fontSize: '0.75rem', fontWeight: 600, color: '#121212' }}>① 决策架构链</div>
              <div style={{ display: 'flex', gap: '6px' }}>
                <span style={{ width: '18px', height: '18px', borderRadius: '50%', background: 'rgba(0,0,0,0.06)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.6rem', color: '#666' }}>VP</span>
                <span style={{ color: '#ff641e', fontSize: '0.7rem' }}>→</span>
                <span style={{ width: '18px', height: '18px', borderRadius: '50%', background: 'rgba(255,100,30,0.15)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.6rem', color: '#ff641e', fontWeight: 600 }}>总监</span>
                <span style={{ color: '#ff641e', fontSize: '0.7rem' }}>→</span>
                <span style={{ width: '18px', height: '18px', borderRadius: '50%', background: 'rgba(0,0,0,0.06)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.6rem', color: '#666' }}>买手</span>
              </div>
            </div>

            {/* 第 2 层：财务状况体质层 */}
            <div style={{
              position: 'relative',
              zIndex: 3,
              width: '88%',
              background: 'radial-gradient(circle at 30% 30%, #ffffff 0%, #f6f6f8 100%)',
              border: '1px solid rgba(255, 100, 30, 0.25)',
              borderRadius: '12px',
              padding: '10px 14px',
              boxShadow: '0 6px 16px rgba(255,100,30,0.06), inset 0 1px 2px rgba(255,255,255,0.9)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between'
            }}>
              <div style={{ fontSize: '0.75rem', fontWeight: 600, color: '#ff641e' }}>② 财务健康评级</div>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#121212' }}>AA+</span>
                <span style={{ fontSize: '0.68rem', color: '#888' }}>预算规模 $2.4B</span>
              </div>
            </div>

            {/* 第 3 层：核心采购逻辑层 */}
            <div style={{
              position: 'relative',
              zIndex: 3,
              width: '88%',
              background: 'radial-gradient(circle at 30% 30%, #ffffff 0%, #f6f6f8 100%)',
              border: '1px solid rgba(18, 18, 18, 0.08)',
              borderRadius: '12px',
              padding: '10px 14px',
              boxShadow: '0 6px 16px rgba(0,0,0,0.04), inset 0 1px 2px rgba(255,255,255,0.9)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between'
            }}>
              <div style={{ fontSize: '0.75rem', fontWeight: 600, color: '#121212' }}>③ 采购逻辑匹配</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <div style={{ width: '48px', height: '6px', background: 'rgba(0,0,0,0.06)', borderRadius: '3px', overflow: 'hidden' }}>
                  <div style={{ width: '92%', height: '100%', background: '#10b981' }} />
                </div>
                <span style={{ fontSize: '0.7rem', fontWeight: 600, color: '#10b981' }}>92%</span>
              </div>
            </div>
          </div>

          <div style={{ fontSize: '0.68rem', color: '#999' }}>
            层层穿透 · 构筑立体客户画像
          </div>
        </div>
      )
    },

    // 示意图 3：品类 360° 洞察 ──「价格带分布与蓝海空白突破矩阵」 (1:1 正方形)
    {
      id: 2,
      visual: (
        <div style={{
          position: 'relative',
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          padding: '24px',
          boxSizing: 'border-box'
        }}>
          {/* 顶部状态标识 */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#ff641e' }} />
              <span style={{ fontSize: '0.75rem', fontWeight: 600, color: '#121212', letterSpacing: '0.5px' }}>
                WHITE SPACE MATRIX
              </span>
            </div>
            <span style={{
              fontSize: '0.68rem',
              color: '#ff641e',
              background: 'rgba(255, 100, 30, 0.08)',
              border: '1px solid rgba(255, 100, 30, 0.2)',
              padding: '2px 8px',
              borderRadius: '8px',
              fontWeight: 500
            }}>
              蓝海空白定位
            </span>
          </div>

          {/* 中部：坐标系与散点聚类示意图 */}
          <div style={{
            position: 'relative',
            width: '100%',
            height: '180px',
            background: 'rgba(0,0,0,0.015)',
            border: '1px solid rgba(0,0,0,0.06)',
            borderRadius: '12px',
            padding: '12px',
            boxSizing: 'border-box'
          }}>
            {/* 坐标轴与网格 */}
            <svg viewBox="0 0 280 150" style={{ width: '100%', height: '100%', overflow: 'visible' }}>
              {/* 坐标轴 */}
              <line x1="25" y1="130" x2="270" y2="130" stroke="rgba(0,0,0,0.15)" strokeWidth="1" />
              <line x1="25" y1="10" x2="25" y2="130" stroke="rgba(0,0,0,0.15)" strokeWidth="1" />

              {/* 坐标轴刻度标签 */}
              <text x="25" y="144" fontSize="8" fill="#888">$10</text>
              <text x="100" y="144" fontSize="8" fill="#888">$30</text>
              <text x="190" y="144" fontSize="8" fill="#ff641e" fontWeight="600">$55 (高溢价)</text>
              <text x="260" y="144" fontSize="8" fill="#888">$80</text>

              {/* 红海供给密集区 (左侧散点群) */}
              {[
                [45, 50], [55, 75], [60, 40], [70, 85], [75, 60], [85, 45], [90, 70], [95, 95]
              ].map(([cx, cy], idx) => (
                <circle key={idx} cx={cx} cy={cy} r="4" fill="rgba(18, 18, 18, 0.25)" />
              ))}
              <text x="50" y="30" fontSize="8" fill="#888">红海低价竞争区</text>

              {/* 蓝海空白点 (右侧高光橙色脉冲焦点) */}
              <circle cx="195" cy="45" r="18" fill="rgba(255, 100, 30, 0.12)" style={{ animation: 'rippleExpand 2.5s infinite' }} />
              <circle cx="195" cy="45" r="8" fill="#ff641e" />
              <circle cx="195" cy="45" r="4" fill="#ffffff" />
              <text x="160" y="22" fontSize="9" fill="#ff641e" fontWeight="bold">未满足蓝海空白</text>

              {/* 突破指引虚线 */}
              <path d="M 95 70 Q 140 70 195 45" fill="none" stroke="#ff641e" strokeWidth="1.5" strokeDasharray="3 2" />
            </svg>
          </div>

          {/* 底部：直观指引微指标 */}
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            background: 'rgba(255, 100, 30, 0.05)',
            border: '1px solid rgba(255, 100, 30, 0.15)',
            borderRadius: '8px',
            padding: '6px 12px',
            fontSize: '0.72rem'
          }}>
            <span style={{ color: '#666' }}>主流密集带 ($15 - $35)</span>
            <span style={{ color: '#ff641e', fontWeight: 600 }}>指引：锁定 $45+ 溢价区间</span>
          </div>
        </div>
      )
    }
  ];

  return (
    <div style={{
      position: 'relative',
      width: '100%',
      maxWidth: '440px',
      aspectRatio: '1 / 1', // 统一完全正方形画幅
      margin: '0 auto'
    }}>
      {visualCards.map((card, index) => {
        const offset = index - activeIndex;
        const isActive = index === activeIndex;
        const isPast = index < activeIndex;

        let translateY = offset * 28;
        let scale = 1 - Math.abs(offset) * 0.05;
        let opacity = isActive ? 1 : (isPast ? 0 : 0.25);
        let pointerEvents: 'auto' | 'none' = isActive ? 'auto' : 'none';

        if (isPast) {
          translateY = -70;
          opacity = 0;
        }

        return (
          <div
            key={card.id}
            style={{
              position: 'absolute',
              inset: 0,
              width: '100%',
              height: '100%',
              background: 'radial-gradient(circle at 35% 30%, #ffffff 0%, #fafafc 60%, #f2f2f6 100%)',
              border: isActive ? '1.5px solid rgba(255, 100, 30, 0.4)' : '1px solid rgba(18, 18, 18, 0.08)',
              borderRadius: '24px',
              boxShadow: isActive
                ? '0 24px 54px rgba(255, 100, 30, 0.12), 0 6px 18px rgba(0,0,0,0.04), inset 0 2px 4px rgba(255,255,255,0.95)'
                : '0 8px 24px rgba(0,0,0,0.03)',
              transform: `translateY(${translateY}px) scale(${scale})`,
              opacity,
              pointerEvents,
              transition: 'all 0.5s cubic-bezier(0.16, 1, 0.3, 1)',
              zIndex: 10 - Math.abs(offset)
            }}
          >
            {card.visual}
          </div>
        );
      })}
    </div>
  );
}

/**
 * 第 3 幕：类似 Obsidian 知识图谱的动态示意图 (Canvas 物理引力自旋网格)
 */
export function KnowledgeNetwork() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let width = 460;
    let height = 460;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    ctx.scale(dpr, dpr);

    // 定义 Obsidian 风格的节点集群
    const nodes = [
      { id: 'core', label: '商业知识大脑', x: 230, y: 230, r: 16, color: '#ff641e', isCore: true },
      { id: 'c1', label: '客户360°洞察', x: 140, y: 150, r: 9, color: '#121212' },
      { id: 'c2', label: '品类市场大盘', x: 320, y: 160, r: 9, color: '#121212' },
      { id: 'c3', label: '每周行业雷达', x: 150, y: 310, r: 8, color: '#121212' },
      { id: 'c4', label: '私人调研笔记', x: 310, y: 300, r: 8, color: '#ff641e' },
      { id: 'sub1', label: '北美买家线索', x: 80, y: 110, r: 5, color: '#888' },
      { id: 'sub2', label: '采购组织架构', x: 90, y: 190, r: 5, color: '#888' },
      { id: 'sub3', label: '欧洲包装新规', x: 210, y: 90, r: 5, color: '#888' },
      { id: 'sub4', label: '价格带空白分析', x: 380, y: 120, r: 5, color: '#ff641e' },
      { id: 'sub5', label: '沃尔玛直采动态', x: 100, y: 370, r: 5, color: '#888' },
      { id: 'sub6', label: '差异化选品灵感', x: 370, y: 360, r: 5, color: '#ff641e' },
      { id: 'sub7', label: '核心竞对档案', x: 240, y: 380, r: 5, color: '#888' }
    ];

    const links = [
      ['core', 'c1'], ['core', 'c2'], ['core', 'c3'], ['core', 'c4'],
      ['c1', 'sub1'], ['c1', 'sub2'], ['c2', 'sub3'], ['c2', 'sub4'],
      ['c3', 'sub5'], ['c4', 'sub6'], ['core', 'sub7'],
      ['c1', 'c2'], ['c3', 'c4'], ['sub2', 'sub5']
    ];

    let angle = 0;
    let animId = 0;

    const render = () => {
      ctx.clearRect(0, 0, width, height);

      // 微角度平滑自转与轻柔漂浮
      angle += 0.003;
      const centerX = width / 2;
      const centerY = height / 2;

      // 1. 绘制连线与粒子
      links.forEach(([srcId, tgtId]) => {
        const src = nodes.find(n => n.id === srcId)!;
        const tgt = nodes.find(n => n.id === tgtId)!;

        // 计算带微自转的坐标
        const cosA = Math.cos(angle * 0.5);
        const sinA = Math.sin(angle * 0.5);

        const sx = centerX + (src.x - centerX) * cosA - (src.y - centerY) * sinA;
        const sy = centerY + (src.x - centerX) * sinA + (src.y - centerY) * cosA;

        const tx = centerX + (tgt.x - centerX) * cosA - (tgt.y - centerY) * sinA;
        const ty = centerY + (tgt.x - centerX) * sinA + (tgt.y - centerY) * cosA;

        ctx.beginPath();
        ctx.moveTo(sx, sy);
        ctx.lineTo(tx, ty);
        ctx.strokeStyle = (src.color === '#ff641e' || tgt.color === '#ff641e')
          ? 'rgba(255, 100, 30, 0.25)'
          : 'rgba(18, 18, 18, 0.08)';
        ctx.lineWidth = src.isCore ? 1.5 : 1;
        ctx.stroke();
      });

      // 2. 绘制节点与 Obsidian 风格标签
      nodes.forEach((node) => {
        const cosA = Math.cos(angle * 0.5);
        const sinA = Math.sin(angle * 0.5);

        const nx = centerX + (node.x - centerX) * cosA - (node.y - centerY) * sinA;
        const ny = centerY + (node.x - centerX) * sinA + (node.y - centerY) * cosA;

        // 外层微光
        if (node.color === '#ff641e') {
          ctx.beginPath();
          ctx.arc(nx, ny, node.r + 4, 0, Math.PI * 2);
          ctx.fillStyle = 'rgba(255, 100, 30, 0.18)';
          ctx.fill();
        }

        // 实体圆点
        ctx.beginPath();
        ctx.arc(nx, ny, node.r, 0, Math.PI * 2);
        ctx.fillStyle = node.color;
        ctx.fill();

        // 节点标签文字
        ctx.font = node.isCore ? 'bold 11px system-ui' : '9px system-ui';
        ctx.fillStyle = node.isCore ? '#ff641e' : '#444444';
        ctx.textAlign = 'center';
        ctx.fillText(node.label, nx, ny + node.r + 12);
      });

      animId = requestAnimationFrame(render);
    };

    render();

    return () => {
      cancelAnimationFrame(animId);
    };
  }, []);

  return (
    <div style={{
      position: 'relative',
      width: '100%',
      maxWidth: '480px',
      aspectRatio: '1 / 1',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      margin: '0 auto',
      background: 'transparent'
    }}>
      <canvas
        ref={canvasRef}
        style={{
          width: '100%',
          height: '100%',
          display: 'block'
        }}
      />
    </div>
  );
}

/**
 * 第 4 幕：行动与邀请裂变面板 (无 emoji，商务纯净版)
 */
export function ActionPanel({
  userId,
  copied,
  onCopy,
  onShowAuthModal
}: {
  userId: string;
  copied: boolean;
  onCopy: () => void;
  onShowAuthModal: () => void;
}) {
  return (
    <div style={{
      background: '#ffffff',
      border: '1px solid rgba(255, 100, 30, 0.25)',
      borderRadius: '28px',
      padding: '44px 36px',
      maxWidth: '620px',
      width: '100%',
      margin: '0 auto',
      textAlign: 'center',
      boxShadow: '0 24px 60px rgba(255, 100, 30, 0.08), 0 4px 16px rgba(0,0,0,0.03)',
      position: 'relative'
    }}>
      {/* 顶部徽章 */}
      <div style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '6px',
        background: 'rgba(255, 100, 30, 0.08)',
        border: '1px solid rgba(255, 100, 30, 0.2)',
        borderRadius: '20px',
        padding: '6px 16px',
        fontSize: '0.8rem',
        fontWeight: 600,
        color: '#ff641e',
        marginBottom: '20px'
      }}>
        <span>邀请互惠计划</span>
        <span>·</span>
        <span>双方获赠深度报告解锁额度</span>
      </div>

      <h3 style={{
        fontSize: 'clamp(1.6rem, 5vw, 2.2rem)',
        fontWeight: 600,
        color: '#121212',
        margin: '0 0 14px 0'
      }}>
        开启你的知识之旅
      </h3>

      <p style={{
        fontSize: '1rem',
        color: '#666',
        lineHeight: 1.65,
        margin: '0 auto 32px auto',
        maxWidth: '480px',
        fontWeight: 400
      }}>
        邀请更多人加入，双方都将获得更多报告解锁机会。
      </p>

      {/* 操作按钮区 */}
      {userId ? (
        <div>
          <div style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: '10px',
            background: 'rgba(0,0,0,0.03)',
            border: '1px solid rgba(0,0,0,0.08)',
            borderRadius: '30px',
            padding: '6px 8px 6px 18px',
            alignItems: 'center',
            marginBottom: '16px'
          }}>
            <input
              type="text"
              readOnly
              value={`${typeof window !== 'undefined' ? window.location.origin : ''}/?invite=${userId}`}
              style={{
                flex: '1 1 200px',
                border: 'none',
                background: 'transparent',
                outline: 'none',
                fontSize: '0.85rem',
                color: '#444',
                fontFamily: 'monospace'
              }}
            />
            <button
              onClick={onCopy}
              style={{
                background: '#ff641e',
                color: '#ffffff',
                border: 'none',
                borderRadius: '24px',
                padding: '10px 22px',
                fontSize: '0.85rem',
                fontWeight: 600,
                cursor: 'pointer',
                boxShadow: '0 4px 12px rgba(255, 100, 30, 0.25)',
                transition: 'all 0.2s',
                whiteSpace: 'nowrap'
              }}
            >
              {copied ? '已复制专属链接' : '复制专属链接'}
            </button>
          </div>

          <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
            <a
              href="/reports"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                color: '#121212',
                fontSize: '0.9rem',
                fontWeight: 600,
                textDecoration: 'none',
                padding: '10px 20px',
                borderRadius: '20px',
                background: 'rgba(0,0,0,0.04)',
                transition: 'all 0.2s'
              }}
            >
              进入报告大厅
            </a>
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', alignItems: 'center' }}>
          <button
            onClick={onShowAuthModal}
            style={{
              background: '#ff641e',
              color: '#ffffff',
              border: 'none',
              borderRadius: '30px',
              padding: '14px 38px',
              fontSize: '1rem',
              fontWeight: 600,
              cursor: 'pointer',
              boxShadow: '0 10px 24px rgba(255, 100, 30, 0.3)',
              transition: 'all 0.2s'
            }}
          >
            免费注册 / 登录体验
          </button>
          <a
            href="/reports"
            style={{
              color: '#666',
              fontSize: '0.85rem',
              textDecoration: 'none',
              fontWeight: 500,
              padding: '6px 12px'
            }}
          >
            或先浏览报告大厅
          </a>
        </div>
      )}
    </div>
  );
}
