import React, { useState, useEffect } from 'react';
import { GetServerSideProps } from 'next';
import Head from 'next/head';
import Link from 'next/link';
import pool from '../../lib/db';
import { resolveSsrAuth } from '../../lib/ssr-auth';
import { STANDARD_CATEGORIES } from '../../lib/category-mapper';
import { isNodeInRegion } from '../../lib/region-country-mapper';
import WatermarkContainer from '../../components/WatermarkContainer';
import Navbar from '../../components/Navbar';
import AuthModal from '../../components/AuthModal';

interface NewsListItem {
  id: string;
  title: string;
  summary: string;
  published_at: string;
  source_url: string | null;
  industries: string;
  region: string;
  countries: string;
}

interface NewsPageProps {
  newsList: NewsListItem[];
  industries: Array<{ id: string; name: string }>;
  canonicalUrl?: string;
  siteUrl?: string;
  userId: string | null;
  userRole: string;
  quota: number;
  nickname: string;
}

export default function PublicNewsPage({ newsList, industries, canonicalUrl, siteUrl, userId, userRole, quota, nickname }: NewsPageProps) {
  const [selectedIndustries, setSelectedIndustries] = useState<string[]>([]);
  const [selectedRegion, setSelectedRegion] = useState('All');
  const [searchKeyword, setSearchKeyword] = useState('');
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [isClientLoaded, setIsClientLoaded] = useState(false);
  const [isIndustriesExpanded, setIsIndustriesExpanded] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const PAGE_SIZE = 18;

  // 1. 初始化读取 localStorage 缓存的用户订阅偏好
  useEffect(() => {
    try {
      const cached = localStorage.getItem('gtb_selected_industries');
      if (cached) {
        const parsed = JSON.parse(cached);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setSelectedIndustries(parsed);
        }
      }
    } catch (e) {
      console.warn('Failed to load industry preferences:', e);
    } finally {
      setIsClientLoaded(true);
    }
  }, []);

  // 2. 切换品类勾选状态并持久化到本地
  const toggleIndustry = (name: string) => {
    let updated: string[];
    if (selectedIndustries.includes(name)) {
      updated = selectedIndustries.filter(i => i !== name);
    } else {
      updated = [...selectedIndustries, name];
    }
    setSelectedIndustries(updated);
    setCurrentPage(1);
    try {
      localStorage.setItem('gtb_selected_industries', JSON.stringify(updated));
    } catch (e) {}
  };

  const selectAll = () => {
    setSelectedIndustries([]);
    setCurrentPage(1);
    try {
      localStorage.removeItem('gtb_selected_industries');
    } catch (e) {}
  };

  // 3. 多维度过滤计算 (多选品类 + 地区大区智能归纳 + 关键词)
  const filteredNews = newsList.filter(item => {
    // 多选品类过滤：若为空则不过滤；若有选中，满足任一品类即可匹配
    const matchInd = selectedIndustries.length === 0 || selectedIndustries.some(ind => 
      item.industries && item.industries.includes(ind)
    );
    // 市场大区智能归纳过滤（如选择“欧洲”，荷兰/德国/英国等欧洲国家自动纳入）
    const matchReg = selectedRegion === 'All' ||
      isNodeInRegion(item.countries, selectedRegion) ||
      isNodeInRegion(item.region, selectedRegion) ||
      (item.region && (item.region.includes(selectedRegion) || selectedRegion.includes(item.region))) ||
      (selectedRegion === '欧洲' && (item.title.includes('欧洲') || item.title.includes('欧盟') || (item.summary && (item.summary.includes('欧洲') || item.summary.includes('欧盟'))))) ||
      (selectedRegion === '北美' && (item.title.includes('北美') || item.title.includes('美国') || (item.summary && (item.summary.includes('北美') || item.summary.includes('美国')))));

    const matchKwd = !searchKeyword.trim() || 
      item.title.toLowerCase().includes(searchKeyword.toLowerCase()) || 
      (item.summary && item.summary.toLowerCase().includes(searchKeyword.toLowerCase())) ||
      (item.industries && item.industries.toLowerCase().includes(searchKeyword.toLowerCase())) ||
      (item.countries && item.countries.toLowerCase().includes(searchKeyword.toLowerCase()));
      
    return matchInd && matchReg && matchKwd;
  });

  const totalPages = Math.ceil(filteredNews.length / PAGE_SIZE) || 1;
  const paginatedNews = filteredNews.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  const handlePageChange = (page: number) => {
    if (page < 1 || page > totalPages) return;
    setCurrentPage(page);
    if (typeof window !== 'undefined') {
      const container = document.getElementById('news-feed-section');
      if (container) {
        container.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }
  };

  const regions = ['All', '欧洲', '北美', '亚洲', '东南亚', '中东', '南美', '非洲', '大洋洲'];
  const ogImageUrl = siteUrl ? `${siteUrl}/images/global_trade_trends.jpg` : '/images/global_trade_trends.jpg';

  return (
    <WatermarkContainer text={userId ? `外贸智友 - 用户: ${nickname || userId.substring(0, 8)}` : '外贸智友 - 游客浏览模式'}>
      <Head>
        {/* 基础 TDK (百度/搜狗/360) */}
        <title>每日外贸资讯与全球行业热点大厅 | 外贸智友</title>
        <meta name="description" content="实时追踪全球外贸热点、关税政策调整、海运费波动及海外零售动态，助中国制造企业敏锐捕捉出海商机与前沿趋势。" />
        <meta name="keywords" content="外贸资讯, 全球市场热点, 关税调整, 海运运价, 跨境电商, 出海调研, 外贸智友, GlobalTradeBuddy" />
        <meta name="author" content="外贸智友 GlobalTradeBuddy" />
        <meta name="robots" content="index, follow" />
        <meta name="applicable-device" content="pc,mobile" />
        {canonicalUrl && <link rel="canonical" href={canonicalUrl} />}

        {/* 百度出图缩略图 */}
        <meta name="thumbnail" content={ogImageUrl} />

        {/* 微信 / QQ 分享协议 */}
        <meta itemProp="name" content="每日外贸资讯与全球行业热点大厅 | 外贸智友" />
        <meta itemProp="description" content="实时追踪全球外贸热点、关税政策调整、海运费波动及海外零售动态，助中国制造企业敏锐捕捉出海商机与前沿趋势。" />
        <meta itemProp="image" content={ogImageUrl} />

        {/* 微信/微博/知乎/抖音通用 OpenGraph */}
        <meta property="og:type" content="website" />
        <meta property="og:title" content="每日外贸资讯与全球行业热点大厅 | 外贸智友" />
        <meta property="og:description" content="实时追踪全球外贸热点、关税政策调整、海运费波动及海外零售动态，助中国制造企业敏锐捕捉出海商机与前沿趋势。" />
        <meta property="og:image" content={ogImageUrl} />
        {canonicalUrl && <meta property="og:url" content={canonicalUrl} />}
        <meta property="og:site_name" content="外贸智友 GlobalTradeBuddy" />
      </Head>

      {/* 微信首图兜底 */}
      <div style={{ display: 'none', position: 'absolute', width: 0, height: 0, overflow: 'hidden' }}>
        <img src={ogImageUrl} alt="外贸智友" width="300" height="300" />
      </div>

      <Navbar 
        userId={userId} 
        userRole={userRole} 
        quota={quota} 
        nickname={nickname} 
        onShowAuthModal={() => setShowAuthModal(true)} 
      />

      <div style={{
        maxWidth: '1280px',
        margin: '100px auto 60px auto',
        padding: '0 24px',
        fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif"
      }}>

        {/* 页面主标题区 */}
        <div style={{ marginBottom: '32px' }}>
          <span style={{ color: 'var(--color-accent, #ff641e)', fontSize: '0.85rem', letterSpacing: '2px', textTransform: 'uppercase', fontWeight: 600 }}>
            Daily Global Trade & Retail Feed
          </span>
          <h1 className="font-editorial" style={{ fontSize: '2.6rem', margin: '8px 0 0 0', fontWeight: 400, color: 'var(--color-text)' }}>
            全球出海行业情报大厅
          </h1>
          <p style={{ color: 'var(--color-muted)', fontSize: '0.95rem', fontWeight: 300, marginTop: '8px' }}>
            54 个外贸相关行业实时资讯追踪，深度覆盖海外大买家采购动向、行业协会标准与关税合规变动。
          </p>
        </div>

        {/* 筛选与行业资讯订阅面板 */}
        <div id="news-feed-section" style={{
          background: 'rgba(255, 255, 255, 0.65)',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          border: '1px solid rgba(18, 18, 18, 0.06)',
          padding: '24px',
          borderRadius: 'var(--border-radius)',
          marginBottom: '36px',
          boxShadow: '0 10px 30px rgba(0,0,0,0.02)'
        }}>
          {/* 上层控制栏：关键词搜索 (左侧) + [市场区域下拉 + 快捷操作] (靠右组合) */}
          <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
            {/* 左侧：关键词搜索框 */}
            <div style={{ position: 'relative', flex: 1, minWidth: '260px', maxWidth: '440px' }}>
              <input
                type="text"
                placeholder="搜索买家、渠道、品类或关税关键词..."
                value={searchKeyword}
                onChange={(e) => { setSearchKeyword(e.target.value); setCurrentPage(1); }}
                style={{
                  width: '100%',
                  padding: '10px 16px',
                  fontSize: '0.85rem',
                  background: 'rgba(255, 255, 255, 0.9)',
                  border: '1px solid rgba(18, 18, 18, 0.1)',
                  borderRadius: '6px',
                  outline: 'none',
                  color: 'var(--color-text)'
                }}
              />
              {searchKeyword && (
                <button 
                  onClick={() => { setSearchKeyword(''); setCurrentPage(1); }}
                  style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#999' }}
                >
                  ✕
                </button>
              )}
            </div>

            {/* 右侧：市场区域筛选框 + 行业快捷操作按钮 */}
            <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
              {/* 市场区域下拉 (无地球 emoji) */}
              <select
                value={selectedRegion}
                onChange={(e) => { setSelectedRegion(e.target.value); setCurrentPage(1); }}
                style={{
                  background: 'rgba(255, 255, 255, 0.9)',
                  border: '1px solid rgba(18, 18, 18, 0.1)',
                  padding: '9px 14px',
                  borderRadius: '6px',
                  fontSize: '0.85rem',
                  color: 'var(--color-text)',
                  outline: 'none',
                  cursor: 'pointer'
                }}
              >
                <option value="All">全部市场区域</option>
                {regions.filter(r => r !== 'All').map(r => (
                  <option key={r} value={r}>{r}</option>
                ))}
              </select>

              <button
                onClick={selectAll}
                style={{
                  background: selectedIndustries.length === 0 ? 'var(--color-accent, #ff641e)' : 'rgba(255,255,255,0.8)',
                  color: selectedIndustries.length === 0 ? '#fff' : 'var(--color-text)',
                  border: '1px solid rgba(18, 18, 18, 0.1)',
                  padding: '8px 16px',
                  borderRadius: '6px',
                  fontSize: '0.8rem',
                  fontWeight: 500,
                  cursor: 'pointer',
                  transition: 'all 0.2s'
                }}
              >
                全部行业 (All)
              </button>

              {selectedIndustries.length > 0 && (
                <button
                  onClick={selectAll}
                  style={{
                    background: 'rgba(255, 59, 48, 0.08)',
                    color: '#ff3b30',
                    border: '1px solid rgba(255, 59, 48, 0.2)',
                    padding: '8px 14px',
                    borderRadius: '6px',
                    fontSize: '0.8rem',
                    fontWeight: 500,
                    cursor: 'pointer'
                  }}
                >
                  重置筛选 ({selectedIndustries.length})
                </button>
              )}
            </div>
          </div>

          {/* 下层：行业资讯订阅（支持自动折叠与展开） */}
          <div style={{
            borderTop: '1px solid rgba(18, 18, 18, 0.06)',
            paddingTop: '16px'
          }}>
            <div 
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                cursor: 'pointer',
                userSelect: 'none'
              }}
              onClick={() => setIsIndustriesExpanded(prev => !prev)}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                <span style={{ fontSize: '0.85rem', color: 'var(--color-text)', fontWeight: 600 }}>
                  行业资讯订阅
                </span>
                <span style={{ fontSize: '0.75rem', color: 'var(--color-muted)', fontWeight: 300 }}>
                  （可多选，自动记住偏好）
                </span>
                {selectedIndustries.length > 0 && (
                  <span style={{
                    fontSize: '0.72rem',
                    color: '#fff',
                    background: 'var(--color-accent, #ff641e)',
                    padding: '2px 8px',
                    borderRadius: '12px',
                    fontWeight: 500
                  }}>
                    已选 {selectedIndustries.length} 个行业
                  </span>
                )}
              </div>

              <button
                type="button"
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--color-accent, #ff641e)',
                  fontSize: '0.8rem',
                  fontWeight: 500,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px'
                }}
              >
                {isIndustriesExpanded ? '收起 ▴' : (selectedIndustries.length > 0 ? '展开修改 ▾' : '展开选择 54 个行业 ▾')}
              </button>
            </div>

            {/* 折叠状态下展示已选行业标签，未选时保持清爽 */}
            {!isIndustriesExpanded && selectedIndustries.length > 0 && (
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: '12px' }}>
                {selectedIndustries.map(name => (
                  <span
                    key={name}
                    onClick={(e) => { e.stopPropagation(); toggleIndustry(name); }}
                    style={{
                      background: 'var(--color-accent, #ff641e)',
                      color: '#fff',
                      border: '1px solid var(--color-accent, #ff641e)',
                      padding: '4px 10px',
                      borderRadius: '20px',
                      fontSize: '0.75rem',
                      fontWeight: 500,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px'
                    }}
                    title="点击取消勾选"
                  >
                    <span>✓</span>
                    {name}
                    <span style={{ fontSize: '0.7rem', opacity: 0.8, marginLeft: '2px' }}>✕</span>
                  </span>
                ))}
              </div>
            )}

            {/* 展开状态下展示全部 54 个标准行业多选池 */}
            {isIndustriesExpanded && (
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', maxHeight: '200px', overflowY: 'auto', padding: '12px 2px 4px 2px', marginTop: '8px' }}>
                {industries.map(ind => {
                  const isSelected = selectedIndustries.includes(ind.name);
                  return (
                    <button
                      key={ind.id}
                      onClick={() => toggleIndustry(ind.name)}
                      style={{
                        background: isSelected ? 'var(--color-accent, #ff641e)' : 'rgba(255, 255, 255, 0.8)',
                        color: isSelected ? '#fff' : 'var(--color-text)',
                        border: isSelected ? '1px solid var(--color-accent, #ff641e)' : '1px solid rgba(18, 18, 18, 0.08)',
                        padding: '6px 12px',
                        borderRadius: '20px',
                        fontSize: '0.78rem',
                        fontWeight: isSelected ? 500 : 400,
                        cursor: 'pointer',
                        transition: 'all 0.15s ease',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px'
                      }}
                    >
                      {isSelected && <span>✓</span>}
                      {ind.name}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* 资讯展示列表 */}
        {filteredNews.length === 0 ? (
          <div style={{
            padding: '80px 20px',
            textAlign: 'center',
            background: 'rgba(255, 255, 255, 0.4)',
            borderRadius: 'var(--border-radius)',
            border: '1px dashed rgba(18, 18, 18, 0.1)'
          }}>
            <p style={{ fontSize: '1.2rem', color: 'var(--color-text)', fontWeight: 500, margin: '0 0 8px 0' }}>
              未找到符合当前相关行业筛选条件的资讯
            </p>
            <p style={{ color: 'var(--color-muted)', fontSize: '0.9rem', margin: '0 0 20px 0' }}>
              尝试调整选中的相关行业标签或关键词搜索
            </p>
            <button
              onClick={selectAll}
              style={{
                background: 'var(--color-accent, #ff641e)',
                color: '#fff',
                border: 'none',
                padding: '10px 24px',
                borderRadius: '6px',
                fontSize: '0.85rem',
                cursor: 'pointer'
              }}
            >
              查看全部资讯
            </button>
          </div>
        ) : (
          <>
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))',
              gap: '28px',
              marginBottom: '40px'
            }}>
              {paginatedNews.map((art) => {
                const itemDate = new Date(art.published_at).toLocaleDateString('zh-CN', {
                  year: 'numeric',
                  month: 'short',
                  day: 'numeric'
                });
                const industriesArray = art.industries ? art.industries.split(', ') : [];

                return (
                  <article
                    key={art.id}
                    className="float-on-hover"
                    style={{
                      background: 'rgba(255, 255, 255, 0.65)',
                      backdropFilter: 'blur(15px)',
                      WebkitBackdropFilter: 'blur(15px)',
                      border: '1px solid rgba(18, 18, 18, 0.06)',
                      padding: '28px',
                      borderRadius: 'var(--border-radius)',
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'space-between',
                      boxShadow: '0 10px 30px rgba(0,0,0,0.02)',
                      transition: 'transform 0.25s cubic-bezier(0.16, 1, 0.3, 1), box-shadow 0.25s ease'
                    }}
                  >
                    <div>
                      {/* 涉及多行业与国家标签 (对齐报告大厅卡片样式) */}
                      <div style={{ display: 'flex', gap: '6px', marginBottom: '14px', flexWrap: 'wrap', alignItems: 'center' }}>
                        {industriesArray.slice(0, 3).map((ind, i) => (
                          <span key={i} style={{
                            fontSize: '0.72rem',
                            color: '#2e5bff',
                            background: 'rgba(46, 91, 255, 0.05)',
                            border: '1px solid rgba(46, 91, 255, 0.12)',
                            padding: '4px 8px',
                            borderRadius: 'var(--border-radius)',
                            fontWeight: 400
                          }}>
                            {ind}
                          </span>
                        ))}
                        {industriesArray.length > 3 && (
                          <span style={{
                            background: 'rgba(122, 117, 111, 0.08)',
                            color: 'var(--color-muted)',
                            padding: '3px 6px',
                            fontSize: '0.72rem',
                            borderRadius: 'var(--border-radius)'
                          }}>
                            +{industriesArray.length - 3}
                          </span>
                        )}
                        {art.countries && (
                          <span style={{
                            fontSize: '0.75rem',
                            color: 'var(--color-muted)',
                            fontWeight: 300,
                            display: 'flex',
                            alignItems: 'center',
                            gap: '4px',
                            background: 'rgba(18, 18, 18, 0.04)',
                            padding: '3px 8px',
                            borderRadius: 'var(--border-radius)',
                            marginLeft: 'auto'
                          }}>
                            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
                              <circle cx="12" cy="10" r="3" />
                            </svg>
                            {art.countries}
                          </span>
                        )}
                      </div>

                      {/* 资讯标题 */}
                      <h2 style={{
                        fontSize: '1.2rem',
                        fontWeight: 500,
                        margin: '0 0 12px 0',
                        lineHeight: 1.4,
                        color: 'var(--color-text)'
                      }}>
                        <Link href={`/news/${art.id}`} style={{ textDecoration: 'none', color: 'inherit' }}>
                          {art.title}
                        </Link>
                      </h2>

                      {/* 深度事实摘要 */}
                      <p style={{
                        fontSize: '0.88rem',
                        color: 'var(--color-muted)',
                        lineHeight: 1.6,
                        margin: '0 0 20px 0',
                        fontWeight: 300,
                        display: '-webkit-box',
                        WebkitLineClamp: 3,
                        WebkitBoxOrient: 'vertical',
                        overflow: 'hidden'
                      }}>
                        {art.summary}
                      </p>
                    </div>

                    {/* 底部时间与进入详情 */}
                    <div style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      fontSize: '0.8rem',
                      color: 'var(--color-muted)',
                      borderTop: '1px solid rgba(18,18,18,0.05)',
                      paddingTop: '14px',
                      marginTop: '10px'
                    }}>
                      <span>{itemDate}</span>
                      <Link href={`/news/${art.id}`} style={{
                        textDecoration: 'none',
                        color: 'var(--color-accent, #ff641e)',
                        fontWeight: 500,
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px'
                      }}>
                        阅读深度情报 →
                      </Link>
                    </div>
                  </article>
                );
              })}
            </div>

            {/* 资讯卡片分页控件（单页最多18篇） */}
            {totalPages > 1 && (
              <div style={{
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                gap: '8px',
                margin: '40px 0 80px 0',
                flexWrap: 'wrap'
              }}>
                <button
                  onClick={() => handlePageChange(currentPage - 1)}
                  disabled={currentPage === 1}
                  style={{
                    padding: '8px 16px',
                    fontSize: '0.85rem',
                    background: currentPage === 1 ? 'rgba(0,0,0,0.03)' : 'rgba(255, 255, 255, 0.8)',
                    color: currentPage === 1 ? 'var(--color-muted)' : 'var(--color-text)',
                    border: '1px solid rgba(18, 18, 18, 0.1)',
                    borderRadius: '6px',
                    cursor: currentPage === 1 ? 'not-allowed' : 'pointer',
                    transition: 'all 0.2s'
                  }}
                >
                  上一页
                </button>

                {Array.from({ length: totalPages }, (_, i) => i + 1).map((pageNum) => (
                  <button
                    key={pageNum}
                    onClick={() => handlePageChange(pageNum)}
                    style={{
                      width: '36px',
                      height: '36px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '0.85rem',
                      background: currentPage === pageNum ? 'var(--color-accent, #ff641e)' : 'rgba(255, 255, 255, 0.8)',
                      color: currentPage === pageNum ? '#fff' : 'var(--color-text)',
                      border: currentPage === pageNum ? '1px solid var(--color-accent, #ff641e)' : '1px solid rgba(18, 18, 18, 0.1)',
                      borderRadius: '6px',
                      cursor: 'pointer',
                      fontWeight: currentPage === pageNum ? 600 : 400,
                      transition: 'all 0.2s'
                    }}
                  >
                    {pageNum}
                  </button>
                ))}

                <button
                  onClick={() => handlePageChange(currentPage + 1)}
                  disabled={currentPage === totalPages}
                  style={{
                    padding: '8px 16px',
                    fontSize: '0.85rem',
                    background: currentPage === totalPages ? 'rgba(0,0,0,0.03)' : 'rgba(255, 255, 255, 0.8)',
                    color: currentPage === totalPages ? 'var(--color-muted)' : 'var(--color-text)',
                    border: '1px solid rgba(18, 18, 18, 0.1)',
                    borderRadius: '6px',
                    cursor: currentPage === totalPages ? 'not-allowed' : 'pointer',
                    transition: 'all 0.2s'
                  }}
                >
                  下一页
                </button>

                <span style={{ fontSize: '0.8rem', color: 'var(--color-muted)', marginLeft: '12px' }}>
                  共 {filteredNews.length} 篇资讯（第 {currentPage} / {totalPages} 页）
                </span>
              </div>
            )}
          </>
        )}

        <AuthModal 
          isOpen={showAuthModal} 
          onClose={() => setShowAuthModal(false)} 
        />
      </div>
    </WatermarkContainer>
  );
}

