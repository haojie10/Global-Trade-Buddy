'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { cleanCompanyNameForLookup, extractRootDomain } from '../../lib/domain-utils';
import {
  isSafeWikiUrl,
  type WikiMarketPlayerGroup,
  type WikiPlayer,
} from '../../lib/wiki-schema';
import type { PlayerAssetMatch } from '../../lib/wiki-service';
import { sanitizeUrl } from './SafeMarkdown';

export interface WikiMarketPlayersProps {
  groups: WikiMarketPlayerGroup[];
  playerMatches: Record<string, PlayerAssetMatch>;
  countryName: string;
  industryName: string;
  onRequestCustomReport?: () => void;
}

const GROUP_TYPE_STYLE: Record<
  WikiMarketPlayerGroup['group_type'],
  { badge: string; color: string; bg: string }
> = {
  global_brand: { badge: '国际跨国大牌', color: '#2563eb', bg: 'rgba(37, 99, 235, 0.1)' },
  local_brand: { badge: '本土消费/进口品牌', color: '#ea580c', bg: 'rgba(234, 88, 12, 0.1)' },
  local_manufacturer: { badge: '本土专业制造商', color: '#059669', bg: 'rgba(5, 150, 105, 0.1)' },
  importer: { badge: '独立进口商/总代', color: '#7c3aed', bg: 'rgba(124, 58, 237, 0.1)' },
};

const SAFE_DOMAIN_RE =
  /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)+$/i;

function getSafeDomain(raw?: string): string | null {
  if (typeof raw !== 'string' || !raw.trim()) return null;
  const domain = extractRootDomain(raw);
  if (!domain || !SAFE_DOMAIN_RE.test(domain)) return null;
  return sanitizeUrl(`https://${domain}`) ? domain : null;
}

function lookupMatch(
  matches: Record<string, PlayerAssetMatch> | undefined,
  player: WikiPlayer
): PlayerAssetMatch | null {
  if (!matches || typeof matches !== 'object') return null;
  const domain = extractRootDomain(player.website || '');
  if (domain && Object.prototype.hasOwnProperty.call(matches, domain)) {
    return matches[domain] ?? null;
  }
  const clean = cleanCompanyNameForLookup(player.name || '');
  if (clean && Object.prototype.hasOwnProperty.call(matches, clean)) {
    return matches[clean] ?? null;
  }
  return null;
}

function getMonogram(name: string): string {
  const first = Array.from(String(name || '').trim())[0];
  if (!first) return '?';
  return /^[a-z]$/i.test(first) ? first.toUpperCase() : first;
}

function PlayerBadgeLogo({ name, logoUrl }: { name: string; logoUrl?: string }) {
  const [failed, setFailed] = useState(false);
  const safeUrl = logoUrl && isSafeWikiUrl(logoUrl.trim()) ? logoUrl.trim() : null;

  useEffect(() => {
    setFailed(false);
  }, [safeUrl]);

  const showImg = Boolean(safeUrl && !failed);
  return (
    <div
      style={{
        width: '42px',
        height: '42px',
        minWidth: '42px',
        background: '#ffffff',
        borderRadius: '10px',
        border: '1px solid rgba(18, 18, 18, 0.1)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
        padding: showImg ? '4px' : 0,
        boxSizing: 'border-box',
      }}
    >
      {showImg && safeUrl ? (
        <img
          src={safeUrl}
          alt={name}
          loading="lazy"
          decoding="async"
          onError={() => setFailed(true)}
          style={{ width: '100%', height: '100%', objectFit: 'contain' }}
        />
      ) : (
        <span style={{ fontSize: '15px', fontWeight: 700, color: 'var(--color-accent, #ff641e)' }}>
          {getMonogram(name)}
        </span>
      )}
    </div>
  );
}

/**
 * 全域主要玩家图鉴组件：按国际大牌 / 本土品牌 / 本土制造商分阵营展示市场主流玩家，
 * 自动联动平台 360° 客户研报与采购联系人徽章，帮助外贸业务员快速摸清全市场玩家格局。
 */
