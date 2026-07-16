import React from 'react';

interface MGLogoProps {
  height?: number | string;
  className?: string;
  color?: string; // 保持接口兼容
}

export default function MGLogo({ height = 24, className = '' }: MGLogoProps) {
  // 直接以 5:3 宽高比（120:72）计算图片宽度，以便响应式渲染
  const calculatedWidth = typeof height === 'number' ? Math.round(height * (120 / 72)) : undefined;

  return (
    <img 
      src="/images/mg_logo.png" 
      alt="Market Graphic Logo" 
      height={height}
      width={calculatedWidth}
      className={className}
      style={{ 
        display: 'inline-block', 
        verticalAlign: 'middle',
        objectFit: 'contain'
      }}
    />
  );
}
