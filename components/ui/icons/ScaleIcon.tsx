import { IconProps } from './types';
import React from 'react';



export const ScaleIcon: React.FC<IconProps> = ({
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
      <path d="M12 3v17M19 20H5" stroke={c} />
      <path d="M5 7h14" stroke={g} />
      <path d="M5 7l-2 6h4l-2-6M5 13v3" stroke={c} />
      <path d="M19 7l-2 6h4l-2-6M19 13v3" stroke={c} />
    </svg>
  );
};
