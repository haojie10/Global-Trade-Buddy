import { IconProps } from './types';
import React from 'react';



export const WrenchIcon: React.FC<IconProps> = ({
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
      <path d="M18.4 5.6a6 6 0 0 0-8.5 0c-1.8 1.8-2.2 4.4-1 6.5L3 18v3h3l5.9-5.9c2.1 1.2 4.7.8 6.5-1a6 6 0 0 0 0-8.5Z" stroke={c} />
      <path d="M18.4 5.6l-4 4M14.4 9.6c-.8-.8-.8-2 0-2.8s2-.8 2.8 0" stroke={g} />
    </svg>
  );
};
