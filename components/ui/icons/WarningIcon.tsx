import { IconProps } from './types';
import React from 'react';



export const WarningIcon: React.FC<IconProps> = ({
  size = 24,
  color,
  goldColor,
  strokeWidth = 2,
  ...props
}) => {
  const w = color || 'var(--warning, #f59e0b)';
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M12 3l10 17H2L12 3Z" stroke={w} />
      <path d="M12 8v5" stroke={w} strokeWidth={2.5} />
      <circle cx="12" cy="17" r="1" fill={w} stroke="none" />
    </svg>
  );
};
