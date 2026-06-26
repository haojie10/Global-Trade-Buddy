import { IconProps } from './types';
import React from 'react';



export const HomeIcon: React.FC<IconProps> = ({
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
      <path d="M3 9l9-7 9 7" stroke={g} />
      <path d="M5 9v11a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V9" stroke={c} />
      <path d="M9 22V12h6v10" stroke={g} />
    </svg>
  );
};