export const getServerSideProps: GetServerSideProps = async (context) => {
  let dbClient: any = null;

  try {
    dbClient = await pool.connect();
    const auth = await resolveSsrAuth(context, dbClient);
    const userId = auth.userId;
    const userRole = auth.userRole;
    const quota = auth.freeQuota;
    const nickname = auth.nickname;

    // 1. 获取所有公开快讯 (使用 ARRAY_TO_STRING 聚合多品类与多国家标签)
    const newsRes = await dbClient.query(
      `SELECT n.id, n.title, n.summary, n.published_at, n.source_url,
              ARRAY_TO_STRING(ARRAY(
                SELECT name FROM industries 
                JOIN news_industries ON industries.id = news_industries.industry_id 
                WHERE news_id = n.id
              ), ', ') as industries,
              (SELECT region FROM countries JOIN news_countries ON countries.id = news_countries.country_id WHERE news_id = n.id LIMIT 1) as region,
              ARRAY_TO_STRING(ARRAY(
                SELECT name FROM countries 
                JOIN news_countries ON countries.id = news_countries.country_id 
                WHERE news_id = n.id
              ), ', ') as countries
       FROM news n
       WHERE n.status = 'published'
       ORDER BY n.published_at DESC`
    );

    const newsList = newsRes.rows.map((row: any) => ({
      ...row,
      published_at: row.published_at ? row.published_at.toISOString() : null
    }));

    // 2. 获取所有行业列表供筛选使用，严格按照 GTB 54 项标准品类顺序展示
    const industriesRes = await dbClient.query(
      'SELECT id, name FROM industries WHERE name = ANY($1)',
      [STANDARD_CATEGORIES]
    );
    const indMap = new Map(industriesRes.rows.map((r: any) => [r.name, r]));
    const orderedIndustries = STANDARD_CATEGORIES.map(name => indMap.get(name) || { id: name, name });

    const proto = (context.req.headers['x-forwarded-proto'] as string) || 'https';
    const host = (context.req.headers['x-forwarded-host'] as string) || context.req.headers.host || 'marketgraphic.com';
    const siteUrl = `${proto}://${host}`;
    const canonicalUrl = `${siteUrl}/news`;

    return {
      props: {
        newsList,
        industries: orderedIndustries,
        canonicalUrl,
        siteUrl,
        userId,
        userRole,
        quota,
        nickname
      }
    };
  } catch (err) {
    console.error('Error fetching public news list page SSR:', err);
    return {
      props: {
        newsList: [],
        industries: [],
        userId: null,
        userRole: 'guest',
        quota: 0,
        nickname: ''
      }
    };
  } finally {
    if (dbClient) dbClient.release();
  }
};
