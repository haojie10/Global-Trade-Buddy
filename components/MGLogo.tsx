import React from 'react';

interface MGLogoProps {
  height?: number | string;
  className?: string;
  color?: string; // 保持接口兼容
}

export default function MGLogo({ height = 24, className = '' }: MGLogoProps) {
  // 直接以 5:3 宽高比（120:72）计算图片宽度，以便响应式渲染
  const heightVal = typeof height === 'number' ? `${height}px` : height;
  const widthVal = typeof height === 'number' ? `${Math.round(height * (120 / 72))}px` : '100%';

  return (
    <div 
      className={className}
      style={{ 
        display: 'inline-block', 
        verticalAlign: 'middle',
        height: heightVal,
        width: widthVal,
        backgroundColor: 'var(--color-accent)', // 动态绑定品牌橙色
        WebkitMask: 'url(/images/mg_logo.png) no-repeat center / contain',
        mask: 'url(/images/mg_logo.png) no-repeat center / contain'
      }}
      role="img"
      aria-label="Market Graphic Logo"
    />
  );
}
