import { IconProps } from './types';
import React from 'react';



export const IdeaIcon: React.FC<IconProps> = ({
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
      <path d="M15 21H9M14 18H10" stroke={c} />
      <path d="M9 18A7.5 7.5 0 1 1 15 18c0 1.5-1 2.5-1 3.5H10c0-1-1-2-1-3.5Z" stroke={c} />
      <path d="M12 8v4M10 10h4" stroke={g} />
    </svg>
  );
};
