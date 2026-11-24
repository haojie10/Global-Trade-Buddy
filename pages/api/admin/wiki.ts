import { NextApiRequest, NextApiResponse } from 'next';
import { PoolClient } from 'pg';
import { withDb } from '../../../lib/api-handler';
import { requireAdmin } from '../../../lib/auth';
import { isSafeWikiUrl } from '../../../lib/wiki-schema';
import { escapeIlikePattern } from '../../../lib/wiki-service';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_PAGE = 100000;

function getSingleParam(val: string | string[] | undefined): string {
  if (Array.isArray(val)) return String(val[0] || '').trim();
  return typeof val === 'string' ? val.trim() : '';
}

function isOptionalSafeUrl(raw: unknown): boolean {
  if (raw === undefined || raw === null || raw === '') return true;
  if (typeof raw !== 'string') return false;
  if (!raw.trim()) return true;
  return isSafeWikiUrl(raw);
}

async function adminWikiHandler(req: NextApiRequest, res: NextApiResponse, dbClient: PoolClient) {
  const session = requireAdmin(req);
  if (!session) {
    return res.status(403).json({ error: '权限不足，仅管理员可访问' });
  }

  if (req.method === 'GET') {
    const id = getSingleParam(req.query.id);
    if (id) {
      if (!UUID_REGEX.test(id)) {
        return res.status(400).json({ error: '无效的词条 UUID 格式' });
      }
      const detailRes = await dbClient.query('SELECT * FROM wiki_entries WHERE id = $1 LIMIT 1', [id]);
      if (detailRes.rows.length === 0) {
        return res.status(404).json({ error: '词条不存在' });
      }
      return res.status(200).json({ data: detailRes.rows[0] });
    }

    const rawPage = parseInt(getSingleParam(req.query.page) || '1', 10);
    const page = Number.isFinite(rawPage) && rawPage >= 1 ? Math.min(MAX_PAGE, rawPage) : 1;
    const rawPageSize = parseInt(getSingleParam(req.query.pageSize) || '20', 10);
    const pageSize = Number.isFinite(rawPageSize) ? Math.min(100, Math.max(1, rawPageSize)) : 20;
    const status = getSingleParam(req.query.status) || 'all';
    const q = getSingleParam(req.query.q);

    const whereClauses: string[] = [];
    const params: unknown[] = [];

    if (status === 'draft' || status === 'published') {
      params.push(status);
      whereClauses.push(`status = $${params.length}`);
    }

    if (q) {
      params.push(`%${escapeIlikePattern(q)}%`);
      const qIdx = params.length;
      whereClauses.push(
        `(title ILIKE $${qIdx} OR slug ILIKE $${qIdx} OR country_name ILIKE $${qIdx} OR industry_name ILIKE $${qIdx})`
      );
    }

    const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';
    const countRes = await dbClient.query(
      `SELECT COUNT(*)::int AS total FROM wiki_entries ${whereSql}`,
      params
    );
    const total = Number(countRes.rows[0]?.total ?? countRes.rows[0]?.count ?? 0);

    const offset = (page - 1) * pageSize;
    const listRes = await dbClient.query(
      `SELECT id, slug, title, summary, country_code, country_name, market_region,
              category_id, industry_name, hs_code_6, archetype_id, video_url, cover_image,
              status, view_count, baidu_pushed_at, published_at, created_at, updated_at
       FROM wiki_entries
       ${whereSql}
       ORDER BY updated_at DESC
       LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      [...params, pageSize, offset]
    );

    return res.status(200).json({
      data: listRes.rows,
      total,
      page,
      pageSize,
    });
  }

  if (req.method === 'PUT') {
    if (!req.body || typeof req.body !== 'object' || Array.isArray(req.body)) {
      return res.status(400).json({ error: '请求体必须为 JSON 对象' });
    }
    const body = req.body;
    const id = typeof body.id === 'string' ? body.id.trim() : '';
    if (!id || !UUID_REGEX.test(id)) {
      return res.status(400).json({ error: '缺少或无效的词条 UUID' });
    }

    const { title, summary, content_md, faq_items, sources, video_url, cover_image, status } = body;

    if (title !== undefined && (typeof title !== 'string' || !title.trim())) {
      return res.status(400).json({ error: 'title 不能为空字符串' });
    }
    if (summary !== undefined && (typeof summary !== 'string' || !summary.trim())) {
      return res.status(400).json({ error: 'summary 不能为空字符串' });
    }
    if (content_md !== undefined && (typeof content_md !== 'string' || !content_md.trim())) {
      return res.status(400).json({ error: 'content_md 不能为空字符串' });
    }
    if (faq_items !== undefined) {
      if (!Array.isArray(faq_items)) {
        return res.status(400).json({ error: 'faq_items 必须为数组' });
      }
      for (const item of faq_items) {
        if (
          !item ||
          typeof item !== 'object' ||
          Array.isArray(item) ||
          typeof (item as Record<string, unknown>).q !== 'string' ||
          !(item as Record<string, string>).q.trim() ||
          typeof (item as Record<string, unknown>).a !== 'string' ||
          !(item as Record<string, string>).a.trim()
        ) {
          return res.status(400).json({ error: 'faq_items 每项必须包含非空字符串 q 与 a' });
        }
      }
    }
    if (sources !== undefined) {
      if (!Array.isArray(sources)) {
        return res.status(400).json({ error: 'sources 必须为数组' });
      }
      for (const item of sources) {
        if (!item || typeof item !== 'object' || Array.isArray(item)) {
          return res.status(400).json({ error: 'sources 数组元素必须为对象' });
        }
        if (!isOptionalSafeUrl((item as Record<string, unknown>).url)) {
          return res.status(400).json({ error: 'sources[].url 必须为合法 http(s):// 或站内 / 路径' });
        }
      }
    }
    if (status !== undefined && status !== 'draft' && status !== 'published') {
      return res.status(400).json({ error: 'status 仅允许 draft 或 published' });
    }

    if (!isOptionalSafeUrl(video_url)) {
      return res.status(400).json({ error: 'video_url 必须为合法 http(s):// 或站内 / 路径' });
    }
    if (!isOptionalSafeUrl(cover_image)) {
      return res.status(400).json({ error: 'cover_image 必须为合法 http(s):// 或站内 / 路径' });
    }

    const setClauses: string[] = [];
    const params: unknown[] = [];

    if (title !== undefined) {
      params.push(title.trim());
      setClauses.push(`title = $${params.length}`);
    }
    if (summary !== undefined) {
      params.push(summary.trim());
      setClauses.push(`summary = $${params.length}`);
    }
    if (content_md !== undefined) {
      params.push(content_md);
      setClauses.push(`content_md = $${params.length}`);
    }
    if (faq_items !== undefined) {
      params.push(JSON.stringify(faq_items));
      setClauses.push(`faq_items = $${params.length}::jsonb`);
    }
    if (sources !== undefined) {
      params.push(JSON.stringify(sources));
      setClauses.push(`sources = $${params.length}::jsonb`);
    }
    if (video_url !== undefined) {
      const normalizedVideo = typeof video_url === 'string' && video_url.trim() ? video_url.trim() : null;
      params.push(normalizedVideo);
      setClauses.push(`video_url = $${params.length}`);
    }
    if (cover_image !== undefined) {
      const normalizedCover = typeof cover_image === 'string' && cover_image.trim() ? cover_image.trim() : null;
      params.push(normalizedCover);
      setClauses.push(`cover_image = $${params.length}`);
    }
    if (status !== undefined) {
      params.push(status);
      setClauses.push(`status = $${params.length}`);
      if (status === 'published') {
        setClauses.push('published_at = COALESCE(published_at, NOW())');
      }
    }

    if (setClauses.length === 0) {
      return res.status(400).json({ error: '至少提供一个可更新字段' });
    }

    setClauses.push('updated_at = NOW()');
    params.push(id);

    const updateRes = await dbClient.query(
      `UPDATE wiki_entries SET ${setClauses.join(', ')} WHERE id = $${params.length} RETURNING *`,
      params
    );

    if (updateRes.rows.length === 0) {
      return res.status(404).json({ error: '词条不存在' });
    }

    return res.status(200).json({ success: true, data: updateRes.rows[0] });
  }

  if (req.method === 'DELETE') {
    const queryId = getSingleParam(req.query.id);
    const bodyId = req.body && typeof req.body.id === 'string' ? req.body.id.trim() : '';
    const id = queryId || bodyId;

    if (!id || !UUID_REGEX.test(id)) {
      return res.status(400).json({ error: '缺少或无效的词条 UUID' });
    }

    const delRes = await dbClient.query('DELETE FROM wiki_entries WHERE id = $1 RETURNING id', [id]);
    if (delRes.rows.length === 0) {
      return res.status(404).json({ error: '词条不存在' });
    }

    return res.status(200).json({ success: true });
  }

  return res.status(405).json({ error: 'Method Not Allowed' });
}

export default withDb(adminWikiHandler, { methods: ['GET', 'PUT', 'DELETE'] });
