import { NextApiRequest, NextApiResponse } from 'next';
import { PoolClient } from 'pg';
import { withDb } from '../../../lib/api-handler';
import { extractRootDomain } from '../../../lib/crm-service';
import { uploadWikiAsset } from '../../../lib/storage';
import {
  MarketFlowData,
  isSafeWikiUrl,
  normalizeWikiSlug,
  validateMarketFlowData,
} from '../../../lib/wiki-schema';
import { upsertWikiEntry } from '../../../lib/wiki-service';

// 仅允许安全位图格式，明确排除 image/svg+xml 以防止内嵌脚本 XSS
const ALLOWED_LOGO_MIME_EXT: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/webp': 'webp',
  'image/gif': 'gif',
};

const MAX_LOGO_BYTES = 2 * 1024 * 1024;
const MAX_LOGO_BASE64_LEN = Math.ceil((MAX_LOGO_BYTES * 4) / 3) + 4;
const PNG_MAGIC = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

function isOptionalSafeUrl(raw: unknown): boolean {
  if (raw === undefined || raw === null || raw === '') return true;
  if (typeof raw !== 'string') return false;
  if (!raw.trim()) return true;
  return isSafeWikiUrl(raw);
}

/**
 * 校验图片二进制头魔数，拦截伪造 MIME 的文本/SVG/HTML 载荷
 */
function matchesImageMagicBytes(buffer: Buffer, mime: string): boolean {
  if (mime === 'image/png') {
    if (buffer.length < PNG_MAGIC.length) return false;
    return PNG_MAGIC.every((byte, idx) => buffer[idx] === byte);
  }
  if (mime === 'image/jpeg') {
    return buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
  }
  if (mime === 'image/gif') {
    if (buffer.length < 6) return false;
    const header = buffer.subarray(0, 6).toString('ascii');
    return header === 'GIF87a' || header === 'GIF89a';
  }
  if (mime === 'image/webp') {
    return (
      buffer.length >= 12 &&
      buffer.subarray(0, 4).toString('ascii') === 'RIFF' &&
      buffer.subarray(8, 12).toString('ascii') === 'WEBP'
    );
  }
  return false;
}

