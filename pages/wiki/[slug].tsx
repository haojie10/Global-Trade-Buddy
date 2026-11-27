import React, { useEffect, useState } from 'react';
import type { GetServerSideProps } from 'next';
import Head from 'next/head';
import Link from 'next/link';
import pool from '../../lib/db';
import { resolveSsrAuth } from '../../lib/ssr-auth';
import {
  matchPlayersWithPlatformAssets,
  getRelatedReportsForWiki,
  type PlayerAssetMatch,
  type RelatedWikiReport,
} from '../../lib/wiki-service';
import {
  ARCHETYPE_META,
  buildWikiDetailJsonLd,
  calcPriceMultiplier,
  collectAllWikiPlayers,
  generateDefaultFaqs,
  isSafeWikiUrl,
  type ArchetypeId,
  type MarketFlowData,
  type WikiEntryRecord,
  type WikiFaqItem,
  type WikiSourceItem,
} from '../../lib/wiki-schema';
import { cleanCompanyNameForLookup, extractRootDomain } from '../../lib/domain-utils';
import WatermarkContainer from '../../components/WatermarkContainer';
import Navbar from '../../components/Navbar';
import Footer from '../../components/Footer';
import AuthModal from '../../components/AuthModal';
import FeedbackModal from '../../components/FeedbackModal';
import JsonLdScript from '../../components/wiki/JsonLdScript';
import SafeMarkdown, { extractTocHeadings } from '../../components/wiki/SafeMarkdown';
import WikiPriceWaterfall from '../../components/wiki/WikiPriceWaterfall';
import WikiFlowMap from '../../components/wiki/WikiFlowMap';
import WikiMarketPlayers from '../../components/wiki/WikiMarketPlayers';

const SITE_URL = 'https://marketgraphic.cn';

export interface WikiDetailProps {
  entry: WikiEntryRecord;
  playerMatches: Record<string, PlayerAssetMatch>;
  relatedReports: RelatedWikiReport[];
  userId: string | null;
  userRole: string;
  quota: number;
  downloadQuota: number;
  memberType: string;
  nickname: string;
  userEmail: string;
}

function toIsoStringSafe(value: unknown, fallback = ''): string {
  if (!value) return fallback;
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? fallback : value.toISOString();
  }
  const parsed = new Date(String(value));
  return Number.isNaN(parsed.getTime()) ? String(value) : parsed.toISOString();
}

function parseJsonColumn<T>(raw: unknown, fallback: T): T {
  if (raw === null || raw === undefined) return fallback;
  if (typeof raw === 'string') {
    try {
      return JSON.parse(raw) as T;
    } catch {
      return fallback;
    }
  }
  return raw as T;
}

function toAbsoluteSafeImageUrl(raw?: string | null): string | null {
  if (!raw || !isSafeWikiUrl(raw)) return null;
  const trimmed = raw.trim();
  return trimmed.startsWith('/') ? `${SITE_URL}${trimmed}` : trimmed;
}

/**
 * 行业百科详情页：完全公开免登录 + 全量 SSR + 原生 GEO 结构化标注与站内研报变现闭环
 */
