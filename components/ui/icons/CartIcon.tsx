import { IconProps } from './types';
import React from 'react';



export const CartIcon: React.FC<IconProps> = ({
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
      <path d="M1 1h4l2.6 12.4A2 2 0 0 0 9.6 15h9.1a2 2 0 0 0 2-1.6L22 6H6" stroke={c} />
      <circle cx="10" cy="19" r="2" stroke={g} />
      <circle cx="18" cy="19" r="2" stroke={g} />
    </svg>
  );
};
