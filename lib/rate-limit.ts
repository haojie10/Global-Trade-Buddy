import { NextApiRequest, NextApiResponse } from 'next';

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

// 简单的内存滑动窗口限流（单实例适用；多实例部署需换 Redis）
const store = new Map<string, RateLimitEntry>();

// 定期清理过期条目，防止内存泄漏
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of store.entries()) {
    if (entry.resetAt < now) store.delete(key);
  }
}, 60 * 1000);

export interface RateLimitOptions {
  /** 窗口时长，毫秒 */
  windowMs: number;
  /** 窗口内最大请求数 */
  max: number;
  /** 自定义 key（默认取 IP） */
  keyGenerator?: (req: NextApiRequest) => string;
  /** 触发限流时的响应 */
  message?: string;
}

function getClientIp(req: NextApiRequest): string {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string') return forwarded.split(',')[0].trim();
  if (Array.isArray(forwarded)) return forwarded[0];
  return req.socket.remoteAddress || 'unknown';
}

/**
 * 限流检查。返回 true 表示被限流（已发送 429 响应），false 表示放行。
 * 测试环境下自动跳过，不干扰单元测试。
 */
export function checkRateLimit(
  req: NextApiRequest,
  res: NextApiResponse,
  options: RateLimitOptions
): boolean {
  // 测试环境直接放行，避免单元测试被限流拦截
  if (process.env.NODE_ENV === 'test' || process.env.VITEST) return false;

  const { windowMs, max, keyGenerator, message = '请求过于频繁，请稍后再试' } = options;
  const key = keyGenerator ? keyGenerator(req) : getClientIp(req);
  const now = Date.now();

  const entry = store.get(key);
  if (!entry || entry.resetAt < now) {
    store.set(key, { count: 1, resetAt: now + windowMs });
    return false;
  }

  if (entry.count >= max) {
    res.status(429).json({ error: message });
    return true;
  }

  entry.count += 1;
  return false;
}

/**
 * 包装 handler，为其附加限流能力
 */
export function withRateLimit(
  handler: (req: NextApiRequest, res: NextApiResponse) => Promise<any>,
  options: RateLimitOptions
) {
  return async (req: NextApiRequest, res: NextApiResponse) => {
    if (checkRateLimit(req, res, options)) return;
    return handler(req, res);
  };
}