export default function WikiDetailPage({
  entry,
  playerMatches,
  relatedReports,
  userId,
  userRole,
  quota,
  downloadQuota,
  memberType,
  nickname,
  userEmail,
}: WikiDetailProps) {
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [showCustomModal, setShowCustomModal] = useState(false);
  const [copiedMdLink, setCopiedMdLink] = useState(false);

  const handleCopyMarkdownUrl = () => {
    const fullUrl = `${SITE_URL}/wiki/${entry.slug}.md`;
    if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
      navigator.clipboard
        .writeText(fullUrl)
        .then(() => {
          setCopiedMdLink(true);
          setTimeout(() => setCopiedMdLink(false), 2000);
        })
        .catch(() => {});
    }
  };

  // 浏览统计与停留时长上报（严格置于组件顶层，挂载时仅计数一次，离页/切后台更新累计时长）
  useEffect(() => {
    if (!entry?.id) return;

    let viewId: string | null = null;
    const startTime = Date.now();
    let lastSentDuration = 0;

    fetch('/api/track/pageview', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content_type: 'wiki', content_id: entry.id }),
    })
      .then((res) => res.json())
      .then((data) => {
        if (data?.view_id) {
          viewId = data.view_id;
        }
      })
      .catch(() => {});

    const sendDuration = () => {
      if (!viewId) return;
      const durationSeconds = Math.round((Date.now() - startTime) / 1000);
      if (durationSeconds <= 0 || durationSeconds === lastSentDuration) return;
      lastSentDuration = durationSeconds;
      fetch('/api/track/pageview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ view_id: viewId, duration_seconds: durationSeconds }),
        keepalive: true,
      }).catch(() => {});
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        sendDuration();
      }
    };

    window.addEventListener('beforeunload', sendDuration);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      sendDuration();
      window.removeEventListener('beforeunload', sendDuration);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [entry?.id]);

  // 安全读取流通原型元数据，防止原型链键名碰撞
  const archetype = Object.prototype.hasOwnProperty.call(ARCHETYPE_META, entry.archetype_id)
    ? ARCHETYPE_META[entry.archetype_id]
    : {
        nameCn: String(entry.archetype_id),
        shortTag: String(entry.archetype_id),
        accent: '#ff641e',
      };

  const flowNodes = Array.isArray(entry.flow_data?.flow_nodes) ? entry.flow_data.flow_nodes : [];
  const priceWaterfall = Array.isArray(entry.flow_data?.price_waterfall)
    ? entry.flow_data.price_waterfall
    : [];
  const topImportSources = Array.isArray(entry.flow_data?.supply_origin?.top_import_sources)
    ? entry.flow_data.supply_origin.top_import_sources
    : [];
  const localManufacturers = Array.isArray(entry.flow_data?.supply_origin?.local_manufacturers)
    ? entry.flow_data.supply_origin.local_manufacturers
    : [];
  const marketPlayerGroups = Array.isArray(entry.flow_data?.market_players)
    ? entry.flow_data.market_players
    : [];
  const reportOverview = entry.flow_data?.report_overview;
  const localPct = entry.flow_data?.supply_origin?.local_manufacturing_pct ?? 0;
  const importPct = entry.flow_data?.supply_origin?.import_pct ?? 0;
  const priceMultiplier = calcPriceMultiplier(entry.flow_data);
  const uniquePlayerKeys = new Set(
    collectAllWikiPlayers(entry.flow_data).map((p) => extractRootDomain(p.website) || p.name)
  );
  const totalPlayers = uniquePlayerKeys.size;

  const resolvedFaqs: WikiFaqItem[] =
    Array.isArray(entry.faq_items) && entry.faq_items.length > 0
      ? entry.faq_items
      : generateDefaultFaqs(entry.flow_data, entry.title);

  const tocHeadings = extractTocHeadings(entry.content_md || '');
  const sources = Array.isArray(entry.sources) ? entry.sources : [];
  const updatedDate = (entry.updated_at || entry.published_at || '').slice(0, 10);

  const safeVideoUrl =
    entry.video_url && isSafeWikiUrl(entry.video_url) ? entry.video_url.trim() : null;
  const safeCoverUrl =
    entry.cover_image && isSafeWikiUrl(entry.cover_image) ? entry.cover_image.trim() : null;
  const ogImageUrl = toAbsoluteSafeImageUrl(entry.cover_image) || `${SITE_URL}/images/global_trade_trends.jpg`;

  const canonicalUrl = `${SITE_URL}/wiki/${entry.slug}`;
  const markdownHref = `/wiki/${entry.slug}.md`;
  const jsonLd = buildWikiDetailJsonLd(entry, resolvedFaqs);

  return (
    <WatermarkContainer text={userId ? `外贸智友 - 用户: ${nickname || userId.slice(0, 8)}` : '外贸智友 - 公开行业百科'}>
      <Head>
        <title>{`${entry.title} | Market Graphic 行业百科`}</title>
        <meta name="description" content={entry.summary} />
        <meta
          name="keywords"
          content={`${entry.country_name},${entry.industry_name},${entry.hs_code_6 || ''},海外市场流通图谱,价格瀑布,Market Graphic`}
        />
        <meta name="robots" content="index, follow" />
        <link rel="canonical" href={canonicalUrl} />
        <link rel="alternate" type="text/markdown" href={`${SITE_URL}${markdownHref}`} />
        <meta property="og:type" content="article" />
        <meta property="og:title" content={entry.title} />
        <meta property="og:description" content={entry.summary} />
        <meta property="og:url" content={canonicalUrl} />
        <meta property="og:site_name" content="Market Graphic (外贸智友)" />
        <meta property="og:image" content={ogImageUrl} />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content={entry.title} />
        <meta name="twitter:description" content={entry.summary} />
        <meta name="twitter:image" content={ogImageUrl} />
      </Head>

      {/* JsonLdScript 内部自带 next/head <Head>，必须作为 <Head> 兄弟节点渲染 */}
      <JsonLdScript data={jsonLd.article} />
      <JsonLdScript data={jsonLd.breadcrumb} />
      <JsonLdScript data={jsonLd.faqPage} />
      <JsonLdScript data={jsonLd.dataset} />

      <Navbar
        userId={userId}
        userRole={userRole}
        quota={quota}
        downloadQuota={downloadQuota}
        memberType={memberType}
        nickname={nickname}
        userEmail={userEmail}
        onShowAuthModal={() => setShowAuthModal(true)}
      />

      <main className="responsive-page-container" style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
        {/* 1. 面包屑导航 */}
        <nav aria-label="面包屑导航" style={{ fontSize: '13px', color: 'var(--color-muted, #666666)' }}>
          <Link href="/" style={{ color: 'var(--color-muted, #666666)', textDecoration: 'none' }}>
            首页
          </Link>
          <span style={{ margin: '0 8px', opacity: 0.5 }}>/</span>
          <Link href="/wiki" style={{ color: 'var(--color-muted, #666666)', textDecoration: 'none' }}>
            行业百科
          </Link>
          <span style={{ margin: '0 8px', opacity: 0.5 }}>/</span>
          <span style={{ color: 'var(--color-text, #121212)', fontWeight: 600 }}>
            {entry.country_name} · {entry.industry_name}
          </span>
        </nav>

        {/* 2. 标题区 + GEO 核心事实速览 <dl> + 3. 可选 35 秒竖屏短视频位 */}
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: '24px',
            alignItems: 'flex-start',
          }}
        >
          <header
            style={{
              flex: '999 1 560px',
              minWidth: 0,
              background: '#ffffff',
              border: '1px solid rgba(18, 18, 18, 0.08)',
              borderRadius: '16px',
              padding: '28px',
              boxShadow: '0 6px 24px rgba(18, 18, 18, 0.03)',
              display: 'flex',
              flexDirection: 'column',
              gap: '18px',
            }}
          >
            {/* 维标徽章 */}
            <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '8px' }}>
              <span
                style={{
                  fontSize: '12.5px',
                  fontWeight: 700,
                  padding: '4px 10px',
                  borderRadius: '999px',
                  background: 'rgba(18, 18, 18, 0.05)',
                  color: 'var(--color-text, #121212)',
                }}
              >
                {entry.country_name} · {entry.market_region}
              </span>
              <span
                style={{
                  fontSize: '12.5px',
                  fontWeight: 700,
                  padding: '4px 10px',
                  borderRadius: '999px',
                  background: 'rgba(255, 100, 30, 0.1)',
                  color: 'var(--color-accent, #ff641e)',
                }}
              >
                {entry.industry_name}
              </span>
              {entry.hs_code_6 && (
                <span
                  style={{
                    fontSize: '12px',
                    fontWeight: 600,
                    padding: '4px 10px',
                    borderRadius: '8px',
                    background: 'rgba(15, 23, 42, 0.05)',
                    color: '#334155',
                    fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
                  }}
                >
                  HS {entry.hs_code_6}
                </span>
              )}
              <span
                style={{
                  fontSize: '12.5px',
                  fontWeight: 600,
                  padding: '4px 10px',
                  borderRadius: '999px',
                  color: archetype.accent,
                  background: `${archetype.accent}14`,
                }}
              >
                {archetype.nameCn}
              </span>
            </div>

            <h1
              className="font-editorial"
              style={{
                margin: 0,
                fontSize: '2.1rem',
                fontWeight: 700,
                lineHeight: 1.28,
                color: 'var(--color-text, #121212)',
              }}
            >
              {entry.title}
            </h1>

            {/* 报告导读与核心结论（与标题区合并为一个紧凑总览模块） */}
            {reportOverview ? (
              <div
                aria-label="报告导读与核心结论"
                style={{
                  background: 'linear-gradient(135deg, rgba(255, 100, 30, 0.05), rgba(15, 23, 42, 0.02))',
                  border: '1px solid rgba(255, 100, 30, 0.2)',
                  borderRadius: '12px',
                  padding: '16px 18px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '12px',
                }}
              >
                <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: '8px' }}>
                  <span
                    style={{
                      fontSize: '12px',
                      fontWeight: 800,
                      color: 'var(--color-accent, #ff641e)',
                      letterSpacing: '0.04em',
                    }}
                  >
                    报告导读 · 本文帮你看清什么？
                  </span>
                  {reportOverview.market_size_label && (
                    <span
                      style={{
                        fontSize: '12px',
                        fontWeight: 700,
                        padding: '2px 9px',
                        borderRadius: '999px',
                        background: '#ffffff',
                        border: '1px solid rgba(18, 18, 18, 0.1)',
                        color: '#0f172a',
                      }}
                    >
                      市场体量：{reportOverview.market_size_label}
                    </span>
                  )}
                </div>
                <p style={{ margin: 0, fontSize: '0.94rem', lineHeight: 1.68, color: '#1e293b' }}>
                  {reportOverview.purpose}
                </p>
                {Array.isArray(reportOverview.key_takeaways) && reportOverview.key_takeaways.length > 0 && (
                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
                      gap: '8px',
                    }}
                  >
                    {reportOverview.key_takeaways.map((point, idx) => (
                      <div
                        key={`overview-takeaway-${idx}`}
                        style={{
                          background: '#ffffff',
                          border: '1px solid rgba(18, 18, 18, 0.08)',
                          borderRadius: '8px',
                          padding: '10px 12px',
                          fontSize: '12.5px',
                          lineHeight: 1.5,
                          color: '#334155',
                          display: 'flex',
                          gap: '7px',
                          alignItems: 'flex-start',
                        }}
                      >
                        <span
                          style={{
                            fontWeight: 800,
                            color: 'var(--color-accent, #ff641e)',
                            fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
                          }}
                        >
                          0{idx + 1}
                        </span>
                        <span>{point}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <p
                style={{
                  margin: 0,
                  fontSize: '1rem',
                  lineHeight: 1.7,
                  color: '#334155',
                }}
              >
                {entry.summary}
              </p>
            )}

            {/* GEO 核心事实速览 <dl> */}
            <dl
              aria-label="GEO 核心事实速览"
              style={{
                margin: 0,
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                gap: '12px',
                padding: '16px',
                borderRadius: '12px',
                background: 'rgba(15, 23, 42, 0.03)',
                border: '1px solid rgba(15, 23, 42, 0.06)',
              }}
            >
              <div>
                <dt style={{ fontSize: '12px', color: 'var(--color-muted, #666666)', marginBottom: '4px' }}>
                  本土制造 / 进口依赖度
                </dt>
                <dd style={{ margin: 0, fontSize: '1.05rem', fontWeight: 700, color: 'var(--color-text, #121212)' }}>
                  本土 {localPct}% · 进口 {importPct}%
                </dd>
              </div>
              <div>
                <dt style={{ fontSize: '12px', color: 'var(--color-muted, #666666)', marginBottom: '4px' }}>
                  FOB → 终端零售倍率
                </dt>
                <dd style={{ margin: 0, fontSize: '1.05rem', fontWeight: 700, color: 'var(--color-accent, #ff641e)' }}>
                  {priceMultiplier}
                </dd>
              </div>
              <div>
                <dt style={{ fontSize: '12px', color: 'var(--color-muted, #666666)', marginBottom: '4px' }}>
                  收录真实渠道玩家
                </dt>
                <dd style={{ margin: 0, fontSize: '1.05rem', fontWeight: 700, color: 'var(--color-text, #121212)' }}>
                  {totalPlayers} 家代表企业
                </dd>
              </div>
            </dl>

            {/* 更新日期与机器直读 Markdown 链接 */}
            <div
              style={{
                display: 'flex',
                flexWrap: 'wrap',
                justifyContent: 'space-between',
                alignItems: 'center',
                gap: '12px',
                paddingTop: '12px',
                borderTop: '1px solid rgba(18, 18, 18, 0.08)',
                fontSize: '13px',
                color: 'var(--color-muted, #666666)',
              }}
            >
              <span>最近校准更新：{updatedDate || '2026-11-24'}</span>
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                <a
                  href={markdownHref}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    fontWeight: 600,
                    color: 'var(--color-accent, #ff641e)',
                    textDecoration: 'underline',
                    textUnderlineOffset: '3px',
                  }}
                >
                  查看机器直读 Markdown (.md)
                </a>
                <button
                  type="button"
                  onClick={handleCopyMarkdownUrl}
                  style={{
                    background: 'rgba(18, 18, 18, 0.05)',
                    border: '1px solid rgba(18, 18, 18, 0.12)',
                    borderRadius: '6px',
                    padding: '4px 10px',
                    fontSize: '12px',
                    color: 'var(--color-text, #111111)',
                    cursor: 'pointer',
                  }}
                >
                  {copiedMdLink ? '已复制 .md 链接' : '复制 Markdown 链接'}
                </button>
              </div>
            </div>
          </header>

          {/* 3. 可选 35 秒竖屏短视频位（仅安全非空 URL 渲染） */}
          {safeVideoUrl && (
            <aside
              aria-label="35 秒行业洞察短视频"
              style={{
                flex: '1 1 280px',
                maxWidth: '340px',
                width: '100%',
                background: '#0f172a',
                borderRadius: '16px',
                padding: '14px',
                color: '#ffffff',
                display: 'flex',
                flexDirection: 'column',
                gap: '10px',
                boxShadow: '0 10px 28px rgba(15, 23, 42, 0.16)',
                boxSizing: 'border-box',
              }}
            >
              <div style={{ fontSize: '12px', fontWeight: 700, color: '#fb923c', letterSpacing: '0.5px' }}>
                35 秒竖屏市场拆解
              </div>
              <video
                controls
                playsInline
                preload="metadata"
                poster={safeCoverUrl || undefined}
                src={safeVideoUrl}
                style={{
                  width: '100%',
                  aspectRatio: '9 / 16',
                  maxHeight: '460px',
                  borderRadius: '10px',
                  background: '#020617',
                  objectFit: 'cover',
                }}
              />
              {entry.flow_data?.video_hook?.headline_opening && (
                <div style={{ fontSize: '12.5px', lineHeight: 1.5, color: '#e2e8f0' }}>
                  {entry.flow_data.video_hook.headline_opening}
                </div>
              )}
            </aside>
          )}
        </div>

        {/* 4. 供给源头格局 */}
        <section
          aria-label="供给源头格局"
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
          <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'baseline', gap: '8px' }}>
            <h2 className="font-editorial" style={{ margin: 0, fontSize: '1.35rem', fontWeight: 700, color: 'var(--color-text, #121212)' }}>
              一、供给源头格局（本土制造 vs 海外进口）
            </h2>
            <span style={{ fontSize: '13px', color: 'var(--color-muted, #666666)' }}>
              本土 {localPct}% / 进口 {importPct}%
            </span>
          </div>

          {/* 堆叠进度条 */}
          <div>
            <div
              role="img"
              aria-label={`本土制造占 ${localPct}%，海外进口占 ${importPct}%`}
              style={{
                display: 'flex',
                width: '100%',
                height: '16px',
                borderRadius: '999px',
                overflow: 'hidden',
                background: 'rgba(18, 18, 18, 0.06)',
              }}
            >
              <div
                style={{
                  width: `${Math.max(0, Math.min(100, localPct))}%`,
                  background: '#334155',
                  height: '100%',
                }}
              />
              <div
                style={{
                  width: `${Math.max(0, Math.min(100, importPct))}%`,
                  background: 'var(--color-accent, #ff641e)',
                  height: '100%',
                }}
              />
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '8px', fontSize: '12.5px', color: '#334155' }}>
              <span>本土制造：{localPct}%</span>
              <span style={{ color: 'var(--color-accent, #ff641e)', fontWeight: 600 }}>海外进口依赖：{importPct}%</span>
            </div>
          </div>

          {/* Top 进口来源国卡片 */}
          {topImportSources.length > 0 && (
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
                gap: '12px',
              }}
            >
              {topImportSources.map((src, idx) => (
                <div
                  key={`import-source-${src.country_name_cn}-${idx}`}
                  style={{
                    padding: '14px 16px',
                    borderRadius: '10px',
                    background: '#fafafa',
                    border: '1px solid rgba(18, 18, 18, 0.08)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '6px',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px' }}>
                    <strong style={{ fontSize: '14px', color: 'var(--color-text, #121212)' }}>
                      {src.country_name_cn}
                    </strong>
                    <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--color-accent, #ff641e)' }}>
                      约 {src.share_pct}%
                    </span>
                  </div>
                  <p style={{ margin: 0, fontSize: '12.5px', color: '#475569', lineHeight: 1.5 }}>
                    {src.positioning}
                  </p>
                  {src.verified_by_comtrade && (
                    <span style={{ fontSize: '11px', fontWeight: 600, color: '#059669' }}>
                      UN Comtrade 贸易流校验
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* 本土头部制造商清单 */}
          {localManufacturers.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', paddingTop: '8px', borderTop: '1px solid rgba(18, 18, 18, 0.07)' }}>
              <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'baseline', gap: '8px' }}>
                <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 700, color: '#0f172a' }}>
                  {entry.country_name}本土头部制造商（{localManufacturers.length} 家）
                </h3>
                <span style={{ fontSize: '12px', color: '#64748b' }}>
                  看清本土工厂守住哪些高端细分、哪些常规货盘依赖海外 OEM
                </span>
              </div>
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fill, minmax(270px, 1fr))',
                  gap: '12px',
                }}
              >
                {localManufacturers.map((mfr, idx) => {
                  const domain = extractRootDomain(mfr.website);
                  const cleanName = cleanCompanyNameForLookup(mfr.name);
                  const matched =
                    (domain && playerMatches?.[domain]) ||
                    (cleanName && playerMatches?.[cleanName]) ||
                    null;
                  const rawReportId = typeof matched?.reportId === 'string' ? matched.reportId.trim() : '';
                  const safeReportPath =
                    rawReportId && !/[/?#\\]/.test(rawReportId) && isSafeWikiUrl(`/reports/${rawReportId}`)
                      ? `/reports/${rawReportId}`
                      : null;

                  return (
                    <div
                      key={`local-mfr-${mfr.website}-${idx}`}
                      style={{
                        padding: '12px 14px',
                        borderRadius: '10px',
                        background: '#fafafa',
                        border: '1px solid rgba(18, 18, 18, 0.08)',
                        display: 'flex',
                        alignItems: 'flex-start',
                        gap: '10px',
                      }}
                    >
                      <div
                        style={{
                          width: '38px',
                          height: '38px',
                          minWidth: '38px',
                          borderRadius: '8px',
                          background: '#ffffff',
                          border: '1px solid rgba(18, 18, 18, 0.1)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          overflow: 'hidden',
                          padding: mfr.logo_url ? '3px' : 0,
                        }}
                      >
                        {mfr.logo_url && isSafeWikiUrl(mfr.logo_url) ? (
                          <img
                            src={mfr.logo_url}
                            alt={mfr.name}
                            loading="lazy"
                            style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                          />
                        ) : (
                          <span style={{ fontSize: '14px', fontWeight: 700, color: '#059669' }}>
                            {mfr.name.slice(0, 1).toUpperCase()}
                          </span>
                        )}
                      </div>
                      <div style={{ minWidth: 0, flex: 1 }}>
                        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '6px' }}>
                          {safeReportPath ? (
                            <Link
                              href={safeReportPath}
                              style={{
                                fontSize: '13.5px',
                                fontWeight: 700,
                                color: 'var(--color-accent, #ff641e)',
                                textDecoration: 'underline',
                                textUnderlineOffset: '2px',
                              }}
                            >
                              {mfr.name}
                            </Link>
                          ) : (
                            <strong style={{ fontSize: '13.5px', color: '#0f172a' }}>{mfr.name}</strong>
                          )}
                          {mfr.headquarters && (
                            <span style={{ fontSize: '11.5px', color: '#64748b' }}>· {mfr.headquarters}</span>
                          )}
                        </div>
                        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '8px', marginTop: '2px' }}>
                          {domain && (
                            <a
                              href={`https://${domain}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              style={{ fontSize: '12px', color: '#475569', textDecoration: 'underline' }}
                            >
                              {domain}
                            </a>
                          )}
                          {safeReportPath && (
                            <Link
                              href={safeReportPath}
                              style={{
                                fontSize: '11px',
                                fontWeight: 700,
                                color: '#ffffff',
                                background: 'var(--color-accent, #ff641e)',
                                padding: '1px 7px',
                                borderRadius: '5px',
                                textDecoration: 'none',
                              }}
                            >
                              查看研报 →
                            </Link>
                          )}
                        </div>
                        <p style={{ margin: '5px 0 0', fontSize: '12.5px', color: '#475569', lineHeight: 1.48 }}>
                          {mfr.business_model}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </section>

        {/* 4.5 全域主要玩家图鉴（按国际大牌 / 本土品牌 / 本土制造商铺全） */}
        <WikiMarketPlayers
          groups={marketPlayerGroups}
          playerMatches={playerMatches || {}}
          countryName={entry.country_name}
          industryName={entry.industry_name}
          onRequestCustomReport={() => setShowCustomModal(true)}
        />

        {/* 5. 全链路渠道分布与双层占比图谱 */}
        <section aria-label="全链路渠道流通图谱" style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <h2 className="font-editorial" style={{ margin: 0, fontSize: '1.35rem', fontWeight: 700, color: 'var(--color-text, #121212)' }}>
            三、全链路渠道分布与双层占比图谱
          </h2>
          <WikiFlowMap
            nodes={flowNodes}
            playerMatches={playerMatches || {}}
            onRequestCustomReport={() => setShowCustomModal(true)}
          />
        </section>

        {/* 6. 价格瀑布与加价明细 */}
        <WikiPriceWaterfall
          stages={priceWaterfall}
          currency={entry.flow_data?.meta?.currency || 'USD'}
        />

        {/* 7. 深度图文实战解析 + 粘性章节目录 + 权威信源 */}
        <section
          aria-label="深度图文实战解析"
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: '24px',
            alignItems: 'flex-start',
          }}
        >
          <article
            style={{
              flex: '999 1 560px',
              minWidth: 0,
              background: '#ffffff',
              border: '1px solid rgba(18, 18, 18, 0.08)',
              borderRadius: '14px',
              padding: '28px',
              boxShadow: '0 4px 16px rgba(18, 18, 18, 0.03)',
            }}
          >
            <h2
              className="font-editorial"
              style={{
                margin: '0 0 18px',
                fontSize: '1.35rem',
                fontWeight: 700,
                color: 'var(--color-text, #121212)',
              }}
            >
              五、深度图文实战解析
            </h2>

            <SafeMarkdown content={entry.content_md || ''} />

            {/* 权威参考信源区 */}
            {sources.length > 0 && (
              <div
                style={{
                  marginTop: '28px',
                  paddingTop: '20px',
                  borderTop: '1px solid rgba(18, 18, 18, 0.08)',
                }}
              >
                <h3 style={{ margin: '0 0 12px', fontSize: '1rem', fontWeight: 700, color: 'var(--color-text, #121212)' }}>
                  权威参考信源
                </h3>
                <ul style={{ margin: 0, paddingLeft: '20px', display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '13.5px', color: '#334155' }}>
                  {sources.map((src: WikiSourceItem, idx: number) => {
                    const safeSourceUrl = src?.url && isSafeWikiUrl(src.url) ? src.url.trim() : null;
                    return (
                      <li key={`source-${idx}`}>
                        {safeSourceUrl ? (
                          <a
                            href={safeSourceUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{ color: 'var(--color-accent, #ff641e)', textDecoration: 'underline', textUnderlineOffset: '2px' }}
                          >
                            {src.title}
                          </a>
                        ) : (
                          <span>{src.title}</span>
                        )}
                        {src.publisher ? `（${src.publisher}）` : ''}
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}
          </article>

          {tocHeadings.length > 0 && (
            <aside
              aria-label="章节目录"
              style={{
                flex: '1 1 240px',
                maxWidth: '280px',
                width: '100%',
                position: 'sticky',
                top: '96px',
                background: '#ffffff',
                border: '1px solid rgba(18, 18, 18, 0.08)',
                borderRadius: '14px',
                padding: '18px',
                boxShadow: '0 4px 16px rgba(18, 18, 18, 0.03)',
                boxSizing: 'border-box',
              }}
            >
              <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--color-text, #121212)', marginBottom: '12px' }}>
                章节目录
              </div>
              <nav aria-label="正文目录导航">
                <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {tocHeadings.map((heading) => (
                    <li
                      key={heading.id}
                      style={{
                        paddingLeft: heading.level === 3 ? '12px' : 0,
                        fontSize: heading.level === 3 ? '12.5px' : '13px',
                      }}
                    >
                      <a
                        href={`#${heading.id}`}
                        style={{
                          color: heading.level === 3 ? 'var(--color-muted, #666666)' : '#1e293b',
                          textDecoration: 'none',
                          lineHeight: 1.45,
                          display: 'block',
                        }}
                      >
                        {heading.text}
                      </a>
                    </li>
                  ))}
                </ul>
              </nav>
            </aside>
          )}
        </section>

        {/* 8. 常见问题（FAQ）— 与 FAQPage JSON-LD 100% 同步 */}
        {resolvedFaqs.length > 0 && (
          <section
            aria-label="常见问题 FAQ"
            style={{
              background: '#ffffff',
              border: '1px solid rgba(18, 18, 18, 0.08)',
              borderRadius: '14px',
              padding: '26px',
              boxShadow: '0 4px 16px rgba(18, 18, 18, 0.03)',
              display: 'flex',
              flexDirection: 'column',
              gap: '16px',
            }}
          >
            <h2 className="font-editorial" style={{ margin: 0, fontSize: '1.35rem', fontWeight: 700, color: 'var(--color-text, #121212)' }}>
              五、常见问题（FAQ）
            </h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {resolvedFaqs.map((faq, idx) => (
                <div
                  key={`faq-item-${idx}`}
                  style={{
                    padding: '16px 18px',
                    borderRadius: '10px',
                    background: '#fafafa',
                    border: '1px solid rgba(18, 18, 18, 0.07)',
                  }}
                >
                  <h3 style={{ margin: '0 0 8px', fontSize: '15px', fontWeight: 700, color: 'var(--color-text, #121212)' }}>
                    Q{idx + 1}：{faq.q}
                  </h3>
                  <p style={{ margin: 0, fontSize: '14px', lineHeight: 1.65, color: '#334155' }}>
                    {faq.a}
                  </p>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* 9. 站内商业化转化区 */}
        <section
          aria-label="延伸研报与定制转化"
          style={{
            background: 'linear-gradient(135deg, rgba(255, 100, 30, 0.06), rgba(255, 255, 255, 0.96))',
            border: '1px solid rgba(255, 100, 30, 0.2)',
            borderRadius: '16px',
            padding: '28px',
            display: 'flex',
            flexDirection: 'column',
            gap: '20px',
          }}
        >
          <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: '14px' }}>
            <div>
              <h2 className="font-editorial" style={{ margin: 0, fontSize: '1.35rem', fontWeight: 700, color: 'var(--color-text, #121212)' }}>
                延伸深度客户与渠道研报
              </h2>
              <p style={{ margin: '6px 0 0', fontSize: '13.5px', color: 'var(--color-muted, #666666)' }}>
                获取同品类或同国家的采购决策链、关键人邮箱线索与货架选品对标方案
              </p>
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px' }}>
              <Link
                href="/reports"
                style={{
                  padding: '10px 18px',
                  borderRadius: '10px',
                  border: '1px solid rgba(18, 18, 18, 0.14)',
                  background: '#ffffff',
                  color: 'var(--color-text, #121212)',
                  fontSize: '13.5px',
                  fontWeight: 600,
                  textDecoration: 'none',
                }}
              >
                浏览报告大厅
              </Link>
              <button
                type="button"
                onClick={() => setShowCustomModal(true)}
                style={{
                  padding: '10px 18px',
                  borderRadius: '10px',
                  border: 'none',
                  background: 'var(--color-accent, #ff641e)',
                  color: '#ffffff',
                  fontSize: '13.5px',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                定制专项报告
              </button>
            </div>
          </div>

          {Array.isArray(relatedReports) && relatedReports.length > 0 && (
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
                gap: '14px',
              }}
            >
              {relatedReports.map((report) => (
                <Link
                  key={report.id}
                  href={`/reports/${report.id}`}
                  style={{
                    background: '#ffffff',
                    border: '1px solid rgba(18, 18, 18, 0.08)',
                    borderRadius: '12px',
                    padding: '16px',
                    textDecoration: 'none',
                    color: 'var(--color-text, #121212)',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    gap: '10px',
                  }}
                >
                  <div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '8px', fontSize: '11.5px' }}>
                      <span
                        style={{
                          padding: '2px 8px',
                          borderRadius: '999px',
                          background: 'rgba(255, 100, 30, 0.1)',
                          color: 'var(--color-accent, #ff641e)',
                          fontWeight: 600,
                        }}
                      >
                        {report.category === 'customer' ? '客户洞察' : '品类调研'}
                      </span>
                      {report.market_region && (
                        <span style={{ padding: '2px 8px', borderRadius: '999px', background: 'rgba(18, 18, 18, 0.05)', color: '#475569' }}>
                          {report.market_region}
                        </span>
                      )}
                    </div>
                    <h3 style={{ margin: '0 0 6px', fontSize: '15px', fontWeight: 700, lineHeight: 1.4 }}>
                      {report.title}
                    </h3>
                    <p style={{ margin: 0, fontSize: '12.5px', lineHeight: 1.55, color: 'var(--color-muted, #666666)' }}>
                      {report.summary}
                    </p>
                  </div>
                  <span style={{ fontSize: '12.5px', fontWeight: 700, color: 'var(--color-accent, #ff641e)' }}>
                    查看研报详情 →
                  </span>
                </Link>
              ))}
            </div>
          )}
        </section>
      </main>

      <AuthModal isOpen={showAuthModal} onClose={() => setShowAuthModal(false)} />
      <FeedbackModal
        isOpen={showCustomModal}
        onClose={() => setShowCustomModal(false)}
        mode="custom_report"
        userId={userId}
        userEmail={userEmail}
        onShowAuthModal={() => setShowAuthModal(true)}
      />
      <Footer />
    </WatermarkContainer>
  );
}

