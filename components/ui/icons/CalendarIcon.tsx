import { IconProps } from './types';
import React from 'react';



export const CalendarIcon: React.FC<IconProps> = ({
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
      <rect x="3" y="4" width="18" height="16" rx="2" stroke={c} />
      <path d="M16 2v4M8 2v4M3 10h18" stroke={g} />
      <circle cx="12" cy="15" r="1.5" stroke={g} fill={g} />
    </svg>
  );
};
