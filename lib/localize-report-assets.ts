// 报告 HTML 外部 CDN 资源本地化与渲染加速
// ---------------------------------------------------------------------------
// 背景：报告正文（content_html）可能引用了境外 CDN（Google Fonts / unpkg /
// jsdelivr / cdnjs / tailwind），在国内网络环境下访问缓慢甚至不可达，导致 iframe
// 报告内容长时间空白或阻塞达 30 秒。本模块在渲染前将这些引用替换为服务器本地静态资源
// （/vendor/），彻底剥离阻塞性的外部字体与样式表，实现零外部依赖秒级渲染。
// ---------------------------------------------------------------------------

const CDN_REPLACEMENTS: Array<[RegExp, string]> = [
  // Tailwind Play CDN（浏览器运行时版本）
  [/https?:\/\/cdn\.tailwindcss\.com[^"'\s>]*/gi, '/vendor/tailwind.min.js'],
  // ECharts（jsDelivr / unpkg / cdnjs / fastly）
  [/https?:\/\/(?:cdn\.jsdelivr\.net|unpkg\.com|cdnjs\.cloudflare\.com|fastly\.jsdelivr\.net)\/(?:npm\/)?echarts@[^"'\s>]*\/dist\/echarts\.min\.js/gi, '/vendor/echarts.min.js'],
  [/https?:\/\/(?:cdn\.jsdelivr\.net|unpkg\.com|cdnjs\.cloudflare\.com|fastly\.jsdelivr\.net)\/(?:npm\/)?echarts(?:\.min)?\.js/gi, '/vendor/echarts.min.js'],
  // Lucide 图标库（unpkg / jsdelivr / cdnjs / fastly）
  [/https?:\/\/(?:cdn\.jsdelivr\.net|unpkg\.com|cdnjs\.cloudflare\.com|fastly\.jsdelivr\.net)\/(?:npm\/)?lucide@[^"'\s>]*\/dist\/umd\/lucide(?:\.min)?\.js/gi, '/vendor/lucide.min.js'],
  [/https?:\/\/(?:cdn\.jsdelivr\.net|unpkg\.com|cdnjs\.cloudflare\.com|fastly\.jsdelivr\.net)\/(?:npm\/)?lucide(?:\.min)?\.js/gi, '/vendor/lucide.min.js'],
];

// 移除 Google Fonts / gstatic 外部字体链接与预连接（正文使用系统字体栈，杜绝境外 30 秒 TCP 超时阻塞）
const FONT_LINK_PATTERNS: RegExp[] = [
  /<link[^>]*href=["']https?:\/\/fonts\.googleapis\.com[^"']*["'][^>]*>\s*/gi,
  /<link[^>]*href=["']https?:\/\/fonts\.gstatic\.com[^"']*["'][^>]*>\s*/gi,
  /<link[^>]*rel=["']preconnect["'][^>]*fonts\.(?:googleapis|gstatic)\.com[^>]*>\s*/gi,
  /@import\s+(?:url\()?["']?https?:\/\/fonts\.googleapis\.com[^"')]+["']?\)?\s*;?\s*/gi,
  /@import\s+(?:url\()?["']?https?:\/\/fonts\.gstatic\.com[^"')]+["']?\)?\s*;?\s*/gi,
];

/**
 * 将报告 HTML 中的外部 CDN 引用替换为本地静态资源路径，并注入外部链接与图片处理脚本。
 * @param html 原始 content_html，可能为 null
 * @returns 本地化后的 HTML 字符串
 */
export function localizeReportHtml(html: string | null | undefined): string {
  if (!html) return '';
  let result = html;

  // 1. 彻底清除境外 Google Fonts 等阻塞性字体链接
  for (const pattern of FONT_LINK_PATTERNS) {
    result = result.replace(pattern, '');
  }

  // 2. 替换公共 CDN 依赖为本地高速 /vendor/ 静态资源
  for (const [pattern, replacement] of CDN_REPLACEMENTS) {
    result = result.replace(pattern, replacement);
  }

  // 3. 为所有 img 标签智能注入 loading="lazy" 与 decoding="async"，防止海外图片卡住页面渲染
  result = result.replace(/<img(?![^>]*\bloading=)([^>]*?)>/gi, '<img loading="lazy" decoding="async"$1>');

  // 4. 如果没有 base 标签，在 <head> 中注入 <base target="_blank">，确保所有超链接默认在新标签页打开
  if (!/<base[^>]*target=/i.test(result)) {
    if (/<head[^>]*>/i.test(result)) {
      result = result.replace(/<head[^>]*>/i, '$&\n    <base target="_blank">');
    }
  }

  // 5. 注入脚本：图片点击预览 + 全局超链接拦截保护 + 图片加载容错
  const previewScript = `
<style>
  img { cursor: zoom-in !important; transition: opacity 0.2s ease, transform 0.2s ease; }
  img:hover { opacity: 0.95; }
  a img, .powered-by-mg img, footer img, .no-zoom { cursor: pointer !important; }
</style>
<script>
  // 1. 图片点击预览事件
  document.addEventListener('click', function(e) {
    var target = e.target;
    if (target && target.tagName === 'IMG') {
      // 过滤超链接内的图片、Header/Footer Logo 或显式标记不放大的图片
      if (target.closest('a') || target.closest('.powered-by-mg') || target.closest('footer') || target.classList.contains('no-zoom')) {
        return;
      }
      window.parent.postMessage({ type: 'GTB_PREVIEW_IMAGE', src: target.src }, '*');
    }
  });

  // 2. 外部链接/互联报告链接安全拦截（防止在沙箱 iframe 内部跳转导致 SecurityError 崩溃）
  document.addEventListener('click', function(e) {
    var a = e.target.closest('a');
    if (a) {
      var href = a.getAttribute('href') || '';
      // 排除空链接、页内锚点跳转（如 #section-1）和 javascript:void(0)
      if (href && !href.startsWith('#') && !href.startsWith('javascript:')) {
        e.preventDefault();
        window.open(a.href, '_blank', 'noopener,noreferrer');
      }
    }
  }, true);

  // 3. 图片加载失败优雅兜底，防止碎图影响排版
  document.addEventListener('error', function(e) {
    var target = e.target;
    if (target && target.tagName === 'IMG') {
      target.style.opacity = '0.3';
      target.alt = (target.alt ? target.alt + ' (图片加载中或已失效)' : '图片加载中或已失效');
    }
  }, true);
</script>
`;
  return result + previewScript;
}
