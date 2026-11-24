import React, { useCallback, useEffect, useState } from 'react';
import AdminLayout from '../../components/admin/AdminLayout';
import SafeMarkdown from '../../components/wiki/SafeMarkdown';
import {
  ARCHETYPE_META,
  ArchetypeId,
  WikiFaqItem,
  WikiSourceItem,
  isSafeWikiUrl,
} from '../../lib/wiki-schema';

type StatusFilter = 'all' | 'published' | 'draft';
type EntryStatus = 'published' | 'draft';
type ViewMode = 'list' | 'editor';
type MarkdownEditorMode = 'source' | 'preview';

interface WikiListRow {
  id: string;
  slug: string;
  title: string;
  summary: string;
  country_code: string;
  country_name: string;
  market_region: string;
  category_id?: number | null;
  industry_name: string;
  hs_code_6?: string | null;
  archetype_id: string;
  video_url?: string | null;
  cover_image?: string | null;
  status: EntryStatus;
  view_count: number;
  baidu_pushed_at?: string | null;
  published_at?: string | null;
  created_at: string;
  updated_at: string;
}

interface WikiDetailRow extends WikiListRow {
  content_md: string;
  faq_items?: WikiFaqItem[] | null;
  sources?: WikiSourceItem[] | null;
}

const SAFE_SLUG_REGEX = /^[a-z0-9-]+$/i;
const PAGE_SIZE = 20;

function getArchetypeShortTag(archetypeId: string): string {
  if (Object.prototype.hasOwnProperty.call(ARCHETYPE_META, archetypeId)) {
    return ARCHETYPE_META[archetypeId as ArchetypeId].shortTag;
  }
  return archetypeId || '-';
}

function formatDateTime(value?: string | null): string {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return `${date.toLocaleDateString('zh-CN')} ${date.toLocaleTimeString('zh-CN', {
    hour: '2-digit',
    minute: '2-digit',
  })}`;
}

function formatApiError(statusCode: number, serverMessage?: string): string {
  if (statusCode === 401) {
    return serverMessage
      ? `${serverMessage}（HTTP 401，请先登录管理员账号）`
      : '未登录或会话已过期（HTTP 401），请先登录管理员账号。';
  }
  if (statusCode === 403) {
    return serverMessage
      ? `${serverMessage}（HTTP 403，请确认当前账号拥有管理员权限）`
      : '无管理员权限（HTTP 403），仅管理员可访问行业百科后台。';
  }
  return serverMessage || `请求失败（HTTP ${statusCode}）`;
}

function validateFaqItemsJson(rawText: string): { items?: WikiFaqItem[]; error?: string } {
  let parsed: unknown;
  try {
    parsed = JSON.parse(rawText);
  } catch {
    return { error: 'FAQ 配置必须为合法 JSON 数组' };
  }

  if (!Array.isArray(parsed)) {
    return { error: 'FAQ 配置必须为 JSON 数组（[...]）' };
  }

  for (let i = 0; i < parsed.length; i++) {
    const item = parsed[i];
    if (!item || typeof item !== 'object' || Array.isArray(item)) {
      return { error: `faq_items[${i}] 必须为对象` };
    }
    const record = item as Record<string, unknown>;
    if (typeof record.q !== 'string' || !record.q.trim()) {
      return { error: `faq_items[${i}].q 必须为非空字符串` };
    }
    if (typeof record.a !== 'string' || !record.a.trim()) {
      return { error: `faq_items[${i}].a 必须为非空字符串` };
    }
  }

  return { items: parsed as WikiFaqItem[] };
}

function validateSourcesJson(rawText: string): { items?: WikiSourceItem[]; error?: string } {
  let parsed: unknown;
  try {
    parsed = JSON.parse(rawText);
  } catch {
    return { error: '权威信源配置必须为合法 JSON 数组' };
  }

  if (!Array.isArray(parsed)) {
    return { error: '权威信源配置必须为 JSON 数组（[...]）' };
  }

  for (let i = 0; i < parsed.length; i++) {
    const item = parsed[i];
    if (!item || typeof item !== 'object' || Array.isArray(item)) {
      return { error: `sources[${i}] 必须为对象` };
    }
    const record = item as Record<string, unknown>;
    if (record.url !== undefined && record.url !== null && record.url !== '') {
      if (typeof record.url !== 'string' || !isSafeWikiUrl(record.url)) {
        return { error: `sources[${i}].url 必须为合法的 http(s):// 或站内 / 路径` };
      }
    }
  }

  return { items: parsed as WikiSourceItem[] };
}

