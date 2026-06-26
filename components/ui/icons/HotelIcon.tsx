import { IconProps } from './types';
import React from 'react';



export const HotelIcon: React.FC<IconProps> = ({
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
      <path d="M3 21h18M4 21V7a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v18" stroke={c} />
      <path d="M9 11h6M9 8v6M15 8v6" stroke={g} strokeWidth={2} />
      <path d="M10 21v-4a2 2 0 0 1 4 0v4" stroke={c} />
    </svg>
  );
};