export default function WikiMarketPlayers({
  groups,
  playerMatches,
  countryName,
  industryName,
  onRequestCustomReport,
}: WikiMarketPlayersProps) {
  const safeGroups = Array.isArray(groups) ? groups.filter((g) => g?.players?.length > 0) : [];
  const [activeTab, setActiveTab] = useState<string>('all');

  if (safeGroups.length === 0) return null;

  const totalCount = safeGroups.reduce((acc, g) => acc + g.players.length, 0);
  const visibleGroups =
    activeTab === 'all' ? safeGroups : safeGroups.filter((g) => g.group_name === activeTab);

  return (
    <section
      aria-label="全域主要品牌与制造商玩家图鉴"
      style={{
        background: '#ffffff',
        border: '1px solid rgba(18, 18, 18, 0.08)',
        borderRadius: '14px',
        padding: '24px',
        boxShadow: '0 4px 16px rgba(18, 18, 18, 0.03)',
        display: 'flex',
        flexDirection: 'column',
        gap: '18px',
      }}
    >
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          justifyContent: 'space-between',
          alignItems: 'baseline',
          gap: '8px',
        }}
      >
        <div>
          <h2
            className="font-editorial"
            style={{ margin: 0, fontSize: '1.35rem', fontWeight: 700, color: 'var(--color-text, #121212)' }}
          >
            二、{countryName}{industryName}主要玩家全景图鉴（{totalCount} 家）
          </h2>
          <p style={{ margin: '6px 0 0', fontSize: '13px', color: 'var(--color-muted, #666666)' }}>
            按国际跨国大牌、本土消费/进口品牌与本土专业制造商分阵营梳理，帮助外贸业务员一次性认清市场主力玩家
          </p>
        </div>
      </div>

      {/* 阵营切换 Tab */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }} role="tablist" aria-label="玩家阵营筛选">
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'all'}
          onClick={() => setActiveTab('all')}
          style={{
            padding: '6px 14px',
            borderRadius: '999px',
            fontSize: '13px',
            fontWeight: 600,
            cursor: 'pointer',
            border:
              activeTab === 'all'
                ? '1px solid var(--color-accent, #ff641e)'
                : '1px solid rgba(18, 18, 18, 0.12)',
            background: activeTab === 'all' ? 'var(--color-accent, #ff641e)' : '#fafafa',
            color: activeTab === 'all' ? '#ffffff' : '#334155',
          }}
        >
          全部阵营（{totalCount}）
        </button>
        {safeGroups.map((group) => {
          const isActive = activeTab === group.group_name;
          return (
            <button
              key={`tab-${group.group_name}`}
              type="button"
              role="tab"
              aria-selected={isActive}
              onClick={() => setActiveTab(group.group_name)}
              style={{
                padding: '6px 14px',
                borderRadius: '999px',
                fontSize: '13px',
                fontWeight: 600,
                cursor: 'pointer',
                border: isActive
                  ? '1px solid var(--color-accent, #ff641e)'
                  : '1px solid rgba(18, 18, 18, 0.12)',
                background: isActive ? 'var(--color-accent, #ff641e)' : '#fafafa',
                color: isActive ? '#ffffff' : '#334155',
              }}
            >
              {group.group_name}（{group.players.length}）
            </button>
          );
        })}
      </div>

      {/* 分组卡片网格 */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
        {visibleGroups.map((group) => {
          const styleMeta = GROUP_TYPE_STYLE[group.group_type] || GROUP_TYPE_STYLE.local_brand;
          return (
            <div key={`group-${group.group_name}`} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '10px' }}>
                <span
                  style={{
                    fontSize: '12px',
                    fontWeight: 700,
                    padding: '3px 10px',
                    borderRadius: '999px',
                    color: styleMeta.color,
                    background: styleMeta.bg,
                  }}
                >
                  {styleMeta.badge}
                </span>
                <h3 style={{ margin: 0, fontSize: '1.02rem', fontWeight: 700, color: '#0f172a' }}>
                  {group.group_name}
                </h3>
                {group.description && (
                  <span style={{ fontSize: '12.5px', color: '#64748b' }}>{group.description}</span>
                )}
              </div>

              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fill, minmax(290px, 1fr))',
                  gap: '12px',
                }}
              >
                {group.players.map((player, idx) => {
                  const safeDomain = getSafeDomain(player.website);
                  const matched = lookupMatch(playerMatches, player);
                  const rawReportId = typeof matched?.reportId === 'string' ? matched.reportId.trim() : '';
                  const safeReportPath =
                    rawReportId && !/[/?#\\]/.test(rawReportId) && isSafeWikiUrl(`/reports/${rawReportId}`)
                      ? `/reports/${rawReportId}`
                      : null;
                  const contactCount = matched?.contactCount ?? 0;

                  return (
                    <div
                      key={`${group.group_name}-${player.website}-${idx}`}
                      style={{
                        background: '#fafafa',
                        border: '1px solid rgba(18, 18, 18, 0.08)',
                        borderRadius: '11px',
                        padding: '12px 14px',
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'space-between',
                        gap: '10px',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
                        <PlayerBadgeLogo name={player.name} logoUrl={player.logo_url} />
                        <div style={{ minWidth: 0, flex: 1 }}>
                          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '6px' }}>
                            <strong style={{ fontSize: '14px', color: '#0f172a' }}>{player.name}</strong>
                            {player.price_tier && (
                              <span
                                style={{
                                  fontSize: '11px',
                                  fontWeight: 600,
                                  padding: '1px 6px',
                                  borderRadius: '4px',
                                  background: '#ffffff',
                                  border: '1px solid rgba(15, 23, 42, 0.1)',
                                  color: '#475569',
                                }}
                              >
                                {player.price_tier}
                              </span>
                            )}
                          </div>

                          <div
                            style={{
                              display: 'flex',
                              flexWrap: 'wrap',
                              alignItems: 'center',
                              gap: '8px',
                              marginTop: '2px',
                              fontSize: '12px',
                              color: '#64748b',
                            }}
                          >
                            {safeDomain && (
                              <a
                                href={`https://${safeDomain}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                style={{ color: '#475569', textDecoration: 'underline', textUnderlineOffset: '2px' }}
                              >
                                {safeDomain}
                              </a>
                            )}
                            {player.headquarters && <span>· {player.headquarters}</span>}
                          </div>

                          <p style={{ margin: '6px 0 0', fontSize: '12.5px', color: '#475569', lineHeight: 1.5 }}>
                            {player.business_model}
                          </p>
                        </div>
                      </div>

                      {(safeReportPath || contactCount > 0) && (
                        <div
                          style={{
                            display: 'flex',
                            flexWrap: 'wrap',
                            alignItems: 'center',
                            gap: '8px',
                            paddingTop: '8px',
                            borderTop: '1px dashed rgba(18, 18, 18, 0.08)',
                          }}
                        >
                          {safeReportPath && (
                            <Link
                              href={safeReportPath}
                              style={{
                                fontSize: '11.5px',
                                fontWeight: 700,
                                color: '#ffffff',
                                background: 'var(--color-accent, #ff641e)',
                                padding: '3px 9px',
                                borderRadius: '6px',
                                textDecoration: 'none',
                              }}
                            >
                              360° 客户研报 →
                            </Link>
                          )}
                          {contactCount > 0 && (
                            <button
                              type="button"
                              onClick={() => onRequestCustomReport?.()}
                              style={{
                                fontSize: '11.5px',
                                fontWeight: 600,
                                color: 'var(--color-accent, #ff641e)',
                                background: 'rgba(255, 100, 30, 0.08)',
                                border: '1px solid rgba(255, 100, 30, 0.25)',
                                padding: '3px 9px',
                                borderRadius: '6px',
                                cursor: 'pointer',
                              }}
                            >
                              已收录 {contactCount} 位买手
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
