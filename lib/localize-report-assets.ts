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
 * 将报告 HTML 中的外部 CDN 引用替换为本地静态资源路径。
 * @param html 原始 content_html，可能为 null
 * @returns 本地化后的 HTML 字符串
 */
export function localizeReportHtml(html: string | null | undefined): string {
  if (!html) return '';
  let result = html;
  for (const [pattern, replacement] of CDN_REPLACEMENTS) {
    result = result.replace(pattern, replacement);
  }
  const previewScript = `
<style>
  img { cursor: zoom-in !important; transition: opacity 0.2s ease, transform 0.2s ease; }
  img:hover { opacity: 0.95; }
</style>
<script>
  document.addEventListener('click', function(e) {
    var target = e.target;
    if (target && target.tagName === 'IMG') {
      window.parent.postMessage({ type: 'GTB_PREVIEW_IMAGE', src: target.src }, '*');
    }
  });
</script>
`;
  return result + previewScript;
}
