import xss, { IFilterXSSOptions, IWhiteList } from 'xss';

/**
 * 通用的富文本消毒配置
 * 在 SSR 和客户端共用，使用纯 JS 的 xss 库（不依赖 DOM/jsdom），
 * 避免 isomorphic-dompurify 在 部署环境 中出现 ESM require 问题。
 */
const XSS_WHITELIST: IWhiteList = {
  h1: [], h2: [], h3: [], h4: [], h5: [], h6: [],
  p: [], br: [], hr: [],
  strong: [], em: [], b: [], i: [], u: [], s: [],
  blockquote: [], pre: [], code: [],
  ul: [], ol: [], li: [],
  table: [], thead: [], tbody: [], tr: [], th: [], td: [],
  a: ['href', 'target', 'rel'],
  img: ['src', 'alt', 'title', 'width', 'height'],
  div: [], span: [], section: [], article: [],
  figure: [], figcaption: [],
};

const XSS_OPTIONS: IFilterXSSOptions = {
  whiteList: XSS_WHITELIST,
  stripIgnoreTag: true,
  stripIgnoreTagBody: ['script', 'style'],
  allowCommentTag: false,
  css: false,
  // 放行 img.src 和 a.href 的各类 URL（内容来自管理员后端，视为可信源）
  // 注意：onTagAttr 返回的是完整属性字符串 "name=value"，不只是 value
  onTagAttr(tag, name, value) {
    if (tag === 'img' && name === 'src') return `${name}="${value}"`;
    if (tag === 'a' && name === 'href') return `${name}="${value}"`;
  },
};

/**
 * 服务端/客户端通用的 HTML 消毒函数
 */
export function sanitizeHtml(html: string): string {
  if (!html) return '';
  return xss(html, XSS_OPTIONS);
}
