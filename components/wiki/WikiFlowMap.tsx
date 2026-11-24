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

const TIER_LIST: Array<1 | 2 | 3 | 4> = [1, 2, 3, 4];

const TIER_TITLES: Record<1 | 2 | 3 | 4, string> = {
  1: '一级进口 / 品牌与总代层',
  2: '二级大宗分销 / 连锁商超层',
  3: '三级区域批发 / 工程集成层',
  4: '四级终端零售 / 履约交付层',
};

const SAFE_DOMAIN_RE =
  /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)+$/i;

/**
 * 提取并严格校验玩家官网根域名，阻断任何非标准域名或脚本伪协议
 */
function getSafeWebsiteDomain(rawWebsite?: string): string | null {
  if (typeof rawWebsite !== 'string' || !rawWebsite.trim()) return null;
  const domain = extractRootDomain(rawWebsite);
  if (!domain || !SAFE_DOMAIN_RE.test(domain)) return null;
  const verifiedUrl = sanitizeUrl(`https://${domain}`);
  return verifiedUrl ? domain : null;
}

/**
 * 使用 Object.prototype.hasOwnProperty 安全查找玩家站内资产匹配结果，防止原型链碰撞
 */
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

/**
 * 提取企业品牌首字符 Monogram，使用 Array.from 兼容 Unicode 代理对字符
 */
function getBrandMonogram(name: string): string {
  const trimmed = String(name || '').trim();
  const firstChar = Array.from(trimmed)[0];
  if (!firstChar) return '?';
  return /^[a-z]$/i.test(firstChar) ? firstChar.toUpperCase() : firstChar;
}

/**
 * 玩家 Logo 墙徽章：严格遵循 44×44 白底圆角容器；
 * 仅放行 isSafeWikiUrl 校验通过的 http(s)/站内路径（拒绝 #... 锚点），非法链接或加载失败时降级为首字母 Monogram。
 */
