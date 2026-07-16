import React from 'react';

interface MGLogoProps {
  height?: number | string;
  className?: string;
  color?: string;
}

export default function MGLogo({ height = 24, className = '', color = 'var(--color-accent)' }: MGLogoProps) {
  // 保持 5:3 的高宽比 (120 / 72)
  const calculatedWidth = typeof height === 'number' ? Math.round(height * (120 / 72)) : undefined;

  return (
    <svg 
      xmlns="http://www.w3.org/2000/svg" 
      viewBox="0 -4 120 68" 
      height={height}
      width={calculatedWidth}
      className={className}
      fill="none"
      style={{ display: 'inline-block', verticalAlign: 'middle' }}
    >
      {/* 字母 M */}
      <path 
        d="M 12,42 L 12,18 L 24,32 L 36,18 L 36,42" 
        stroke={color} 
        strokeWidth="3.5" 
        strokeLinejoin="round" 
        strokeLinecap="round" 
      />

      {/* 中间图谱取景框 [ • ] */}
      {/* 左括号 */}
      <path 
        d="M 55,20 H 50 V 40 H 55" 
        stroke={color} 
        strokeWidth="2.5" 
        strokeLinejoin="round" 
        strokeLinecap="round" 
      />
      {/* 右括号 */}
      <path 
        d="M 65,20 H 70 V 40 H 65" 
        stroke={color} 
        strokeWidth="2.5" 
        strokeLinejoin="round" 
        strokeLinecap="round" 
      />
      {/* 中心核心实心圆点 */}
      <circle cx="60" cy="30" r="3.5" fill={color} />

      {/* 四角外延连接节点 */}
      {/* 左上 */}
      <line x1="50" y1="20" x2="23" y2="2" stroke={color} strokeWidth="1.2" opacity="0.85" />
      <circle cx="20" cy="0" r="3.0" fill={color} />
      
      {/* 右上 */}
      <line x1="70" y1="20" x2="97" y2="2" stroke={color} strokeWidth="1.2" opacity="0.85" />
      <circle cx="100" cy="0" r="3.0" fill={color} />
      
      {/* 左下 */}
      <line x1="50" y1="40" x2="23" y2="58" stroke={color} strokeWidth="1.2" opacity="0.85" />
      <circle cx="20" cy="60" r="3.0" fill={color} />
      
      {/* 右下 */}
      <line x1="70" y1="40" x2="97" y2="58" stroke={color} strokeWidth="1.2" opacity="0.85" />
      <circle cx="100" cy="60" r="3.0" fill={color} />

      {/* 字母 G */}
      <path 
        d="M 106,22 A 10,10 0 1 0 106,38 V 30 H 98" 
        stroke={color} 
        strokeWidth="3.5" 
        strokeLinejoin="round" 
        strokeLinecap="round" 
      />
    </svg>
  );
}
