import xss, { IFilterXSSOptions, IWhiteList } from 'xss';

/**
 * 通用的富文本消毒配置
 * 在 SSR 和客户端共用，使用纯 JS 的 xss 库（不依赖 DOM/jsdom），
 * 避免 isomorphic-dompurify 在 Vercel Serverless 中出现 ESM require 问题。
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
};

/**
 * 服务端/客户端通用的 HTML 消毒函数
 */
export function sanitizeHtml(html: string): string {
  if (!html) return '';
  return xss(html, XSS_OPTIONS);
}