export default function AdminWikiManagement() {
  const [view, setView] = useState<ViewMode>('list');
  const [rows, setRows] = useState<WikiListRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorBanner, setErrorBanner] = useState<string | null>(null);
  const [noticeBanner, setNoticeBanner] = useState<string | null>(null);

  // 搜索、筛选与分页状态
  const [searchInput, setSearchInput] = useState('');
  const [activeQuery, setActiveQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);

  // 列表行级操作状态
  const [loadingDetailId, setLoadingDetailId] = useState<string | null>(null);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // 编辑器表单状态
  const [editId, setEditId] = useState<string | null>(null);
  const [editSlug, setEditSlug] = useState('');
  const [title, setTitle] = useState('');
  const [summary, setSummary] = useState('');
  const [videoUrl, setVideoUrl] = useState('');
  const [coverImage, setCoverImage] = useState('');
  const [status, setStatus] = useState<EntryStatus>('draft');
  const [contentMd, setContentMd] = useState('');
  const [mdMode, setMdMode] = useState<MarkdownEditorMode>('source');
  const [faqText, setFaqText] = useState('[]');
  const [sourcesText, setSourcesText] = useState('[]');
  const [editorError, setEditorError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const fetchList = useCallback(
    async (targetPage: number, queryText: string, targetStatus: StatusFilter) => {
      setLoading(true);
      setErrorBanner(null);
      try {
        const params = new URLSearchParams();
        params.set('page', String(targetPage));
        params.set('pageSize', String(PAGE_SIZE));
        params.set('status', targetStatus);
        if (queryText.trim()) {
          params.set('q', queryText.trim());
        }

        const res = await fetch(`/api/admin/wiki?${params.toString()}`);
        const json = await res.json().catch(() => ({}));
        if (!res.ok) {
          setRows([]);
          setTotal(0);
          setErrorBanner(formatApiError(res.status, typeof json.error === 'string' ? json.error : undefined));
          return;
        }

        const list = Array.isArray(json.data) ? (json.data as WikiListRow[]) : [];
        setRows(list);
        setTotal(typeof json.total === 'number' ? json.total : list.length);
        setPage(typeof json.page === 'number' ? json.page : targetPage);
      } catch (err) {
        console.error('Failed to fetch wiki entries:', err);
        setRows([]);
        setErrorBanner('网络异常，无法加载行业百科列表，请稍后重试。');
      } finally {
        setLoading(false);
      }
    },
    []
  );

  useEffect(() => {
    fetchList(page, activeQuery, statusFilter);
  }, [fetchList, page, activeQuery, statusFilter]);

  const handleSearchSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setNoticeBanner(null);
    setPage(1);
    setActiveQuery(searchInput.trim());
  };

  const handleResetFilters = () => {
    setNoticeBanner(null);
    setSearchInput('');
    setActiveQuery('');
    setStatusFilter('all');
    setPage(1);
  };

  const handleStatusFilterChange = (nextStatus: StatusFilter) => {
    setNoticeBanner(null);
    setStatusFilter(nextStatus);
    setPage(1);
  };

  const handleOpenEditor = async (id: string) => {
    setLoadingDetailId(id);
    setErrorBanner(null);
    setNoticeBanner(null);
    setEditorError(null);
    try {
      const res = await fetch(`/api/admin/wiki?id=${encodeURIComponent(id)}`);
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setErrorBanner(formatApiError(res.status, typeof json.error === 'string' ? json.error : undefined));
        return;
      }

      const detail = json.data as WikiDetailRow | undefined;
      if (!detail || !detail.id) {
        setErrorBanner('接口未返回有效的词条详情');
        return;
      }

      setEditId(detail.id);
      setEditSlug(detail.slug || '');
      setTitle(detail.title || '');
      setSummary(detail.summary || '');
      setVideoUrl(detail.video_url || '');
      setCoverImage(detail.cover_image || '');
      setStatus(detail.status === 'published' ? 'published' : 'draft');
      setContentMd(detail.content_md || '');
      setMdMode('source');
      setFaqText(JSON.stringify(Array.isArray(detail.faq_items) ? detail.faq_items : [], null, 2));
      setSourcesText(JSON.stringify(Array.isArray(detail.sources) ? detail.sources : [], null, 2));
      setView('editor');
    } catch (err) {
      console.error('Failed to load wiki entry detail:', err);
      setErrorBanner('网络异常，读取词条详情失败。');
    } finally {
      setLoadingDetailId(null);
    }
  };

  const handleToggleStatus = async (row: WikiListRow) => {
    const nextStatus: EntryStatus = row.status === 'published' ? 'draft' : 'published';
    setTogglingId(row.id);
    setErrorBanner(null);
    setNoticeBanner(null);
    try {
      const res = await fetch('/api/admin/wiki', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: row.id, status: nextStatus }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setErrorBanner(formatApiError(res.status, typeof json.error === 'string' ? json.error : undefined));
        return;
      }
      setNoticeBanner(
        nextStatus === 'published'
          ? `已发布词条「${row.title}」`
          : `已将词条「${row.title}」下架为草稿`
      );
      await fetchList(page, activeQuery, statusFilter);
    } catch (err) {
      console.error('Failed to toggle wiki status:', err);
      setErrorBanner('网络异常，状态切换失败。');
    } finally {
      setTogglingId(null);
    }
  };

  const handleDelete = async (row: WikiListRow) => {
    if (!window.confirm(`确认删除行业百科词条「${row.title}」(/wiki/${row.slug})？删除后不可恢复！`)) {
      return;
    }

    setDeletingId(row.id);
    setErrorBanner(null);
    setNoticeBanner(null);
    try {
      const res = await fetch(`/api/admin/wiki?id=${encodeURIComponent(row.id)}`, {
        method: 'DELETE',
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setErrorBanner(formatApiError(res.status, typeof json.error === 'string' ? json.error : undefined));
        return;
      }

      setNoticeBanner(`已删除词条「${row.title}」`);
      // 若当前页仅剩一条且不在第 1 页，回退一页避免停留在空页
      if (rows.length <= 1 && page > 1) {
        setPage(page - 1);
      } else {
        await fetchList(page, activeQuery, statusFilter);
      }
    } catch (err) {
      console.error('Failed to delete wiki entry:', err);
      setErrorBanner('网络异常，删除失败。');
    } finally {
      setDeletingId(null);
    }
  };

  const handleSaveEditor = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editId) return;

    setEditorError(null);
    const trimmedTitle = title.trim();
    const trimmedSummary = summary.trim();
    const trimmedVideoUrl = videoUrl.trim();
    const trimmedCoverImage = coverImage.trim();

    if (!trimmedTitle) {
      setEditorError('词条标题不能为空');
      return;
    }
    if (!trimmedSummary) {
      setEditorError('核心摘要不能为空');
      return;
    }
    if (!contentMd.trim()) {
      setEditorError('深度图文 Markdown 正文不能为空');
      return;
    }
    if (trimmedVideoUrl && !isSafeWikiUrl(trimmedVideoUrl)) {
      setEditorError('video_url 格式不安全或无效，仅允许 http(s):// 或站内 / 路径');
      return;
    }
    if (trimmedCoverImage && !isSafeWikiUrl(trimmedCoverImage)) {
      setEditorError('cover_image 格式不安全或无效，仅允许 http(s):// 或站内 / 路径');
      return;
    }

    const faqValidation = validateFaqItemsJson(faqText);
    if (faqValidation.error || !faqValidation.items) {
      setEditorError(faqValidation.error || 'FAQ JSON 校验失败');
      return;
    }

    const sourcesValidation = validateSourcesJson(sourcesText);
    if (sourcesValidation.error || !sourcesValidation.items) {
      setEditorError(sourcesValidation.error || '信源 JSON 校验失败');
      return;
    }

    setSaving(true);
    try {
      const res = await fetch('/api/admin/wiki', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: editId,
          title: trimmedTitle,
          summary: trimmedSummary,
          video_url: trimmedVideoUrl,
          cover_image: trimmedCoverImage,
          status,
          content_md: contentMd,
          faq_items: faqValidation.items,
          sources: sourcesValidation.items,
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setEditorError(formatApiError(res.status, typeof json.error === 'string' ? json.error : undefined));
        return;
      }

      setView('list');
      setNoticeBanner(`词条「${trimmedTitle}」已保存并更新。`);
      await fetchList(page, activeQuery, statusFilter);
    } catch (err) {
      console.error('Failed to save wiki entry:', err);
      setEditorError('网络异常，保存失败，请检查网络连接后重试。');
    } finally {
      setSaving(false);
    }
  };

  return (
    <AdminLayout currentPage="wiki">
      <div className="admin-body">
        <div className="admin-topbar">
          <h1 className="admin-page-title">📚 行业百科管理</h1>
          {view === 'editor' && (
            <button
              type="button"
              className="admin-btn admin-btn-secondary"
              onClick={() => {
                setView('list');
                setEditorError(null);
              }}
            >
              ← 返回列表
            </button>
          )}
        </div>

        {/* 管线说明提示条 */}
        <div
          className="admin-card"
          style={{
            marginBottom: '16px',
            padding: '12px 16px',
            borderLeft: '3px solid var(--admin-accent)',
            fontSize: '0.85rem',
            color: 'var(--admin-text-secondary)',
            lineHeight: 1.6,
          }}
        >
          💡 词条由 <strong style={{ color: 'var(--admin-text)' }}>MG推广</strong> 管线自动推送至{' '}
          <code style={{ color: 'var(--admin-accent-light)' }}>/api/agent/wiki</code>
          ，此处提供微调、视频位配置、上下架与删除。
        </div>

        {errorBanner && (
          <div
            role="alert"
            className="admin-card"
            style={{
              marginBottom: '16px',
              padding: '12px 16px',
              borderColor: 'rgba(239, 68, 68, 0.45)',
              backgroundColor: 'rgba(239, 68, 68, 0.12)',
              color: '#fecaca',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              gap: '12px',
            }}
          >
            <span>⚠️ {errorBanner}</span>
            <button
              type="button"
              className="admin-btn admin-btn-secondary"
              style={{ padding: '4px 10px', fontSize: '0.78rem' }}
              onClick={() => fetchList(page, activeQuery, statusFilter)}
            >
              重试
            </button>
          </div>
        )}

        {noticeBanner && (
          <div
            className="admin-card"
            style={{
              marginBottom: '16px',
              padding: '10px 16px',
              borderColor: 'rgba(16, 185, 129, 0.4)',
              backgroundColor: 'rgba(16, 185, 129, 0.1)',
              color: '#a7f3d0',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              fontSize: '0.85rem',
            }}
          >
            <span>✅ {noticeBanner}</span>
            <button
              type="button"
              className="admin-btn admin-btn-secondary"
              style={{ padding: '2px 8px', fontSize: '0.75rem' }}
              onClick={() => setNoticeBanner(null)}
            >
              关闭
            </button>
          </div>
        )}

        {view === 'list' ? (
          <div className="admin-card">
            {/* 搜索与状态筛选栏 */}
            <form
              onSubmit={handleSearchSubmit}
              style={{
                display: 'flex',
                flexWrap: 'wrap',
                gap: '10px',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: '16px',
              }}
            >
              <div style={{ display: 'flex', gap: '8px', flex: '1 1 320px', maxWidth: '540px' }}>
                <input
                  type="text"
                  className="admin-input"
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  placeholder="搜索标题 / slug / 国家 / 品类，按回车查询..."
                />
                <button type="submit" className="admin-btn" style={{ whiteSpace: 'nowrap' }}>
                  搜索
                </button>
                {(activeQuery || statusFilter !== 'all') && (
                  <button
                    type="button"
                    className="admin-btn admin-btn-secondary"
                    style={{ whiteSpace: 'nowrap' }}
                    onClick={handleResetFilters}
                  >
                    重置
                  </button>
                )}
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '0.82rem', color: 'var(--admin-text-secondary)' }}>状态：</span>
                {(['all', 'published', 'draft'] as StatusFilter[]).map((st) => {
                  const label = st === 'all' ? '全部' : st === 'published' ? '已发布' : '草稿';
                  return (
                    <button
                      key={st}
                      type="button"
                      className={`admin-btn ${statusFilter === st ? '' : 'admin-btn-secondary'}`}
                      style={{ padding: '6px 12px', fontSize: '0.8rem' }}
                      onClick={() => handleStatusFilterChange(st)}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
            </form>

            {loading ? (
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'center',
                  alignItems: 'center',
                  height: '260px',
                  color: 'var(--admin-text-secondary)',
                }}
              >
                正在加载行业百科词条...
              </div>
            ) : (
              <>
                <div className="admin-table-container">
                  <table className="admin-table">
                    <thead>
                      <tr>
                        <th>标题与 Slug</th>
                        <th>国家 × 品类</th>
                        <th>流通原型</th>
                        <th>浏览量</th>
                        <th>状态</th>
                        <th>更新时间</th>
                        <th style={{ textAlign: 'right' }}>操作</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((r) => {
                        const hasSafeSlug = typeof r.slug === 'string' && SAFE_SLUG_REGEX.test(r.slug);
                        const isPublished = r.status === 'published';
                        const isBusy =
                          loadingDetailId === r.id || togglingId === r.id || deletingId === r.id;

                        return (
                          <tr key={r.id}>
                            <td style={{ maxWidth: '320px' }}>
                              <div style={{ fontWeight: 600, color: '#ffffff', marginBottom: '4px' }}>
                                {r.title}
                              </div>
                              <div style={{ fontSize: '0.75rem', color: 'var(--admin-text-secondary)' }}>
                                <code>/wiki/{r.slug}</code>
                                {r.hs_code_6 ? ` · HS ${r.hs_code_6}` : ''}
                              </div>
                            </td>
                            <td>
                              <span style={{ fontSize: '0.85rem' }}>
                                {r.country_name} × {r.industry_name}
                              </span>
                            </td>
                            <td>
                              <span className="admin-badge admin-badge-primary">
                                {getArchetypeShortTag(r.archetype_id)}
                              </span>
                            </td>
                            <td>{Number(r.view_count || 0).toLocaleString('zh-CN')}</td>
                            <td>
                              <span
                                className={`admin-badge ${
                                  isPublished ? 'admin-badge-success' : 'admin-badge-warning'
                                }`}
                              >
                                {isPublished ? '已发布' : '草稿'}
                              </span>
                            </td>
                            <td style={{ whiteSpace: 'nowrap', fontSize: '0.8rem' }}>
                              {formatDateTime(r.updated_at)}
                            </td>
                            <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                              <div style={{ display: 'inline-flex', gap: '6px', alignItems: 'center' }}>
                                {isPublished && hasSafeSlug && (
                                  <>
                                    <a
                                      href={'/wiki/' + r.slug}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="admin-btn admin-btn-secondary"
                                      style={{
                                        padding: '4px 9px',
                                        fontSize: '0.75rem',
                                        textDecoration: 'none',
                                      }}
                                    >
                                      前台预览
                                    </a>
                                    <a
                                      href={'/wiki/' + r.slug + '.md'}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="admin-btn admin-btn-secondary"
                                      style={{
                                        padding: '4px 9px',
                                        fontSize: '0.75rem',
                                        textDecoration: 'none',
                                      }}
                                    >
                                      .md
                                    </a>
                                  </>
                                )}
                                <button
                                  type="button"
                                  className="admin-btn admin-btn-secondary"
                                  style={{ padding: '4px 10px', fontSize: '0.75rem' }}
                                  disabled={isBusy}
                                  onClick={() => handleOpenEditor(r.id)}
                                >
                                  {loadingDetailId === r.id ? '读取中...' : '编辑'}
                                </button>
                                <button
                                  type="button"
                                  className="admin-btn admin-btn-secondary"
                                  style={{ padding: '4px 10px', fontSize: '0.75rem' }}
                                  disabled={isBusy}
                                  onClick={() => handleToggleStatus(r)}
                                >
                                  {togglingId === r.id
                                    ? '处理中...'
                                    : isPublished
                                    ? '下架'
                                    : '发布'}
                                </button>
                                <button
                                  type="button"
                                  className="admin-btn admin-btn-danger"
                                  style={{ padding: '4px 10px', fontSize: '0.75rem' }}
                                  disabled={isBusy}
                                  onClick={() => handleDelete(r)}
                                >
                                  {deletingId === r.id ? '删除中...' : '删除'}
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                      {rows.length === 0 && (
                        <tr>
                          <td
                            colSpan={7}
                            style={{
                              textAlign: 'center',
                              color: 'var(--admin-text-secondary)',
                              padding: '44px 0',
                            }}
                          >
                            暂无匹配的行业百科词条。
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>

                {/* 分页控制栏 */}
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    flexWrap: 'wrap',
                    gap: '12px',
                    marginTop: '16px',
                    paddingTop: '16px',
                    borderTop: '1px solid var(--admin-border)',
                    fontSize: '0.84rem',
                    color: 'var(--admin-text-secondary)',
                  }}
                >
                  <div>
                    共 <strong>{total}</strong> 条词条 · 第 <strong>{page}</strong> /{' '}
                    <strong>{totalPages}</strong> 页
                  </div>
                  <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                    <button
                      type="button"
                      className="admin-btn admin-btn-secondary"
                      style={{ padding: '4px 10px', fontSize: '0.8rem' }}
                      disabled={page <= 1 || loading}
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
                    >
                      上一页
                    </button>
                    {Array.from({ length: totalPages }, (_, idx) => idx + 1)
                      .filter((p) => p === 1 || p === totalPages || Math.abs(p - page) <= 2)
                      .map((p, idx, arr) => {
                        const prev = arr[idx - 1];
                        const showEllipsis = prev && p - prev > 1;
                        return (
                          <React.Fragment key={p}>
                            {showEllipsis && <span style={{ padding: '0 4px' }}>...</span>}
                            <button
                              type="button"
                              className={`admin-btn ${p === page ? '' : 'admin-btn-secondary'}`}
                              style={{ padding: '4px 10px', fontSize: '0.8rem' }}
                              disabled={loading}
                              onClick={() => setPage(p)}
                            >
                              {p}
                            </button>
                          </React.Fragment>
                        );
                      })}
                    <button
                      type="button"
                      className="admin-btn admin-btn-secondary"
                      style={{ padding: '4px 10px', fontSize: '0.8rem' }}
                      disabled={page >= totalPages || loading}
                      onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    >
                      下一页
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        ) : (
          /* 编辑视图 */
          <form onSubmit={handleSaveEditor} className="admin-card">
            <div
              style={{
                display: 'flex',
                flexWrap: 'wrap',
                justifyContent: 'space-between',
                alignItems: 'center',
                gap: '12px',
                marginBottom: '20px',
                paddingBottom: '12px',
                borderBottom: '1px solid var(--admin-border)',
              }}
            >
              <div>
                <h2 className="admin-card-title" style={{ marginBottom: '4px' }}>
                  ✍️ 编辑行业百科词条
                </h2>
                <div style={{ fontSize: '0.82rem', color: 'var(--admin-text-secondary)' }}>
                  只读 Slug：<code style={{ color: 'var(--admin-accent-light)' }}>/wiki/{editSlug}</code>
                </div>
              </div>
              {status === 'published' && SAFE_SLUG_REGEX.test(editSlug) && (
                <a
                  href={'/wiki/' + editSlug}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="admin-btn admin-btn-secondary"
                  style={{ padding: '6px 12px', fontSize: '0.8rem', textDecoration: 'none' }}
                >
                  ↗ 打开前台页面
                </a>
              )}
            </div>

            {editorError && (
              <div
                role="alert"
                style={{
                  marginBottom: '16px',
                  padding: '10px 14px',
                  borderRadius: '6px',
                  border: '1px solid rgba(239, 68, 68, 0.45)',
                  backgroundColor: 'rgba(239, 68, 68, 0.12)',
                  color: '#fecaca',
                  fontSize: '0.85rem',
                }}
              >
                ⚠️ {editorError}
              </div>
            )}

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px' }}>
              <div className="admin-form-group">
                <label className="admin-label">词条标题（title）</label>
                <input
                  type="text"
                  className="admin-input"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="请输入行业百科词条标题"
                  required
                />
              </div>

              <div className="admin-form-group">
                <label className="admin-label">发布状态（status）</label>
                <select
                  className="admin-select"
                  value={status}
                  onChange={(e) => setStatus(e.target.value === 'published' ? 'published' : 'draft')}
                >
                  <option value="draft" style={{ background: '#12122a', color: '#e0e0e0' }}>
                    draft（草稿，仅后台可见）
                  </option>
                  <option value="published" style={{ background: '#12122a', color: '#e0e0e0' }}>
                    published（已发布，前台展示并参与 GEO/Sitemap）
                  </option>
                </select>
              </div>
            </div>

            <div className="admin-form-group">
              <label className="admin-label">核心摘要（summary / SEO &amp; GEO Description）</label>
              <textarea
                rows={3}
                className="admin-textarea"
                value={summary}
                onChange={(e) => setSummary(e.target.value)}
                placeholder="请输入 1-2 句高信息密度的产业结论摘要..."
                required
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px' }}>
              <div className="admin-form-group">
                <label className="admin-label">35 秒竖屏视频 URL（video_url，可选）</label>
                <input
                  type="text"
                  className="admin-input"
                  value={videoUrl}
                  onChange={(e) => setVideoUrl(e.target.value)}
                  placeholder="https://... 或 /...（留空则不显示视频）"
                />
              </div>

              <div className="admin-form-group">
                <label className="admin-label">封面图 URL（cover_image，可选）</label>
                <input
                  type="text"
                  className="admin-input"
                  value={coverImage}
                  onChange={(e) => setCoverImage(e.target.value)}
                  placeholder="https://... 或 /...（留空使用默认视觉）"
                />
              </div>
            </div>

            {/* 深度图文 Markdown 编辑与 SafeMarkdown 预览切换 */}
            <div className="admin-form-group">
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: '8px',
                }}
              >
                <label className="admin-label" style={{ marginBottom: 0 }}>
                  深度图文 Markdown（content_md）
                </label>
                <button
                  type="button"
                  className="admin-btn admin-btn-secondary"
                  style={{ padding: '4px 12px', fontSize: '0.78rem' }}
                  onClick={() => setMdMode((prev) => (prev === 'source' ? 'preview' : 'source'))}
                >
                  {mdMode === 'source' ? '👁️ 切换 SafeMarkdown 实时渲染预览' : '📝 切换源码编辑'}
                </button>
              </div>

              {mdMode === 'source' ? (
                <textarea
                  rows={16}
                  className="admin-textarea"
                  style={{ fontFamily: 'monospace', lineHeight: 1.6 }}
                  value={contentMd}
                  onChange={(e) => setContentMd(e.target.value)}
                  placeholder="请输入行业百科深度分析 Markdown..."
                  required
                />
              ) : (
                <div
                  style={{
                    backgroundColor: '#ffffff',
                    borderRadius: '8px',
                    padding: '20px 24px',
                    border: '1px solid var(--admin-border)',
                    maxHeight: '520px',
                    overflowY: 'auto',
                  }}
                >
                  <SafeMarkdown content={contentMd} />
                </div>
              )}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '16px' }}>
              <div className="admin-form-group">
                <label className="admin-label">FAQ 问答 JSON 数组（faq_items，每项须含非空 q 与 a）</label>
                <textarea
                  rows={10}
                  className="admin-textarea"
                  style={{ fontFamily: 'monospace', fontSize: '0.8rem', lineHeight: 1.5 }}
                  value={faqText}
                  onChange={(e) => setFaqText(e.target.value)}
                  placeholder='[{"q": "问题", "a": "回答"}]'
                />
              </div>

              <div className="admin-form-group">
                <label className="admin-label">
                  权威信源 JSON 数组（sources，若有 url 须为合法 http(s):// 或 / 路径）
                </label>
                <textarea
                  rows={10}
                  className="admin-textarea"
                  style={{ fontFamily: 'monospace', fontSize: '0.8rem', lineHeight: 1.5 }}
                  value={sourcesText}
                  onChange={(e) => setSourcesText(e.target.value)}
                  placeholder='[{"title": "UN Comtrade", "url": "https://comtradeplus.un.org/", "publisher": "UN"}]'
                />
              </div>
            </div>

            <div style={{ display: 'flex', gap: '12px', marginTop: '20px' }}>
              <button
                type="button"
                className="admin-btn admin-btn-secondary"
                disabled={saving}
                onClick={() => {
                  setView('list');
                  setEditorError(null);
                }}
              >
                取消
              </button>
              <button type="submit" className="admin-btn" disabled={saving} style={{ flex: 1 }}>
                {saving ? '正在保存中...' : '💾 保存修改'}
              </button>
            </div>
          </form>
        )}
      </div>
    </AdminLayout>
  );
}
