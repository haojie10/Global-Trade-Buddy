// 报告 HTML 外部 CDN 资源本地化与渲染加速
// ---------------------------------------------------------------------------
// 背景：报告正文（content_html）可能引用了境外 CDN（Google Fonts / unpkg /
// jsdelivr / cdnjs / tailwind），在国内网络环境下访问缓慢甚至不可达，导致 iframe
// 报告内容长时间空白或阻塞达 30 秒，或者由于 unpkg/jsdelivr 阻塞导致 lucide 报错而中断图表渲染。
// 本模块在渲染前将这些引用替换为服务器本地静态资源（/vendor/），彻底剥离阻塞性的外部字体与样式表，
// 并注入核心 API 容错 shim，实现零外部依赖秒级渲染且图表与样式 100% 正常显示。
// ---------------------------------------------------------------------------

// 移除 Google Fonts / gstatic 外部字体链接与预连接（正文使用系统字体栈，杜绝境外 30 秒 TCP 超时阻塞）
const FONT_LINK_PATTERNS: RegExp[] = [
  /<link[^>]*href=["']https?:\/\/fonts\.googleapis\.com[^"']*["'][^>]*>\s*/gi,
  /<link[^>]*href=["']https?:\/\/fonts\.gstatic\.com[^"']*["'][^>]*>\s*/gi,
  /<link[^>]*rel=["']preconnect["'][^>]*fonts\.(?:googleapis|gstatic)\.com[^>]*>\s*/gi,
  /@import\s+(?:url\()?["']?https?:\/\/fonts\.googleapis\.com[^"')]+["']?\)?\s*;?\s*/gi,
  /@import\s+(?:url\()?["']?https?:\/\/fonts\.gstatic\.com[^"')]+["']?\)?\s*;?\s*/gi,
];

/**
 * 安全替换 <script src="..."> 中的外部 CDN 依赖为本地高速 /vendor/ 静态资源。
 * 必须且仅精准替换 <script src="...">，严禁使用全局裸正则替换，避免破坏 <style> 内部的预编译 CSS 及开源协议注释！
 */
function replaceCdnScripts(html: string): string {
  return html.replace(/<script\b([^>]*?)src=(["'])(https?:\/\/[^"']+)\2([^>]*?)>/gi, (match, prefix, quote, url, suffix) => {
    // 1. Tailwind Play CDN（注意：仅匹配 cdn.tailwindcss.com 脚本，绝不触碰内联 CSS 中的 tailwindcss.com 注释）
    if (/^https?:\/\/cdn\.tailwindcss\.com/i.test(url)) {
      return `<script${prefix}src=${quote}/vendor/tailwind.min.js${quote}${suffix}>`;
    }
    // 2. ECharts CDN（匹配 jsdelivr, unpkg, cdnjs, fastly 等所有 CDN 托管源）
    if (/^https?:\/\/(?:cdn\.jsdelivr\.net|unpkg\.com|cdnjs\.cloudflare\.com|fastly\.jsdelivr\.net)\/.*echarts/i.test(url)) {
      return `<script${prefix}src=${quote}/vendor/echarts.min.js${quote}${suffix}>`;
    }
    // 3. Lucide 图标库（匹配 unpkg.com/lucide@latest, jsdelivr, cdnjs 等所有托管源）
    if (/^https?:\/\/(?:unpkg\.com|cdn\.jsdelivr\.net|cdnjs\.cloudflare\.com|fastly\.jsdelivr\.net)\/.*lucide/i.test(url)) {
      return `<script${prefix}src=${quote}/vendor/lucide.min.js${quote}${suffix}>`;
    }
    return match;
  });
}

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

  // 2. 安全替换公共 CDN 脚本为本地高速 /vendor/ 静态资源（仅替换 <script src="...">）
  result = replaceCdnScripts(result);

  // 3. 为所有 img 标签智能注入 loading="lazy" 与 decoding="async"，防止海外图片卡住页面渲染
  result = result.replace(/<img(?![^>]*\bloading=)([^>]*?)>/gi, '<img loading="lazy" decoding="async"$1>');

  // 4. 在 <head> 中注入核心保护脚本：
  //    - window.lucide 容错垫片：确保即便在任何异常场景下，内联代码中的 lucide.createIcons() 也绝不抛出异常中断图表渲染
  const headInject = `
    <script>
      window.lucide = window.lucide || { createIcons: function() {} };
    </script>
  `;

  if (/<head[^>]*>/i.test(result)) {
    result = result.replace(/<head[^>]*>/i, `$&\n${headInject}`);
  } else {
    result = `<head>${headInject}</head>\n` + result;
  }

  // 5. 注入尾部脚本：图片点击预览 + 全局超链接拦截保护 + 图片加载容错 + 图表渲染生命周期保障
  const previewScript = `
<style>
  img { cursor: zoom-in !important; transition: opacity 0.2s ease, transform 0.2s ease; }
  img:hover { opacity: 0.95; }
  a img, .powered-by-mg img, footer img, .no-zoom { cursor: pointer !important; }
</style>
<script>
  // 1. 图表就绪保障：监听 load 事件，防止网络并发下 initCharts 因极低概率时序问题跳过渲染
  window.addEventListener('load', function() {
    if (typeof initCharts === 'function' && typeof echarts !== 'undefined') {
      try {
        initCharts();
      } catch (err) {
        console.warn('initCharts retry warning:', err);
      }
    }
  });

  // 2. 图片点击预览事件
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

  // 3. 外部链接/互联报告链接安全拦截（防止在沙箱 iframe 内部跳转导致 SecurityError 崩溃）
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

  // 4. 图片加载失败优雅兜底，防止碎图影响排版
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
