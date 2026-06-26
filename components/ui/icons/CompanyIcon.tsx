import { IconProps } from './types';
import React from 'react';



export const CompanyIcon: React.FC<IconProps> = ({
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
      <path d="M3 21h18M5 21V3a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v18" stroke={c} />
      <path d="M9 5h2M9 9h2M9 13h2M9 17h2M13 5h2M13 9h2M13 13h2M13 17h2" stroke={g} strokeWidth={1.5} />
    </svg>
  );
};
