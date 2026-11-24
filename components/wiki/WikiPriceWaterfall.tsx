'use client';

import React, { useEffect, useState } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { WikiPriceStage } from '../../lib/wiki-schema';

export interface WikiPriceWaterfallProps {
  stages: WikiPriceStage[];
  currency: string;
}

interface WaterfallChartDatum {
  stageName: string;
  price: number;
  multiplierText: string;
  markupDesc: string;
}

function isFinitePositive(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0;
}

/**
 * 格式化美元等值参考价，避免小数末尾无意义补零或输出 NaN/Infinity
 */
function formatUsdPrice(value: unknown): string {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) {
    return '-';
  }
  const normalized = Number.isInteger(value) ? value : Number(value.toFixed(2));
  return `$${normalized}`;
}

/**
 * 计算当前阶段相对首阶段 FOB 的价格倍率；首阶段非正数或异常时统一返回 "-"
 */
function calcStageMultiplier(price: unknown, basePrice: unknown): string {
  if (!isFinitePositive(basePrice) || !isFinitePositive(price)) {
    return '-';
  }
  return `${(price / basePrice).toFixed(1)}x`;
}

/**
 * 根据阶梯索引返回由浅入深的暖阳橘渐变柱体颜色
 */
function getStageBarColor(index: number, total: number): string {
  if (total <= 1 || index === total - 1) {
    return '#ff641e';
  }
  const palette = ['#94a3b8', '#64748b', '#f59e0b', '#fb923c'];
  if (index === 0) return palette[0];
  const ratio = index / Math.max(1, total - 1);
  if (ratio < 0.45) return palette[1];
  if (ratio < 0.75) return palette[2];
  return palette[3];
}

/**
 * 行业百科价格瀑布双模态组件：
 * 1. 客户端挂载后使用 Recharts 渲染直观柱状阶梯图（避免 SSR 尺寸告警）；
 * 2. 始终在 SSR HTML 中输出完整语义化明细 <table>，确保 AI 爬虫与无 JS 环境下数据完整可读。
 */
