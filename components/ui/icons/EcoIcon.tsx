import React from 'react';
import { IconProps } from './types';

export const EcoIcon: React.FC<IconProps> = ({
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
      <path d="M12 2C8 7 5 11 5 14a7 7 0 0 0 14 0c0-3-3-7-7-12Z" stroke={c} />
      <path d="M12 21v2" stroke={c} />
      <path d="M12 6v15" stroke={g} />
      <path d="M12 10l-4-3M12 10l4-3M12 15l-5-3M12 15l5-3" stroke={g} />
    </svg>
  );
};
