import React, { useEffect, useMemo, useRef, useState } from 'react';
import type { GetServerSideProps } from 'next';
import Head from 'next/head';
import Link from 'next/link';
import pool from '../../lib/db';
import { resolveSsrAuth } from '../../lib/ssr-auth';
import { STANDARD_CATEGORIES } from '../../lib/category-mapper';
import { isNodeInRegion } from '../../lib/region-country-mapper';
import {
  ARCHETYPE_META,
  calcPriceMultiplier,
  type ArchetypeId,
  type MarketFlowData,
} from '../../lib/wiki-schema';
import WatermarkContainer from '../../components/WatermarkContainer';
import Navbar from '../../components/Navbar';
import Footer from '../../components/Footer';
import AuthModal from '../../components/AuthModal';
import FeedbackModal from '../../components/FeedbackModal';
import JsonLdScript from '../../components/wiki/JsonLdScript';
import WikiEntryCard, { type WikiListItem } from '../../components/wiki/WikiEntryCard';

const SITE_URL = 'https://marketgraphic.cn';
const CANONICAL_URL = `${SITE_URL}/wiki`;
const REGIONS = ['All', '欧洲', '北美', '亚洲', '南美', '大洋洲', '非洲'] as const;
const INITIAL_COUNT = 20;
const STEP_COUNT = 12;

export interface WikiIndexProps {
  items: WikiListItem[];
  userId: string | null;
  userRole: string;
  quota: number;
  downloadQuota: number;
  memberType: string;
  nickname: string;
  userEmail: string;
}

function toIsoStringSafe(value: unknown): string {
  if (!value) return new Date(0).toISOString();
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? new Date(0).toISOString() : value.toISOString();
  const parsed = new Date(String(value));
  return Number.isNaN(parsed.getTime()) ? String(value) : parsed.toISOString();
}

function parseFlowDataSafe(raw: unknown): MarketFlowData | null {
  if (!raw) return null;
  if (typeof raw === 'string') {
    try {
      return JSON.parse(raw) as MarketFlowData;
    } catch {
      return null;
    }
  }
  if (typeof raw === 'object') {
    return raw as MarketFlowData;
  }
  return null;
}

/**
 * 行业百科公开大厅页：全量 SSR 渲染、免登录公开访问，支持多维筛选与触底无限加载
 */
