/**
 * 纯浏览器/服务端通用域名与企业名称清洗工具（零 Node.js / DB 依赖）
 */

/**
 * 提取网址根域名（去除协议、路径及 www. 前缀，统一小写）
 * @param rawUrl 原始 URL 或域名字符串
 * @returns 根域名；无法解析时返回空字符串
 */
export function extractRootDomain(rawUrl: string): string {
  if (!rawUrl) return '';
  let url = rawUrl.trim().toLowerCase();
  if (!url.startsWith('http://') && !url.startsWith('https://')) {
    url = 'http://' + url;
  }
  try {
    const parsed = new URL(url);
    let host = parsed.hostname;
    if (host.startsWith('www.')) {
      host = host.substring(4);
    }
    return host;
  } catch {
    return '';
  }
}

/**
 * 清洗公司名称（去除常见法律后缀、标点及多余空格），用于模糊碰撞匹配
 * @param rawName 原始企业名称
 * @returns 归一化后的企业简称
 */
export function cleanCompanyNameForLookup(rawName: string): string {
  if (!rawName) return '';
  return rawName
    .toLowerCase()
    .replace(/\b(ltd|limited|inc|incorporated|corp|corporation|llc|gmbh|sa|srl|bv|co\.?,\s*ltd\.?|co\.?)\b/gi, '')
    .replace(/[^\w\s\u4e00-\u9fa5]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}
