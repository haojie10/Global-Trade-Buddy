import React from 'react';
import Link from 'next/link';
import { ARCHETYPE_META, type ArchetypeId } from '../../lib/wiki-schema';
import { sanitizeUrl } from './SafeMarkdown';

export interface WikiListItem {
  id: string;
  slug: string;
  title: string;
  summary: string;
  country_code: string;
  country_name: string;
  market_region: string;
  industry_name: string;
  hs_code_6?: string | null;
  archetype_id: ArchetypeId;
  price_multiplier: string;
  player_count: number;
  view_count: number;
  updated_at: string;
}

/**
 * 行业百科大厅卡片组件：展示国家·品类、流通原型色标、HS 编码、FOB→终端价差倍率与代表玩家数
 */
export default function WikiEntryCard({ item }: { item: WikiListItem }) {
  const archetype = ARCHETYPE_META[item.archetype_id] ?? {
    nameCn: item.archetype_id,
    shortTag: item.archetype_id,
    accent: '#ff641e',
  };
  const safeHref = sanitizeUrl(`/wiki/${item.slug}`) || '/wiki';

  return (
    <Link
      href={safeHref}
      style={{
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        gap: '14px',
        background: '#ffffff',
        border: '1px solid rgba(18, 18, 18, 0.08)',
        borderRadius: '14px',
        padding: '20px',
        textDecoration: 'none',
        color: 'var(--color-text, #121212)',
        boxShadow: '0 4px 14px rgba(18, 18, 18, 0.03)',
        transition: 'transform 0.2s ease, box-shadow 0.2s ease, border-color 0.2s ease',
      }}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        {/* 顶部标签行：国家·品类 + 原型色标 + 可选 HS 编码 */}
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '8px',
          }}
        >
          <span
            style={{
              fontSize: '12.5px',
              fontWeight: 700,
              color: 'var(--color-text, #121212)',
            }}
          >
            {item.country_name} · {item.industry_name}
          </span>

          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '6px' }}>
            {item.hs_code_6 && (
              <span
                style={{
                  fontSize: '11.5px',
                  fontWeight: 600,
                  color: 'var(--color-muted, #666666)',
                  background: 'rgba(18, 18, 18, 0.04)',
                  padding: '2px 7px',
                  borderRadius: '6px',
                  fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
                }}
              >
                HS {item.hs_code_6}
              </span>
            )}
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '5px',
                fontSize: '11.5px',
                fontWeight: 600,
                color: archetype.accent,
                background: `${archetype.accent}14`,
                padding: '2px 8px',
                borderRadius: '999px',
              }}
            >
              <span
                aria-hidden="true"
                style={{
                  width: '6px',
                  height: '6px',
                  borderRadius: '50%',
                  background: archetype.accent,
                }}
              />
              {archetype.shortTag}
            </span>
          </div>
        </div>

        {/* 标题 */}
        <h3
          className="font-editorial"
          style={{
            margin: 0,
            fontSize: '1.15rem',
            fontWeight: 700,
            lineHeight: 1.4,
            color: 'var(--color-text, #121212)',
          }}
        >
          {item.title}
        </h3>

        {/* 摘要 */}
        <p
          style={{
            margin: 0,
            fontSize: '13.5px',
            lineHeight: 1.6,
            color: 'var(--color-muted, #666666)',
            display: '-webkit-box',
            WebkitLineClamp: 3,
            WebkitBoxOrient: 'vertical',
            overflow: 'hidden',
          }}
        >
          {item.summary}
        </p>
      </div>

      {/* 底部指标与行动引导 */}
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '10px',
          paddingTop: '12px',
          borderTop: '1px solid rgba(18, 18, 18, 0.07)',
          fontSize: '12.5px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <span style={{ color: 'var(--color-muted, #666666)' }}>
            价差倍率{' '}
            <strong style={{ color: 'var(--color-accent, #ff641e)', fontWeight: 700 }}>
              {item.price_multiplier || '-'}
            </strong>
          </span>
          <span style={{ color: 'var(--color-muted, #666666)' }}>
            收录{' '}
            <strong style={{ color: 'var(--color-text, #121212)', fontWeight: 700 }}>
              {item.player_count}
            </strong>{' '}
            家玩家
          </span>
        </div>

        <span
          style={{
            fontWeight: 700,
            color: 'var(--color-accent, #ff641e)',
          }}
        >
          免费阅读 →
        </span>
      </div>
    </Link>
  );
}