async function agentWikiHandler(req: NextApiRequest, res: NextApiResponse, dbClient: PoolClient) {
  const authHeader = req.headers.authorization;
  const token = (authHeader && authHeader.split(' ')[1]) || (req.headers['x-agent-key'] as string);
  const isProd = process.env.NODE_ENV === 'production';
  const expectedToken = process.env.AGENT_API_KEY;

  if (isProd && !expectedToken) {
    console.error('FATAL: 生产环境未配置 AGENT_API_KEY 环境变量');
    return res.status(500).json({ error: 'Server Configuration Error' });
  }

  const isAuthValid = isProd
    ? (Boolean(token) && token === expectedToken)
    : (token === (expectedToken || 'automation_agent_secret') || token === 'automation_agent_secret');

  if (!isAuthValid) {
    return res.status(401).json({ error: 'Unauthorized: Invalid Agent API Key' });
  }

  if (!req.body || typeof req.body !== 'object' || Array.isArray(req.body)) {
    return res.status(400).json({ error: '请求体必须为 JSON 对象' });
  }

  const {
    slug,
    title,
    summary,
    flow_data,
    content_md,
    faq_items,
    sources,
    video_url,
    cover_image,
    status,
    logos,
  } = req.body;

  // 先执行全量参数与图谱契约校验，校验不通过立即返回 400，避免在无效请求上浪费 COS 上传
  if (
    typeof title !== 'string' ||
    !title.trim() ||
    typeof summary !== 'string' ||
    !summary.trim() ||
    typeof content_md !== 'string' ||
    !content_md.trim()
  ) {
    return res.status(400).json({ error: 'title、summary、content_md 均必须为非空字符串' });
  }

  if (status !== undefined && status !== 'draft' && status !== 'published') {
    return res.status(400).json({ error: 'status 仅允许 draft 或 published' });
  }

  if (faq_items !== undefined && !Array.isArray(faq_items)) {
    return res.status(400).json({ error: 'faq_items 必须为数组' });
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

  const validation = validateMarketFlowData(flow_data);
  if (!validation.valid) {
    return res.status(400).json({ error: `flow_data 校验失败: ${validation.errors.join('; ')}` });
  }

  if (!isOptionalSafeUrl(video_url) || !isOptionalSafeUrl(cover_image)) {
    return res.status(400).json({ error: 'video_url 或 cover_image 必须为合法 http(s):// 或站内 / 路径' });
  }

  for (const node of (flow_data as MarketFlowData).flow_nodes || []) {
    for (const player of node.players || []) {
      if (!isOptionalSafeUrl(player.logo_url)) {
        return res.status(400).json({ error: 'flow_data.flow_nodes[].players[].logo_url 必须为合法安全 URL' });
      }
    }
  }

  const rawSlug =
    typeof slug === 'string' && slug.trim()
      ? slug.trim()
      : (flow_data as MarketFlowData).meta.id;

  let normalizedSlug: string;
  try {
    normalizedSlug = normalizeWikiSlug(rawSlug);
  } catch (err) {
    return res.status(400).json({ error: (err as Error).message });
  }

  // 深拷贝图谱对象后再处理并回写 Base64 Logo，避免意外修改原始请求对象
  const safeFlowData: MarketFlowData = JSON.parse(JSON.stringify(flow_data));

  if (logos && typeof logos === 'object' && !Array.isArray(logos)) {
    const uploadedByDomain = new Map<string, string>();

    for (const [rawDomain, dataUrl] of Object.entries(logos as Record<string, unknown>)) {
      if (typeof dataUrl !== 'string') continue;
      const match = dataUrl
        .trim()
        .match(/^data:([a-zA-Z0-9.+_-]+\/[a-zA-Z0-9.+_-]+);base64,([A-Za-z0-9+/=\r\n\s]+)$/i);
      if (!match) continue;

      const mime = match[1].toLowerCase();
      const ext = ALLOWED_LOGO_MIME_EXT[mime];
      if (!ext) {
        console.warn(`[AgentWiki] 跳过不受支持或高风险的 Logo MIME (${rawDomain}): ${mime}`);
        continue;
      }

      const domain = extractRootDomain(rawDomain);
      if (!domain) continue;

      // 解码前先校验 Base64 字符串长度，避免超大载荷占用解码内存
      const cleanedBase64 = match[2].replace(/\s+/g, '');
      if (!cleanedBase64 || cleanedBase64.length > MAX_LOGO_BASE64_LEN) {
        console.warn(`[AgentWiki] 跳过空编码或超长度上限的 Logo (${domain})`);
        continue;
      }

      const buffer = Buffer.from(cleanedBase64, 'base64');
      if (buffer.length === 0 || buffer.length > MAX_LOGO_BYTES) {
        console.warn(`[AgentWiki] 跳过空文件或超 2MB 的 Logo (${domain}): ${buffer.length} bytes`);
        continue;
      }

      if (!matchesImageMagicBytes(buffer, mime)) {
        console.warn(`[AgentWiki] 跳过魔数不匹配的伪造图片 Logo (${domain}): ${mime}`);
        continue;
      }

      const uploadedUrl = await uploadWikiAsset(buffer, mime, `logos/${domain}.${ext}`);
      uploadedByDomain.set(domain, uploadedUrl);
    }

    if (uploadedByDomain.size > 0) {
      for (const node of safeFlowData.flow_nodes || []) {
        for (const player of node.players || []) {
          const playerDomain = extractRootDomain(player.website);
          if (playerDomain && uploadedByDomain.has(playerDomain)) {
            player.logo_url = uploadedByDomain.get(playerDomain)!;
          }
        }
      }
    }
  }

  const result = await upsertWikiEntry(dbClient, {
    slug: normalizedSlug,
    title,
    summary,
    flow_data: safeFlowData,
    content_md,
    faq_items: Array.isArray(faq_items) ? faq_items : undefined,
    sources: Array.isArray(sources) ? sources : undefined,
    video_url: typeof video_url === 'string' && video_url.trim() ? video_url.trim() : null,
    cover_image: typeof cover_image === 'string' && cover_image.trim() ? cover_image.trim() : null,
    status: status === 'draft' ? 'draft' : 'published',
  });

  return res.status(200).json({
    success: true,
    id: result.id,
    slug: result.slug,
    url: `/wiki/${result.slug}`,
    action: result.action,
  });
}

export default withDb(agentWikiHandler, { methods: ['POST'] });

export const config = {
  api: {
    bodyParser: {
      sizeLimit: '10mb',
    },
  },
};
