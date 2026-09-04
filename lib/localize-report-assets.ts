// 报告 HTML 外部 CDN 资源本地化
// ---------------------------------------------------------------------------
// 背景：报告正文（content_html）引用了多个境外 CDN（Google Fonts / unpkg /
// jsdelivr / tailwind），在国内网络环境下访问缓慢甚至不可达，导致 iframe
// 报告内容长时间空白。本模块在渲染前将这些引用替换为服务器本地静态资源
// （public/vendor/），实现零外部依赖加载。
// ---------------------------------------------------------------------------

const CDN_REPLACEMENTS: Array<[RegExp, string]> = [
  // Tailwind Play CDN（浏览器运行时版本）
  [/https:\/\/cdn\.tailwindcss\.com[^"'\s>]*/g, '/vendor/tailwind.min.js'],
  // ECharts（jsDelivr）
  [/https:\/\/cdn\.jsdelivr\.net\/npm\/echarts@[^"'\s>]*\/dist\/echarts\.min\.js/g, '/vendor/echarts.min.js'],
  // lucide 图标库（unpkg）
  [/https:\/\/unpkg\.com\/lucide@[^"'\s>]*/g, '/vendor/lucide.min.js'],
];

// 移除 Google Fonts Inter 引用（正文已使用系统字体栈，此链接仅为兜底，移除无风险）
const GOOGLE_FONTS_LINK = /<link[^>]*href="https:\/\/fonts\.googleapis\.com\/css2\?family=Inter[^"]*"[^>]*>/g;

/**
 * 将报告 HTML 中的外部 CDN 引用替换为本地静态资源路径，并注入外部链接与图片处理脚本。
 * @param html 原始 content_html，可能为 null
 * @returns 本地化后的 HTML 字符串
 */
export function localizeReportHtml(html: string | null | undefined): string {
  if (!html) return '';
  let result = html;
  for (const [pattern, replacement] of CDN_REPLACEMENTS) {
    result = result.replace(pattern, replacement);
  }

  // 1. 如果没有 base 标签，在 <head> 中注入 <base target="_blank">，确保所有超链接默认在新标签页打开
  if (!/<base[^>]*target=/i.test(result)) {
    if (/<head[^>]*>/i.test(result)) {
      result = result.replace(/<head[^>]*>/i, '$&\n    <base target="_blank">');
    }
  }

  // 2. 注入脚本：图片点击预览 + 全局超链接拦截保护（杜绝在沙箱 iframe 内部发生导航）
  const previewScript = `
<style>
  img { cursor: zoom-in !important; transition: opacity 0.2s ease, transform 0.2s ease; }
  img:hover { opacity: 0.95; }
</style>
<script>
  // 1. 图片点击预览事件
  document.addEventListener('click', function(e) {
    var target = e.target;
    if (target && target.tagName === 'IMG') {
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
</script>
`;
  return result + previewScript;
}
