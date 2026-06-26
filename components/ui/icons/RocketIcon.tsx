import React from 'react';
import { IconProps } from './types';

export const RocketIcon: React.FC<IconProps> = ({
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
      <path d="M12 2S8 7 8 13c0 2 1 4 4 6 3-2 4-4 4-6 0-6-4-11-4-11Z" stroke={g} />
      <circle cx="12" cy="10" r="1.5" stroke={c} />
      <path d="M8 15v4H4.5L8 15ZM16 15v4h3.5L16 15Z" stroke={c} />
      <path d="M10 20v2M14 20v2M12 20v3" stroke={c} />
    </svg>
  );
};
