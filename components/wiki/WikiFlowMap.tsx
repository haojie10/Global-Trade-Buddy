'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { cleanCompanyNameForLookup, extractRootDomain } from '../../lib/domain-utils';
import { isSafeWikiUrl, type WikiFlowNode, type WikiPlayer } from '../../lib/wiki-schema';
import type { PlayerAssetMatch } from '../../lib/wiki-service';
import { sanitizeUrl } from './SafeMarkdown';

export interface WikiFlowMapProps {
  nodes: WikiFlowNode[];
  playerMatches: Record<string, PlayerAssetMatch>;
  onRequestCustomReport?: () => void;
}

// 仅渲染渠道分布（原 Tier 2 -> 市场全景）与终端去向（原 Tier 3 -> 用户群体），Tier 1 已在上方玩家图鉴完整覆盖
const VISIBLE_TIERS: Array<2 | 3 | 4> = [2, 3, 4];

const TIER_META: Record<2 | 3 | 4, { badge: string; title: string; subtitle: string }> = {
  2: {
    badge: '渠道分布',
    title: '市场全景',
    subtitle: '按市场占有率从高到低依次展开，支持自上而下连续阅读',
  },
  3: {
    badge: '终端去向',
    title: '用户群体',
    subtitle: '最终买单的终端用户结构与采购决策痛点',
  },
  4: {
    badge: '履约末端',
    title: '终端零售与履约交付',
    subtitle: '末端服务与售后履约环节',
  },
};

const SAFE_DOMAIN_RE =
  /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)+$/i;

function getSafeWebsiteDomain(rawWebsite?: string): string | null {
  if (typeof rawWebsite !== 'string' || !rawWebsite.trim()) return null;
  const domain = extractRootDomain(rawWebsite);
  if (!domain || !SAFE_DOMAIN_RE.test(domain)) return null;
  const verifiedUrl = sanitizeUrl(`https://${domain}`);
  return verifiedUrl ? domain : null;
}

function lookupPlayerMatch(
  playerMatches: Record<string, PlayerAssetMatch> | undefined,
  player: WikiPlayer
): PlayerAssetMatch | null {
  if (!playerMatches || typeof playerMatches !== 'object') return null;

  const domain = extractRootDomain(player.website || '');
  if (domain && Object.prototype.hasOwnProperty.call(playerMatches, domain)) {
    return playerMatches[domain] ?? null;
  }

  const cleanName = cleanCompanyNameForLookup(player.name || '');
  if (cleanName && Object.prototype.hasOwnProperty.call(playerMatches, cleanName)) {
    return playerMatches[cleanName] ?? null;
  }

  return null;
}