export const getServerSideProps: GetServerSideProps<WikiDetailProps> = async (context) => {
  const rawSlug = context.params?.slug;
  const slug = typeof rawSlug === 'string' ? rawSlug.trim().toLowerCase() : '';
  if (!slug) {
    return { notFound: true };
  }

  let dbClient: any = null;

  try {
    dbClient = await pool.connect();
    const auth = await resolveSsrAuth(context, dbClient);

    const wikiRes = await dbClient.query(
      `SELECT * FROM wiki_entries WHERE slug = $1 AND status = 'published' LIMIT 1`,
      [slug]
    );

    if (!wikiRes.rows || wikiRes.rows.length === 0) {
      return { notFound: true };
    }

    const row = wikiRes.rows[0] as Record<string, unknown>;
    const flowData = parseJsonColumn<MarketFlowData>(row.flow_data, {
      meta: {
        id: slug,
        country_code: String(row.country_code || ''),
        country_name_cn: String(row.country_name || ''),
        category_name_cn: String(row.industry_name || ''),
        archetype_id: String(row.archetype_id || 'mass_retail') as ArchetypeId,
        currency: 'USD',
        updated_at: toIsoStringSafe(row.updated_at, new Date().toISOString()),
      },
      supply_origin: {
        local_manufacturing_pct: 0,
        import_pct: 100,
        top_import_sources: [],
      },
      flow_nodes: [],
      flow_edges: [],
      price_waterfall: [],
    });

    const entry: WikiEntryRecord = {
      id: String(row.id || ''),
      slug: String(row.slug || slug),
      title: String(row.title || ''),
      summary: String(row.summary || ''),
      country_code: String(row.country_code || ''),
      country_name: String(row.country_name || ''),
      market_region: String(row.market_region || ''),
      category_id: row.category_id === null || row.category_id === undefined ? null : Number(row.category_id),
      industry_name: String(row.industry_name || ''),
      hs_code_6: row.hs_code_6 ? String(row.hs_code_6) : null,
      archetype_id: String(row.archetype_id || 'mass_retail') as ArchetypeId,
      flow_data: flowData,
      content_md: String(row.content_md || ''),
      faq_items: parseJsonColumn<WikiFaqItem[]>(row.faq_items, []),
      sources: parseJsonColumn<WikiSourceItem[]>(row.sources, []),
      video_url: row.video_url ? String(row.video_url) : null,
      cover_image: row.cover_image ? String(row.cover_image) : null,
      status: 'published',
      view_count: Number(row.view_count || 0),
      published_at: toIsoStringSafe(row.published_at || row.updated_at, new Date().toISOString()),
      created_at: toIsoStringSafe(row.created_at || row.updated_at, new Date().toISOString()),
      updated_at: toIsoStringSafe(row.updated_at || row.published_at, new Date().toISOString()),
    };

    const [playerMatches, relatedReports] = await Promise.all([
      matchPlayersWithPlatformAssets(entry.flow_data, dbClient),
      getRelatedReportsForWiki(entry.industry_name, entry.country_name, dbClient, 4),
    ]);

    const rawCookieHeader = String(context.req.headers?.cookie || '');
    const parsedCookies = (context.req as { cookies?: Record<string, unknown> }).cookies;
    const hasSessionCookie =
      /\b(gtb_session|user_id)=/.test(rawCookieHeader) ||
      Boolean(parsedCookies && (parsedCookies.gtb_session || parsedCookies.user_id));

    if (auth.userId || hasSessionCookie) {
      context.res.setHeader('Cache-Control', 'private, no-cache, no-store');
    } else {
      context.res.setHeader('Cache-Control', 'public, s-maxage=300, stale-while-revalidate=600');
    }
    context.res.setHeader('Vary', 'Cookie');

    return {
      props: {
        entry,
        playerMatches,
        relatedReports,
        userId: auth.userId,
        userRole: auth.userRole,
        quota: auth.freeQuota,
        downloadQuota: auth.downloadQuota,
        memberType: auth.memberType,
        nickname: auth.nickname,
        userEmail: auth.email,
      },
    };
  } catch (err) {
    console.error('[WikiDetailSSR] 获取行业百科详情失败:', err);
    return { notFound: true };
  } finally {
    if (dbClient) {
      try {
        dbClient.release();
      } catch (releaseErr) {
        console.error('[WikiDetailSSR] 释放数据库连接失败:', releaseErr);
      }
    }
  }
};