export default function WikiIndexPage({
  items,
  userId,
  userRole,
  quota,
  downloadQuota,
  memberType,
  nickname,
  userEmail,
}: WikiIndexProps) {
  const [searchKeyword, setSearchKeyword] = useState('');
  const [selectedRegion, setSelectedRegion] = useState<string>('All');
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [selectedArchetype, setSelectedArchetype] = useState<'All' | ArchetypeId>('All');
  const [visibleCount, setVisibleCount] = useState(INITIAL_COUNT);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [showCustomModal, setShowCustomModal] = useState(false);
  const sentinelRef = useRef<HTMLDivElement | null>(null);

  const safeItems = Array.isArray(items) ? items : [];

  const filteredItems = useMemo(() => {
    const q = searchKeyword.trim().toLowerCase();
    return safeItems.filter((item) => {
      if (q) {
        const hitKeyword =
          item.title.toLowerCase().includes(q) ||
          item.summary.toLowerCase().includes(q) ||
          item.country_name.toLowerCase().includes(q) ||
          item.industry_name.toLowerCase().includes(q) ||
          (item.hs_code_6 ? item.hs_code_6.toLowerCase().includes(q) : false);
        if (!hitKeyword) return false;
      }

      if (selectedRegion !== 'All') {
        const matchReg =
          isNodeInRegion(item.market_region, selectedRegion) ||
          isNodeInRegion(item.country_name, selectedRegion);
        if (!matchReg) return false;
      }

      if (selectedCategory !== 'All' && item.industry_name !== selectedCategory) {
        return false;
      }

      if (selectedArchetype !== 'All' && item.archetype_id !== selectedArchetype) {
        return false;
      }

      return true;
    });
  }, [safeItems, searchKeyword, selectedRegion, selectedCategory, selectedArchetype]);

  useEffect(() => {
    setVisibleCount(INITIAL_COUNT);
  }, [searchKeyword, selectedRegion, selectedCategory, selectedArchetype]);

  useEffect(() => {
    if (visibleCount >= filteredItems.length) return;
    if (typeof IntersectionObserver === 'undefined') return;
    const target = sentinelRef.current;
    if (!target) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          setVisibleCount((prev) => Math.min(prev + STEP_COUNT, filteredItems.length));
        }
      },
      { rootMargin: '280px 0px' }
    );

    observer.observe(target);
    return () => observer.disconnect();
  }, [visibleCount, filteredItems.length]);

  const displayedItems = filteredItems.slice(0, visibleCount);
  const archetypeKeys = Object.keys(ARCHETYPE_META) as ArchetypeId[];
  const ogImageUrl = `${SITE_URL}/images/global_trade_trends.jpg`;

  const collectionJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: '行业百科 — 全球海外市场流通图谱与价格瀑布数据库 | Market Graphic',
    description:
      '公开免登录查阅中国制造出海 54 大品类的目标国供给格局、FOB 到终端零售价格瀑布、分层渠道玩家图谱与合规门槛。',
    url: CANONICAL_URL,
    inLanguage: 'zh-CN',
    mainEntity: {
      '@type': 'ItemList',
      numberOfItems: safeItems.length,
      itemListElement: safeItems.slice(0, 50).map((item, idx) => ({
        '@type': 'ListItem',
        position: idx + 1,
        name: item.title,
        url: `${SITE_URL}/wiki/${item.slug}`,
      })),
    },
  };

  const breadcrumbJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      {
        '@type': 'ListItem',
        position: 1,
        name: '首页',
        item: SITE_URL,
      },
      {
        '@type': 'ListItem',
        position: 2,
        name: '行业百科',
        item: CANONICAL_URL,
      },
    ],
  };

  const resetFilters = () => {
    setSearchKeyword('');
    setSelectedRegion('All');
    setSelectedCategory('All');
    setSelectedArchetype('All');
  };

  const hasActiveFilter =
    Boolean(searchKeyword.trim()) ||
    selectedRegion !== 'All' ||
    selectedCategory !== 'All' ||
    selectedArchetype !== 'All';

  return (
    <WatermarkContainer text={userId ? `外贸智友 - 用户: ${nickname || userId.slice(0, 8)}` : '外贸智友 - 公开行业百科'}>
      <Head>
        <title>行业百科 — 全球海外市场流通图谱与价格瀑布 | Market Graphic (外贸智友)</title>
        <meta
          name="description"
          content="完全公开的全球外贸行业百科数据库：拆解各国各品类的本土制造与进口依赖度、FOB 到终端零售价格瀑布倍率、核心分销渠道层级与真实买家代表。"
        />
        <meta
          name="keywords"
          content="外贸行业百科, 海外市场渠道图谱, 价格瀑布, 出口合规, FOB倍率, Market Graphic, 外贸智友"
        />
        <meta name="robots" content="index, follow" />
        <link rel="canonical" href={CANONICAL_URL} />
        <meta property="og:type" content="website" />
        <meta property="og:title" content="行业百科 — 全球海外市场流通图谱与价格瀑布 | Market Graphic" />
        <meta
          property="og:description"
          content="完全公开的全球外贸行业百科数据库：覆盖供给格局、价格瀑布、渠道玩家与认证合规实战指南。"
        />
        <meta property="og:url" content={CANONICAL_URL} />
        <meta property="og:site_name" content="Market Graphic (外贸智友)" />
        <meta property="og:image" content={ogImageUrl} />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content="行业百科 — 全球海外市场流通图谱 | Market Graphic" />
        <meta
          name="twitter:description"
          content="公开查阅目标国市场渠道结构、价差倍率与代表采购买家。"
        />
        <meta name="twitter:image" content={ogImageUrl} />
      </Head>

      <JsonLdScript data={collectionJsonLd} />
      <JsonLdScript data={breadcrumbJsonLd} />

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

      <main className="responsive-page-container">
        {/* 面包屑 */}
        <nav aria-label="面包屑导航" style={{ marginBottom: '20px', fontSize: '13px', color: 'var(--color-muted, #666666)' }}>
          <Link href="/" style={{ color: 'var(--color-muted, #666666)', textDecoration: 'none' }}>
            首页
          </Link>
          <span style={{ margin: '0 8px', opacity: 0.5 }}>/</span>
          <span style={{ color: 'var(--color-text, #121212)', fontWeight: 600 }}>行业百科</span>
        </nav>

        {/* 页头介绍与行动区 */}
        <header
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'flex-end',
            justifyContent: 'space-between',
            gap: '20px',
            marginBottom: '32px',
          }}
        >
          <div style={{ maxWidth: '780px' }}>
            <span
              style={{
                color: 'var(--color-accent, #ff641e)',
                fontSize: '0.82rem',
                letterSpacing: '2px',
                textTransform: 'uppercase',
                fontWeight: 700,
              }}
            >
              Industry Distribution & Price Waterfall Wiki
            </span>
            <h1
              className="font-editorial"
              style={{
                fontSize: '2.5rem',
                margin: '8px 0 10px',
                fontWeight: 600,
                color: 'var(--color-text, #121212)',
                lineHeight: 1.2,
              }}
            >
              全球行业流通百科大厅
            </h1>
            <p
              style={{
                margin: 0,
                fontSize: '1rem',
                lineHeight: 1.65,
                color: 'var(--color-muted, #666666)',
              }}
            >
              免登录公开查阅「国家 × 品类」全链路流通图谱：直击本土与进口供给格局、FOB 至终端零售价格瀑布、4 级分销代表买家与准入合规门槛。
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
              浏览深度报告大厅
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
              定制专项市场图谱
            </button>
          </div>
        </header>

        {/* 多维筛选面板 */}
        <section
          aria-label="百科筛选栏"
          style={{
            background: 'rgba(255, 255, 255, 0.86)',
            border: '1px solid rgba(18, 18, 18, 0.08)',
            borderRadius: '14px',
            padding: '18px 20px',
            marginBottom: '28px',
            boxShadow: '0 6px 20px rgba(18, 18, 18, 0.03)',
            display: 'flex',
            flexDirection: 'column',
            gap: '14px',
          }}
        >
          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: '12px',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <div style={{ position: 'relative', flex: '1 1 280px', maxWidth: '460px' }}>
              <input
                type="text"
                aria-label="搜索行业百科"
                placeholder="搜索国家、品类、标题、摘要或 6 位 HS 编码..."
                value={searchKeyword}
                onChange={(e) => setSearchKeyword(e.target.value)}
                style={{
                  width: '100%',
                  padding: '10px 36px 10px 14px',
                  borderRadius: '10px',
                  border: '1px solid rgba(18, 18, 18, 0.12)',
                  background: '#ffffff',
                  fontSize: '13.5px',
                  color: 'var(--color-text, #121212)',
                  outline: 'none',
                  boxSizing: 'border-box',
                }}
              />
              {searchKeyword && (
                <button
                  type="button"
                  aria-label="清空搜索词"
                  onClick={() => setSearchKeyword('')}
                  style={{
                    position: 'absolute',
                    right: '10px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    background: 'transparent',
                    border: 'none',
                    cursor: 'pointer',
                    color: '#94a3b8',
                    fontSize: '14px',
                  }}
                >
                  ✕
                </button>
              )}
            </div>

            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', alignItems: 'center' }}>
              <select
                aria-label="按市场大区筛选"
                value={selectedRegion}
                onChange={(e) => setSelectedRegion(e.target.value)}
                style={{
                  padding: '9px 12px',
                  borderRadius: '10px',
                  border: '1px solid rgba(18, 18, 18, 0.12)',
                  background: '#ffffff',
                  fontSize: '13.5px',
                  color: 'var(--color-text, #121212)',
                  cursor: 'pointer',
                }}
              >
                <option value="All">全部市场大区</option>
                {REGIONS.filter((r) => r !== 'All').map((region) => (
                  <option key={region} value={region}>
                    {region}
                  </option>
                ))}
              </select>

              <select
                aria-label="按 54 标准品类筛选"
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                style={{
                  padding: '9px 12px',
                  borderRadius: '10px',
                  border: '1px solid rgba(18, 18, 18, 0.12)',
                  background: '#ffffff',
                  fontSize: '13.5px',
                  color: 'var(--color-text, #121212)',
                  cursor: 'pointer',
                  maxWidth: '240px',
                }}
              >
                <option value="All">全部 54 个标准品类</option>
                {STANDARD_CATEGORIES.map((category) => (
                  <option key={category} value={category}>
                    {category}
                  </option>
                ))}
              </select>

              {hasActiveFilter && (
                <button
                  type="button"
                  onClick={resetFilters}
                  style={{
                    padding: '9px 12px',
                    borderRadius: '10px',
                    border: '1px solid rgba(255, 100, 30, 0.25)',
                    background: 'rgba(255, 100, 30, 0.08)',
                    color: 'var(--color-accent, #ff641e)',
                    fontSize: '13px',
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  重置筛选
                </button>
              )}
            </div>
          </div>

          {/* 5 大流通原型快捷按钮 */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', alignItems: 'center' }}>
            <span style={{ fontSize: '12.5px', fontWeight: 600, color: 'var(--color-muted, #666666)', marginRight: '4px' }}>
              流通原型：
            </span>
            <button
              type="button"
              onClick={() => setSelectedArchetype('All')}
              style={{
                padding: '6px 12px',
                borderRadius: '999px',
                fontSize: '12.5px',
                fontWeight: selectedArchetype === 'All' ? 700 : 500,
                border:
                  selectedArchetype === 'All'
                    ? '1px solid var(--color-accent, #ff641e)'
                    : '1px solid rgba(18, 18, 18, 0.12)',
                background: selectedArchetype === 'All' ? 'var(--color-accent, #ff641e)' : '#ffffff',
                color: selectedArchetype === 'All' ? '#ffffff' : 'var(--color-text, #121212)',
                cursor: 'pointer',
              }}
            >
              全部原型（{safeItems.length}）
            </button>
            {archetypeKeys.map((key) => {
              const meta = Object.prototype.hasOwnProperty.call(ARCHETYPE_META, key)
                ? ARCHETYPE_META[key]
                : null;
              if (!meta) return null;
              const isSelected = selectedArchetype === key;
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => setSelectedArchetype(key)}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '6px 12px',
                    borderRadius: '999px',
                    fontSize: '12.5px',
                    fontWeight: isSelected ? 700 : 500,
                    border: isSelected ? `1px solid ${meta.accent}` : '1px solid rgba(18, 18, 18, 0.12)',
                    background: isSelected ? meta.accent : '#ffffff',
                    color: isSelected ? '#ffffff' : 'var(--color-text, #121212)',
                    cursor: 'pointer',
                  }}
                >
                  <span
                    aria-hidden="true"
                    style={{
                      width: '6px',
                      height: '6px',
                      borderRadius: '50%',
                      background: isSelected ? '#ffffff' : meta.accent,
                    }}
                  />
                  {meta.shortTag}
                </button>
              );
            })}
          </div>
        </section>

        {/* 结果计数 */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '16px',
            fontSize: '13px',
            color: 'var(--color-muted, #666666)',
          }}
        >
          <span>
            共匹配 <strong style={{ color: 'var(--color-text, #121212)' }}>{filteredItems.length}</strong> 篇已发布行业百科
          </span>
          <span>免登录免费开放阅读</span>
        </div>

        {/* 百科卡片列表 */}
        {filteredItems.length === 0 ? (
          <div
            style={{
              padding: '64px 20px',
              textAlign: 'center',
              background: '#ffffff',
              borderRadius: '14px',
              border: '1px dashed rgba(18, 18, 18, 0.15)',
            }}
          >
            <p style={{ margin: '0 0 8px', fontSize: '1.05rem', fontWeight: 600, color: 'var(--color-text, #121212)' }}>
              暂未匹配到符合当前筛选条件的行业百科词条
            </p>
            <p style={{ margin: '0 0 18px', fontSize: '13.5px', color: 'var(--color-muted, #666666)' }}>
              可清空关键词或切换大区、品类与流通原型后重新检索，或直接定制专属市场图谱。
            </p>
            <button
              type="button"
              onClick={resetFilters}
              style={{
                padding: '9px 20px',
                borderRadius: '10px',
                border: 'none',
                background: 'var(--color-accent, #ff641e)',
                color: '#ffffff',
                fontSize: '13.5px',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              显示全部词条
            </button>
          </div>
        ) : (
          <>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(310px, 1fr))',
                gap: '20px',
              }}
            >
              {displayedItems.map((item) => (
                <WikiEntryCard key={item.id} item={item} />
              ))}
            </div>

            {visibleCount < filteredItems.length && (
              <div
                ref={sentinelRef}
                style={{
                  textAlign: 'center',
                  padding: '28px 0 12px',
                }}
              >
                <button
                  type="button"
                  onClick={() => setVisibleCount((prev) => Math.min(prev + STEP_COUNT, filteredItems.length))}
                  style={{
                    padding: '9px 22px',
                    borderRadius: '999px',
                    border: '1px solid rgba(18, 18, 18, 0.12)',
                    background: '#ffffff',
                    color: 'var(--color-text, #121212)',
                    fontSize: '13px',
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  加载更多（剩余 {filteredItems.length - visibleCount} 篇）
                </button>
              </div>
            )}

            {visibleCount >= filteredItems.length && (
              <div
                style={{
                  textAlign: 'center',
                  padding: '28px 0 12px',
                  fontSize: '13px',
                  color: 'var(--color-muted, #666666)',
                }}
              >
                已展示全部 {filteredItems.length} 篇行业百科词条
              </div>
            )}
          </>
        )}
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

export const getServerSideProps: GetServerSideProps<WikiIndexProps> = async (context) => {
  let dbClient: any = null;

  try {
    dbClient = await pool.connect();
    const auth = await resolveSsrAuth(context, dbClient);

    const res = await dbClient.query(
      `SELECT id, slug, title, summary, country_code, country_name, market_region,
              industry_name, hs_code_6, archetype_id, flow_data, view_count,
              published_at, updated_at
       FROM wiki_entries
       WHERE status = 'published'
       ORDER BY published_at DESC NULLS LAST, updated_at DESC`
    );

    const items: WikiListItem[] = (res.rows || []).map((row: Record<string, unknown>) => {
      const flowData = parseFlowDataSafe(row.flow_data);
      const nodes = Array.isArray(flowData?.flow_nodes) ? flowData.flow_nodes : [];
      const playerCount = nodes.reduce(
        (sum, node) => sum + (Array.isArray(node?.players) ? node.players.length : 0),
        0
      );

      return {
        id: String(row.id || ''),
        slug: String(row.slug || ''),
        title: String(row.title || ''),
        summary: String(row.summary || ''),
        country_code: String(row.country_code || ''),
        country_name: String(row.country_name || ''),
        market_region: String(row.market_region || ''),
        industry_name: String(row.industry_name || ''),
        hs_code_6: row.hs_code_6 ? String(row.hs_code_6) : null,
        archetype_id: String(row.archetype_id || 'mass_retail') as ArchetypeId,
        price_multiplier: flowData ? calcPriceMultiplier(flowData) : '-',
        player_count: playerCount,
        view_count: Number(row.view_count || 0),
        updated_at: toIsoStringSafe(row.updated_at || row.published_at),
      };
    });

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
        items,
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
    console.error('[WikiIndexSSR] 查询行业百科大厅失败:', err);
    context.res.setHeader('Cache-Control', 'private, no-store');
    context.res.setHeader('Vary', 'Cookie');
    return {
      props: {
        items: [],
        userId: null,
        userRole: 'guest',
        quota: 0,
        downloadQuota: 0,
        memberType: 'free',
        nickname: '',
        userEmail: '',
      },
    };
  } finally {
    if (dbClient) {
      try {
        dbClient.release();
      } catch (releaseErr) {
        console.error('[WikiIndexSSR] 释放数据库连接失败:', releaseErr);
      }
    }
  }
};