function PlayerLogoBadge({ name, logoUrl }: { name: string; logoUrl?: string }) {
  const [imgFailed, setImgFailed] = useState(false);
  const trimmedLogo = typeof logoUrl === 'string' ? logoUrl.trim() : '';
  const safeLogoUrl = trimmedLogo && isSafeWikiUrl(trimmedLogo) ? trimmedLogo : null;

  // 当同一徽章复用且切换为新的有效 logo_url 时，重置加载失败状态
  useEffect(() => {
    setImgFailed(false);
  }, [safeLogoUrl]);

  const showImage = Boolean(safeLogoUrl && !imgFailed);

  return (
    <div
      style={{
        width: '44px',
        height: '44px',
        minWidth: '44px',
        background: '#ffffff',
        borderRadius: '10px',
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
            width: '44px',
            height: '44px',
            maxWidth: '100%',
            maxHeight: '100%',
            background: '#ffffff',
            borderRadius: '10px',
            objectFit: 'contain',
          }}
        />
      ) : (
        <span
          aria-label={`${name} 品牌徽章`}
          style={{
            fontSize: '16px',
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
 * 行业百科分层流通图谱组件：
 * - 按 Tier 1 -> 4 垂直分层渲染渠道节点，全部痛点与谈单话术始终在 SSR DOM 可见；
 * - 集成玩家 Logo 墙与站内客户研报 / CRM 联系人资产自动联动钩子。
 */
export default function WikiFlowMap({
  nodes,
  playerMatches,
  onRequestCustomReport,
}: WikiFlowMapProps) {
  const safeNodes = Array.isArray(nodes) ? nodes : [];
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(safeNodes[0]?.id ?? null);

  if (safeNodes.length === 0) {
    return null;
  }

  return (
    <section aria-label="海外市场分层流通渠道图谱" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {TIER_LIST.map((tier) => {
        const tierNodes = safeNodes.filter((n) => n.tier === tier);
        if (tierNodes.length === 0) return null;

        return (
          <div
            key={`flow-tier-${tier}`}
            style={{
              background: '#ffffff',
              border: '1px solid rgba(18, 18, 18, 0.08)',
              borderRadius: '14px',
              padding: '20px',
              boxShadow: '0 4px 16px rgba(18, 18, 18, 0.03)',
            }}
          >
            <div
              style={{
                display: 'flex',
                flexWrap: 'wrap',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '8px',
                paddingBottom: '12px',
                marginBottom: '16px',
                borderBottom: '1px solid rgba(18, 18, 18, 0.07)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
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
                  {`Tier ${tier}`}
                </span>
                <h3
                  className="font-editorial"
                  style={{
                    margin: 0,
                    fontSize: '1.1rem',
                    fontWeight: 700,
                    color: 'var(--color-text, #121212)',
                  }}
                >
                  {TIER_TITLES[tier]}
                </h3>
              </div>
              <span style={{ fontSize: '12px', color: 'var(--color-muted, #666666)' }}>
                本层级包含 {tierNodes.length} 类核心渠道节点
              </span>
            </div>

            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
                gap: '16px',
              }}
            >
              {tierNodes.map((node, idx) => {
                const isSelected = selectedNodeId === node.id;
                const painPoints = Array.isArray(node.buyer_pain_points) ? node.buyer_pain_points : [];
                const players = Array.isArray(node.players) ? node.players : [];

                return (
                  <article
                    key={`${node.id}-${idx}`}
                    style={{
                      borderRadius: '12px',
                      padding: '18px',
                      background: isSelected ? 'rgba(255, 100, 30, 0.03)' : '#fafafa',
                      border: isSelected
                        ? '1.5px solid var(--color-accent, #ff641e)'
                        : '1px solid rgba(18, 18, 18, 0.09)',
                      boxShadow: isSelected ? '0 8px 22px rgba(255, 100, 30, 0.08)' : 'none',
                      transition: 'border-color 0.2s ease, box-shadow 0.2s ease, background 0.2s ease',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '14px',
                    }}
                  >
                    {/* 节点标题、份额/毛利指标与无障碍聚焦按钮 */}
                    <div
                      style={{
                        display: 'flex',
                        flexWrap: 'wrap',
                        justifyContent: 'space-between',
                        alignItems: 'flex-start',
                        gap: '8px',
                      }}
                    >
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                        <h4
                          style={{
                            margin: 0,
                            fontSize: '1.05rem',
                            fontWeight: 700,
                            color: 'var(--color-text, #121212)',
                          }}
                        >
                          {node.label_cn}
                        </h4>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                          <span
                            style={{
                              fontSize: '12px',
                              fontWeight: 600,
                              padding: '2px 8px',
                              borderRadius: '6px',
                              background: '#ffffff',
                              border: '1px solid rgba(18, 18, 18, 0.1)',
                              color: 'var(--color-text, #121212)',
                            }}
                          >
                            渠道份额 {node.share_pct}%
                          </span>
                          <span
                            style={{
                              fontSize: '12px',
                              fontWeight: 600,
                              padding: '2px 8px',
                              borderRadius: '6px',
                              background: 'rgba(15, 23, 42, 0.05)',
                              color: '#334155',
                            }}
                          >
                            毛利 {node.typical_margin_range}
                          </span>
                        </div>
                      </div>

                      <button
                        type="button"
                        aria-pressed={isSelected}
                        onClick={() => setSelectedNodeId(node.id)}
                        style={{
                          fontSize: '11.5px',
                          fontWeight: 600,
                          padding: '4px 9px',
                          borderRadius: '999px',
                          cursor: 'pointer',
                          border: isSelected
                            ? '1px solid var(--color-accent, #ff641e)'
                            : '1px solid rgba(18, 18, 18, 0.14)',
                          background: isSelected ? 'var(--color-accent, #ff641e)' : '#ffffff',
                          color: isSelected ? '#ffffff' : 'var(--color-muted, #666666)',
                        }}
                      >
                        {isSelected ? '已聚焦' : '聚焦此层级'}
                      </button>
                    </div>

                    {/* 买家核心痛点标签（始终展开，保障爬虫直读） */}
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
                          买家核心痛点
                        </div>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                          {painPoints.map((point, pIdx) => (
                            <span
                              key={`${node.id}-pain-${pIdx}`}
                              style={{
                                fontSize: '12px',
                                lineHeight: 1.4,
                                padding: '3px 9px',
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

                    {/* 谈单切入话术 */}
                    <div
                      style={{
                        padding: '10px 12px',
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

                    {/* 代表买家 Logo 墙与站内资产联动 */}
                    {players.length > 0 && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                        <div
                          style={{
                            fontSize: '12px',
                            fontWeight: 700,
                            color: 'var(--color-muted, #666666)',
                          }}
                        >
                          代表企业与平台资产联动（{players.length}）
                        </div>
                        {players.map((player, pIdx) => {
                          const safeDomain = getSafeWebsiteDomain(player.website);
                          const matched = lookupPlayerMatch(playerMatches, player);
                          const rawReportId = typeof matched?.reportId === 'string' ? matched.reportId.trim() : '';
                          const safeReportPath =
                            rawReportId && !/[/?#\\]/.test(rawReportId) && isSafeWikiUrl(`/reports/${rawReportId}`)
                              ? `/reports/${rawReportId}`
                              : null;
                          const contactCount = matched?.contactCount ?? 0;

                          return (
                            <div
                              key={`${node.id}-player-${player.name}-${pIdx}`}
                              style={{
                                background: '#ffffff',
                                border: '1px solid rgba(18, 18, 18, 0.08)',
                                borderRadius: '10px',
                                padding: '10px 12px',
                                display: 'flex',
                                flexDirection: 'column',
                                gap: '8px',
                              }}
                            >
                              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
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
                                    <span
                                      style={{
                                        fontWeight: 700,
                                        fontSize: '13.5px',
                                        color: 'var(--color-text, #121212)',
                                      }}
                                    >
                                      {player.name}
                                    </span>
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
                                      marginTop: '2px',
                                      lineHeight: 1.45,
                                    }}
                                  >
                                    {player.business_model}
                                  </div>
                                </div>
                              </div>

                              {/* 站内深度研报与采购联系人变现钩子 */}
                              {(safeReportPath || contactCount > 0) && (
                                <div
                                  style={{
                                    display: 'flex',
                                    flexWrap: 'wrap',
                                    alignItems: 'center',
                                    gap: '8px',
                                    paddingTop: '6px',
                                    borderTop: '1px dashed rgba(18, 18, 18, 0.08)',
                                  }}
                                >
                                  {safeReportPath && (
                                    <Link
                                      href={safeReportPath}
                                      style={{
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        fontSize: '12px',
                                        fontWeight: 700,
                                        color: '#ffffff',
                                        background: 'var(--color-accent, #ff641e)',
                                        padding: '4px 10px',
                                        borderRadius: '6px',
                                        textDecoration: 'none',
                                      }}
                                    >
                                      查看 360° 客户研报 →
                                    </Link>
                                  )}

                                  {safeReportPath && contactCount > 0 && (
                                    <Link
                                      href={safeReportPath}
                                      style={{
                                        fontSize: '12px',
                                        fontWeight: 600,
                                        color: 'var(--color-accent, #ff641e)',
                                        textDecoration: 'none',
                                      }}
                                    >
                                      已收录 {contactCount} 位采购联系人
                                    </Link>
                                  )}

                                  {!safeReportPath && contactCount > 0 && (
                                    <button
                                      type="button"
                                      onClick={() => onRequestCustomReport?.()}
                                      style={{
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        fontSize: '12px',
                                        fontWeight: 600,
                                        color: 'var(--color-accent, #ff641e)',
                                        background: 'rgba(255, 100, 30, 0.08)',
                                        border: '1px solid rgba(255, 100, 30, 0.28)',
                                        padding: '4px 10px',
                                        borderRadius: '6px',
                                        cursor: 'pointer',
                                      }}
                                    >
                                      已收录 {contactCount} 位采购联系人 · 申请研报解锁
                                    </button>
                                  )}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
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
