import React from 'react';

interface KpiCardProps {
  label: string;
  value: string | number;
  change?: string;       // 例如: '+12%', '-3'
  changeLabel?: string;  // 例如: '本周', '环比'
  accentColor?: string;  // 左侧边框颜色，默认使用主色
}

export default function KpiCard({ label, value, change, changeLabel, accentColor }: KpiCardProps) {
  const isPositive = change ? change.startsWith('+') : false;
  const isNegative = change ? change.startsWith('-') : false;
  
  let trendClass = 'neutral';
  let trendIcon = '';
  
  if (isPositive) {
    trendClass = 'positive';
    trendIcon = '↑';
  } else if (isNegative) {
    trendClass = 'negative';
    trendIcon = '↓';
  }

  const borderStyle = accentColor ? { borderLeftColor: accentColor } : {};

  return (
    <div className="admin-kpi-card" style={borderStyle}>
      <div className="admin-kpi-label">{label}</div>
      <div className="admin-kpi-value">{value}</div>
      {change && (
        <div className={`admin-kpi-trend ${trendClass}`}>
          <span>{trendIcon} {change}</span>
          <span style={{ color: 'var(--admin-text-secondary)', marginLeft: '4px' }}>{changeLabel || ''}</span>
        </div>
      )}
    </div>
  );
}
