import React from 'react';

interface MGLogoProps {
  height?: number | string;
  className?: string;
  color?: string;
}

export default function MGLogo({ height = 24, className = '', color = 'var(--color-accent)' }: MGLogoProps) {
  // 保持 3:1 的宽高比
  const calculatedWidth = typeof height === 'number' ? height * 3 : undefined;

  return (
    <svg 
      xmlns="http://www.w3.org/2000/svg" 
      viewBox="0 0 120 40" 
      height={height}
      width={calculatedWidth}
      className={className}
      fill="none"
      style={{ display: 'inline-block', verticalAlign: 'middle' }}
    >
      {/* 字母 M */}
      <path 
        d="M 5,32 L 5,8 L 17,22 L 29,8 L 29,32" 
        stroke={color} 
        strokeWidth="3.5" 
        strokeLinejoin="round" 
        strokeLinecap="round" 
      />

      {/* 中间图谱取景框 [ • ] */}
      {/* 左括号 */}
      <path 
        d="M 55,10 H 50 V 30 H 55" 
        stroke={color} 
        strokeWidth="2.5" 
        strokeLinejoin="round" 
        strokeLinecap="round" 
      />
      {/* 右括号 */}
      <path 
        d="M 65,10 H 70 V 30 H 65" 
        stroke={color} 
        strokeWidth="2.5" 
        strokeLinejoin="round" 
        strokeLinecap="round" 
      />
      {/* 中心核心实心圆点 */}
      <circle cx="60" cy="20" r="3.5" fill={color} />

      {/* 四角外延连接节点 */}
      {/* 左上 */}
      <line x1="50" y1="10" x2="43" y2="3" stroke={color} strokeWidth="1.2" opacity="0.85" />
      <circle cx="41" cy="1" r="2.2" fill={color} />
      
      {/* 右上 */}
      <line x1="70" y1="10" x2="77" y2="3" stroke={color} strokeWidth="1.2" opacity="0.85" />
      <circle cx="79" cy="1" r="2.2" fill={color} />
      
      {/* 左下 */}
      <line x1="50" y1="30" x2="43" y2="37" stroke={color} strokeWidth="1.2" opacity="0.85" />
      <circle cx="41" cy="39" r="2.2" fill={color} />
      
      {/* 右下 */}
      <line x1="70" y1="30" x2="77" y2="37" stroke={color} strokeWidth="1.2" opacity="0.85" />
      <circle cx="79" cy="39" r="2.2" fill={color} />

      {/* 字母 G */}
      <path 
        d="M 115,12 A 10,10 0 1 0 115,28 V 20 H 106" 
        stroke={color} 
        strokeWidth="3.5" 
        strokeLinejoin="round" 
        strokeLinecap="round" 
      />
    </svg>
  );
}