export default function WikiPriceWaterfall({ stages, currency }: WikiPriceWaterfallProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!Array.isArray(stages) || stages.length === 0) {
    return null;
  }

  const basePrice = stages[0]?.price_usd_equiv;
  const chartData: WaterfallChartDatum[] = stages.map((stage) => {
    const safePrice =
      typeof stage.price_usd_equiv === 'number' && Number.isFinite(stage.price_usd_equiv) && stage.price_usd_equiv >= 0
        ? stage.price_usd_equiv
        : 0;
    return {
      stageName: stage.stage_name,
      price: safePrice,
      multiplierText: calcStageMultiplier(stage.price_usd_equiv, basePrice),
      markupDesc: stage.markup_desc,
    };
  });

  const safeCurrency = typeof currency === 'string' && currency.trim() ? currency.trim().toUpperCase() : 'USD';

  return (
    <section
      aria-label="全链路价格瀑布与加价阶梯"
      style={{
        background: '#ffffff',
        border: '1px solid rgba(18, 18, 18, 0.08)',
        borderRadius: '14px',
        padding: '22px',
        boxShadow: '0 4px 16px rgba(18, 18, 18, 0.03)',
      }}
    >
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          justifyContent: 'space-between',
          alignItems: 'baseline',
          gap: '10px',
          marginBottom: '16px',
        }}
      >
        <div>
          <h3
            className="font-editorial"
            style={{
              margin: 0,
              fontSize: '1.25rem',
              fontWeight: 700,
              color: 'var(--color-text, #121212)',
            }}
          >
            FOB → 终端零售价格瀑布
          </h3>
          <p
            style={{
              margin: '4px 0 0',
              fontSize: '13px',
              color: 'var(--color-muted, #666666)',
            }}
          >
            统一折算为美元等值（USD）对比各环节加价空间
          </p>
        </div>
        <span
          style={{
            fontSize: '12px',
            fontWeight: 600,
            color: 'var(--color-accent, #ff641e)',
            background: 'rgba(255, 100, 30, 0.08)',
            padding: '4px 10px',
            borderRadius: '999px',
          }}
        >
          终端结算币种：{safeCurrency}
        </span>
      </div>

      {/* 仅客户端挂载后渲染 Recharts，规避 SSR 容器宽高为 0 的告警 */}
      {mounted ? (
        <div style={{ width: '100%', height: '270px', marginBottom: '20px' }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} margin={{ top: 12, right: 16, left: 0, bottom: 8 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(18, 18, 18, 0.08)" vertical={false} />
              <XAxis
                dataKey="stageName"
                tick={{ fontSize: 12, fill: '#475569' }}
                axisLine={{ stroke: 'rgba(18, 18, 18, 0.12)' }}
                tickLine={false}
              />
              <YAxis
                tick={{ fontSize: 12, fill: '#64748b' }}
                axisLine={false}
                tickLine={false}
                tickFormatter={(val: number) => `$${val}`}
              />
              <Tooltip
                cursor={{ fill: 'rgba(255, 100, 30, 0.05)' }}
                formatter={(value: unknown) => [formatUsdPrice(Number(value)), '美元等值价']}
                contentStyle={{
                  borderRadius: '10px',
                  border: '1px solid rgba(18, 18, 18, 0.1)',
                  boxShadow: '0 8px 20px rgba(0, 0, 0, 0.08)',
                  fontSize: '13px',
                }}
              />
              <Bar dataKey="price" radius={[8, 8, 0, 0]} maxBarSize={56}>
                {chartData.map((entry, idx) => (
                  <Cell key={`waterfall-cell-${entry.stageName}-${idx}`} fill={getStageBarColor(idx, chartData.length)} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      ) : (
        <div
          aria-hidden="true"
          style={{
            padding: '12px 14px',
            marginBottom: '16px',
            borderRadius: '10px',
            background: 'rgba(18, 18, 18, 0.03)',
            fontSize: '12.5px',
            color: 'var(--color-muted, #666666)',
          }}
        >
          价格瀑布明细表（全链路 {stages.length} 个流通阶梯）
        </div>
      )}

      {/* 始终在 SSR HTML 中输出完整明细表，保障 GEO 与无 JS 可读性 */}
      <div
        style={{
          overflowX: 'auto',
          borderRadius: '10px',
          border: '1px solid rgba(18, 18, 18, 0.08)',
        }}
      >
        <table
          style={{
            width: '100%',
            borderCollapse: 'collapse',
            fontSize: '13.5px',
            textAlign: 'left',
            background: '#ffffff',
          }}
        >
          <thead>
            <tr style={{ background: 'rgba(18, 18, 18, 0.03)' }}>
              <th style={thStyle}>流通阶段</th>
              <th style={{ ...thStyle, textAlign: 'right', whiteSpace: 'nowrap' }}>美元等值价 (USD)</th>
              <th style={{ ...thStyle, textAlign: 'center', whiteSpace: 'nowrap' }}>较 FOB 倍率</th>
              <th style={thStyle}>成本与加价说明</th>
            </tr>
          </thead>
          <tbody>
            {stages.map((stage, idx) => {
              const isLast = idx === stages.length - 1;
              const multiplier = calcStageMultiplier(stage.price_usd_equiv, basePrice);
              return (
                <tr
                  key={`waterfall-row-${stage.stage_name}-${idx}`}
                  style={{
                    borderBottom: isLast ? 'none' : '1px solid rgba(18, 18, 18, 0.06)',
                    background: isLast ? 'rgba(255, 100, 30, 0.03)' : 'transparent',
                  }}
                >
                  <td
                    style={{
                      ...tdStyle,
                      fontWeight: isLast ? 700 : 600,
                      color: 'var(--color-text, #121212)',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {stage.stage_name}
                  </td>
                  <td
                    style={{
                      ...tdStyle,
                      textAlign: 'right',
                      fontWeight: 700,
                      color: isLast ? 'var(--color-accent, #ff641e)' : 'var(--color-text, #121212)',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {formatUsdPrice(stage.price_usd_equiv)}
                  </td>
                  <td
                    style={{
                      ...tdStyle,
                      textAlign: 'center',
                      fontWeight: 600,
                      color: isLast ? 'var(--color-accent, #ff641e)' : 'var(--color-muted, #666666)',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {multiplier}
                  </td>
                  <td style={{ ...tdStyle, color: '#334155', lineHeight: 1.55 }}>
                    {stage.markup_desc}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}

const thStyle: React.CSSProperties = {
  padding: '10px 14px',
  fontWeight: 700,
  fontSize: '12.5px',
  color: 'var(--color-text, #121212)',
  borderBottom: '1px solid rgba(18, 18, 18, 0.08)',
};

const tdStyle: React.CSSProperties = {
  padding: '10px 14px',
  verticalAlign: 'top',
};
