import { IconProps } from './types';
import React from 'react';



export const TargetIcon: React.FC<IconProps> = ({
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
      <circle cx="12" cy="12" r="9" stroke={c} />
      <circle cx="12" cy="12" r="5" stroke={c} />
      <circle cx="12" cy="12" r="1.5" stroke={g} />
      <path d="M12 2v20M2 12h20" stroke={g} strokeWidth={1} />
    </svg>
  );
};