function getSafeReportPath(matched: PlayerAssetMatch | null): string | null {
  const rawReportId = typeof matched?.reportId === 'string' ? matched.reportId.trim() : '';
  if (!rawReportId || /[/?#\\]/.test(rawReportId)) return null;
  const path = `/reports/${rawReportId}`;
  return isSafeWikiUrl(path) ? path : null;
}

function getBrandMonogram(name: string): string {
  const trimmed = String(name || '').trim();
  const firstChar = Array.from(trimmed)[0];
  if (!firstChar) return '?';
  return /^[a-z]$/i.test(firstChar) ? firstChar.toUpperCase() : firstChar;
}

function PlayerLogoBadge({ name, logoUrl }: { name: string; logoUrl?: string }) {
  const [imgFailed, setImgFailed] = useState(false);
  const trimmedLogo = typeof logoUrl === 'string' ? logoUrl.trim() : '';
  const safeLogoUrl = trimmedLogo && isSafeWikiUrl(trimmedLogo) ? trimmedLogo : null;

  useEffect(() => {
    setImgFailed(false);
  }, [safeLogoUrl]);

  const showImage = Boolean(safeLogoUrl && !imgFailed);

  return (
    <div
      style={{
        width: '40px',
        height: '40px',
        minWidth: '40px',
        background: '#ffffff',
        borderRadius: '9px',
        border: '1px solid rgba(18, 18, 18, 0.1)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
        padding: showImage ? '4px' : 0,
        boxSizing: 'border-box',
      }}
    >
      {showImage && safeLogoUrl ? (
        <img
          src={safeLogoUrl}
          alt={name}
          loading="lazy"
          decoding="async"
          onError={() => setImgFailed(true)}
          style={{
            width: '100%',
            height: '100%',
            background: '#ffffff',
            borderRadius: '8px',
            objectFit: 'contain',
          }}
        />
      ) : (
        <span
          aria-label={`${name} 品牌徽章`}
          style={{
            fontSize: '15px',
            fontWeight: 700,
            color: 'var(--color-accent, #ff641e)',
            letterSpacing: '0.02em',
            userSelect: 'none',
          }}
        >
          {getBrandMonogram(name)}
        </span>
      )}
    </div>
  );
}

/**
 * 行业百科市场全景与用户群体组件：
 * - 隐藏与上方玩家图鉴重复的 Tier 1；
 * - 市场全景（Tier 2）按市场占有率降序排列，采用单列全宽连续流式排版（卡内左右双栏），彻底避免上下反复拉滚动条；
 * - 仅对平台已有研报的公司渲染超链接直达报告详情页，不展示多余的“买手/解锁”按钮。
 */
export default function WikiFlowMap({ nodes, playerMatches }: WikiFlowMapProps) {
  const safeNodes = Array.isArray(nodes) ? nodes : [];

  if (safeNodes.length === 0) {
    return null;
  }

  return (
    <section aria-label="海外市场渠道分布与用户群体" style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {VISIBLE_TIERS.map((tier) => {
        // 按市场占有率从高到低排序
        const tierNodes = safeNodes
          .filter((n) => n.tier === tier)
          .slice()
          .sort((a, b) => (b.share_pct ?? 0) - (a.share_pct ?? 0));

        if (tierNodes.length === 0) return null;
        const meta = TIER_META[tier];
        const isMarketOverview = tier === 2;

        return (
          <div
            key={`flow-tier-${tier}`}
            style={{
              background: '#ffffff',
              border: '1px solid rgba(18, 18, 18, 0.08)',
              borderRadius: '14px',
              padding: '22px',
              boxShadow: '0 4px 16px rgba(18, 18, 18, 0.03)',
              display: 'flex',
              flexDirection: 'column',
              gap: '18px',
            }}
          >
            {/* 分组头部 */}
            <div
              style={{
                display: 'flex',
                flexWrap: 'wrap',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '10px',
                paddingBottom: '12px',
                borderBottom: '1px solid rgba(18, 18, 18, 0.07)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                <span
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    padding: '3px 10px',
                    borderRadius: '999px',
                    fontSize: '12px',
                    fontWeight: 700,
                    background: 'rgba(255, 100, 30, 0.1)',
                    color: 'var(--color-accent, #ff641e)',
                  }}
                >
                  {meta.badge}
                </span>
                <h3
                  className="font-editorial"
                  style={{
                    margin: 0,
                    fontSize: '1.2rem',
                    fontWeight: 700,
                    color: 'var(--color-text, #121212)',
                  }}
                >
                  {meta.title}
                </h3>
              </div>
              <span style={{ fontSize: '12.5px', color: 'var(--color-muted, #666666)' }}>
                {meta.subtitle}
              </span>
            </div>

            {/* 市场全景快速锚点导航（方便连续阅读的同时一键直达） */}
            {isMarketOverview && tierNodes.length > 1 && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                {tierNodes.map((node, idx) => (
                  <a
                    key={`anchor-${node.id}`}
                    href={`#channel-${node.id}`}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '6px',
                      padding: '5px 12px',
                      borderRadius: '999px',
                      background: '#fafafa',
                      border: '1px solid rgba(18, 18, 18, 0.1)',
                      fontSize: '12.5px',
                      fontWeight: 600,
                      color: '#334155',
                      textDecoration: 'none',
                    }}
                  >
                    <span style={{ color: 'var(--color-accent, #ff641e)', fontWeight: 800 }}>
                      {idx + 1}.
                    </span>
                    <span>{node.label_cn}</span>
                    <span style={{ color: '#64748b', fontWeight: 700 }}>{node.share_pct}%</span>
                  </a>
                ))}
              </div>
            )}

            {/* 市场全景：单列全宽自上而下连续流式卡片；用户群体：紧凑横向并排 */}
            <div
              style={
                isMarketOverview
                  ? { display: 'flex', flexDirection: 'column', gap: '18px' }
                  : {
                      display: 'grid',
                      gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
                      gap: '16px',
                    }
              }
            >
              {tierNodes.map((node, idx) => {
                const painPoints = Array.isArray(node.buyer_pain_points) ? node.buyer_pain_points : [];
                const players = Array.isArray(node.players) ? node.players : [];
                const brandMix = Array.isArray(node.channel_brand_mix) ? node.channel_brand_mix : [];

                return (
                  <article
                    key={`${node.id}-${idx}`}
                    id={`channel-${node.id}`}
                    style={{
                      scrollMarginTop: '92px',
                      borderRadius: '12px',
                      padding: '20px',
                      background: '#fafafa',
                      border: '1px solid rgba(18, 18, 18, 0.09)',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '16px',
                    }}
                  >
                    {/* 顶部通道标题与核心指标 */}
                    <div
                      style={{
                        display: 'flex',
                        flexWrap: 'wrap',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        gap: '10px',
                        paddingBottom: '12px',
                        borderBottom: '1px dashed rgba(18, 18, 18, 0.1)',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                        {isMarketOverview && (
                          <span
                            style={{
                              width: '26px',
                              height: '26px',
                              borderRadius: '8px',
                              background: 'var(--color-accent, #ff641e)',
                              color: '#ffffff',
                              fontSize: '13px',
                              fontWeight: 800,
                              display: 'inline-flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                            }}
                          >
                            {idx + 1}
                          </span>
                        )}
                        <h4
                          style={{
                            margin: 0,
                            fontSize: '1.12rem',
                            fontWeight: 800,
                            color: 'var(--color-text, #121212)',
                          }}
                        >
                          {node.label_cn}
                        </h4>
                      </div>

                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                        <span
                          style={{
                            fontSize: '13px',
                            fontWeight: 700,
                            padding: '4px 11px',
                            borderRadius: '8px',
                            background: 'rgba(255, 100, 30, 0.1)',
                            color: 'var(--color-accent, #ff641e)',
                          }}
                        >
                          市场占比约 {node.share_pct}%
                        </span>
                        <span
                          style={{
                            fontSize: '13px',
                            fontWeight: 600,
                            padding: '4px 11px',
                            borderRadius: '8px',
                            background: '#ffffff',
                            border: '1px solid rgba(18, 18, 18, 0.1)',
                            color: '#334155',
                          }}
                        >
                          典型毛利 {node.typical_margin_range}
                        </span>
                      </div>
                    </div>

                    {/* 市场全景卡片内部采用左右双栏（大屏并排、小屏自动折叠），大幅压缩单卡高度，实现丝滑顺向阅读 */}
                    <div
                      style={
                        isMarketOverview && players.length > 0
                          ? {
                              display: 'grid',
                              gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
                              gap: '18px',
                              alignItems: 'start',
                            }
                          : { display: 'flex', flexDirection: 'column', gap: '14px' }
                      }
                    >
                      {/* 左栏：第二层货盘占比 + 买家痛点 + 谈单切入话术 */}
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', minWidth: 0 }}>
                        {brandMix.length > 0 && (
                          <div
                            style={{
                              background: '#ffffff',
                              border: '1px solid rgba(18, 18, 18, 0.08)',
                              borderRadius: '10px',
                              padding: '12px 14px',
                              display: 'flex',
                              flexDirection: 'column',
                              gap: '10px',
                            }}
                          >
                            <div
                              style={{
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center',
                                gap: '8px',
                              }}
                            >
                              <span style={{ fontSize: '12.5px', fontWeight: 700, color: '#0f172a' }}>
                                渠道内品牌与自有品牌货盘构成
                              </span>
                              <span style={{ fontSize: '11px', color: '#64748b' }}>行业参考估算</span>
                            </div>

                            <div
                              style={{
                                display: 'flex',
                                width: '100%',
                                height: '12px',
                                borderRadius: '999px',
                                overflow: 'hidden',
                                background: 'rgba(15, 23, 42, 0.06)',
                              }}
                            >
                              {brandMix.map((mix, mIdx) => {
                                const palette = ['#ff641e', '#2563eb', '#059669', '#8b5cf6', '#64748b'];
                                return (
                                  <div
                                    key={`${node.id}-mix-bar-${mIdx}`}
                                    title={`${mix.label} ${mix.share_pct}%`}
                                    style={{
                                      width: `${Math.max(0, Math.min(100, mix.share_pct))}%`,
                                      background: palette[mIdx % palette.length],
                                      height: '100%',
                                    }}
                                  />
                                );
                              })}
                            </div>

                            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                              {brandMix.map((mix, mIdx) => {
                                const palette = ['#ff641e', '#2563eb', '#059669', '#8b5cf6', '#64748b'];
                                const dotColor = palette[mIdx % palette.length];
                                return (
                                  <div
                                    key={`${node.id}-mix-item-${mIdx}`}
                                    style={{
                                      display: 'flex',
                                      flexWrap: 'wrap',
                                      alignItems: 'baseline',
                                      justifyContent: 'space-between',
                                      gap: '6px',
                                      fontSize: '12px',
                                      lineHeight: 1.45,
                                    }}
                                  >
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                                      <span
                                        style={{
                                          width: '8px',
                                          height: '8px',
                                          borderRadius: '999px',
                                          background: dotColor,
                                          display: 'inline-block',
                                          flexShrink: 0,
                                        }}
                                      />
                                      <strong style={{ color: '#0f172a' }}>{mix.label}</strong>
                                      {Array.isArray(mix.representative_brands) &&
                                        mix.representative_brands.length > 0 && (
                                          <span style={{ color: '#64748b' }}>
                                            （{mix.representative_brands.join(' / ')}）
                                          </span>
                                        )}
                                    </div>
                                    <span style={{ fontWeight: 700, color: dotColor, whiteSpace: 'nowrap' }}>
                                      约 {mix.share_pct}%
                                    </span>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        )}

                        {painPoints.length > 0 && (
                          <div>
                            <div
                              style={{
                                fontSize: '12px',
                                fontWeight: 700,
                                color: 'var(--color-muted, #666666)',
                                marginBottom: '6px',
                              }}
                            >
                              核心痛点
                            </div>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                              {painPoints.map((point, pIdx) => (
                                <span
                                  key={`${node.id}-pain-${pIdx}`}
                                  style={{
                                    fontSize: '12px',
                                    lineHeight: 1.4,
                                    padding: '3px 10px',
                                    borderRadius: '999px',
                                    background: '#ffffff',
                                    border: '1px solid rgba(18, 18, 18, 0.1)',
                                    color: '#334155',
                                  }}
                                >
                                  {point}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}

                        <div
                          style={{
                            padding: '11px 14px',
                            borderRadius: '8px',
                            borderLeft: '3px solid var(--color-accent, #ff641e)',
                            background: 'rgba(255, 100, 30, 0.05)',
                            fontSize: '13px',
                            lineHeight: 1.55,
                            color: '#1e293b',
                          }}
                        >
                          <strong style={{ color: 'var(--color-text, #121212)' }}>谈单切入话术：</strong>
                          {node.sales_pitch_angle}
                        </div>
                      </div>

                      {/* 右栏：该渠道主要渠道商列表（平台有研报时直接超链接至报告详情页） */}
                      {players.length > 0 && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', minWidth: 0 }}>
                          <div
                            style={{
                              fontSize: '12.5px',
                              fontWeight: 700,
                              color: '#0f172a',
                            }}
                          >
                            主要渠道商（{players.length}）
                          </div>

                          {players.map((player, pIdx) => {
                            const safeDomain = getSafeWebsiteDomain(player.website);
                            const matched = lookupPlayerMatch(playerMatches, player);
                            const safeReportPath = getSafeReportPath(matched);

                            return (
                              <div
                                key={`${node.id}-player-${player.name}-${pIdx}`}
                                style={{
                                  background: '#ffffff',
                                  border: '1px solid rgba(18, 18, 18, 0.08)',
                                  borderRadius: '10px',
                                  padding: '10px 12px',
                                  display: 'flex',
                                  alignItems: 'flex-start',
                                  gap: '10px',
                                }}
                              >
                                <PlayerLogoBadge name={player.name} logoUrl={player.logo_url} />
                                <div style={{ minWidth: 0, flex: 1 }}>
                                  <div
                                    style={{
                                      display: 'flex',
                                      flexWrap: 'wrap',
                                      alignItems: 'center',
                                      gap: '8px',
                                    }}
                                  >
                                    {safeReportPath ? (
                                      <Link
                                        href={safeReportPath}
                                        style={{
                                          fontWeight: 700,
                                          fontSize: '13.5px',
                                          color: 'var(--color-accent, #ff641e)',
                                          textDecoration: 'underline',
                                          textUnderlineOffset: '2px',
                                        }}
                                      >
                                        {player.name}
                                      </Link>
                                    ) : (
                                      <span
                                        style={{
                                          fontWeight: 700,
                                          fontSize: '13.5px',
                                          color: 'var(--color-text, #121212)',
                                        }}
                                      >
                                        {player.name}
                                      </span>
                                    )}

                                    {typeof player.channel_share_pct === 'number' && player.channel_share_pct > 0 && (
                                      <span
                                        style={{
                                          fontSize: '11px',
                                          fontWeight: 700,
                                          padding: '1px 7px',
                                          borderRadius: '999px',
                                          background: 'rgba(255, 100, 30, 0.1)',
                                          color: 'var(--color-accent, #ff641e)',
                                        }}
                                      >
                                        渠道市占约 {player.channel_share_pct}%
                                      </span>
                                    )}

                                    {safeReportPath && (
                                      <Link
                                        href={safeReportPath}
                                        style={{
                                          fontSize: '11.5px',
                                          fontWeight: 700,
                                          color: '#ffffff',
                                          background: 'var(--color-accent, #ff641e)',
                                          padding: '2px 8px',
                                          borderRadius: '6px',
                                          textDecoration: 'none',
                                        }}
                                      >
                                        查看客户研报 →
                                      </Link>
                                    )}

                                    {safeDomain && (
                                      <a
                                        href={`https://${safeDomain}`}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        style={{
                                          fontSize: '12px',
                                          color: 'var(--color-muted, #666666)',
                                          textDecoration: 'underline',
                                          textUnderlineOffset: '2px',
                                        }}
                                      >
                                        {safeDomain}
                                      </a>
                                    )}
                                  </div>
                                  <div
                                    style={{
                                      fontSize: '12px',
                                      color: 'var(--color-muted, #666666)',
                                      marginTop: '3px',
                                      lineHeight: 1.45,
                                    }}
                                  >
                                    {player.business_model}
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </article>
                );
              })}
            </div>
          </div>
        );
      })}
    </section>
  );
}
