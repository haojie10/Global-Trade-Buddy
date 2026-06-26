import { IconProps } from './types';
import React from 'react';



export const ChartIcon: React.FC<IconProps> = ({
  size = 24,
  color,
  goldColor,
  strokeWidth = 2,
  ...props
}) => {
  const c = color || 'var(--primary, #8fa874)';
  const g = goldColor || 'var(--brand-gold, #d1b48c)';
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M3 3v18h18" stroke={c} />
      <path d="M6 17l4-6 4 3 5-7" stroke={g} />
      <path d="M15 7h4v4" stroke={g} />
    </svg>
  );
};
