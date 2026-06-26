import { IconProps } from './types';
import React from 'react';



export const SearchIcon: React.FC<IconProps> = ({
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
      <circle cx="11" cy="11" r="6" stroke={c} />
      <path d="M21 21l-4.3-4.3" stroke={g} />
      <path d="M8 8a3 3 0 0 1 4 0" stroke={g} />
    </svg>
  );
};
