import { describe, it, expect } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import SafeMarkdown, {
  extractTocHeadings,
  sanitizeUrl,
} from '../components/wiki/SafeMarkdown';
import JsonLdScript, { serializeJsonLd } from '../components/wiki/JsonLdScript';

describe('sanitizeUrl 链接安全清洗', () => {
  it('放行合法的 http/https、站内单斜杠路径与页内锚点', () => {
    expect(sanitizeUrl('https://marketgraphic.cn/wiki/de-lighting')).toBe(
      'https://marketgraphic.cn/wiki/de-lighting'
    );
    expect(sanitizeUrl('  http://example.com/path?a=1&b=2  ')).toBe(
      'http://example.com/path?a=1&b=2'
    );
    expect(sanitizeUrl('/wiki/de-lighting')).toBe('/wiki/de-lighting');
    expect(sanitizeUrl('#section-1')).toBe('#section-1');
  });

  it('拦截 javascript:、data:、协议相对路径、反斜杠跳出与控制字符', () => {
    expect(sanitizeUrl('javascript:alert(1)')).toBeNull();
    expect(sanitizeUrl('JAVASCRIPT:alert(1)')).toBeNull();
    expect(sanitizeUrl('data:text/html,<script>alert(1)</script>')).toBeNull();
    expect(sanitizeUrl('vbscript:msgbox(1)')).toBeNull();
    expect(sanitizeUrl('//evil.com/phish')).toBeNull();
    expect(sanitizeUrl('/\\evil.com/phish')).toBeNull();
    expect(sanitizeUrl('https://example.com/\u0000evil')).toBeNull();
    expect(sanitizeUrl('javascript\u0009:alert(1)')).toBeNull();
    expect(sanitizeUrl('#section\u000a1')).toBeNull();
    expect(sanitizeUrl('')).toBeNull();
    expect(sanitizeUrl('#')).toBeNull();
  });
});

describe('extractTocHeadings 目录提取与锚点一致性', () => {
  it('正确提取 H2/H3、去除标记、忽略代码块内井号，并与渲染 DOM 锚点 100% 一致', () => {
    const md = [
      '# 一级总标题（不进入 TOC）',
      '',
      '## **一、核心渠道**与 `FOB` 成本',
      '',
      '```markdown',
      '## 代码块内的假二级标题',
      '### 代码块内的假三级标题',
      '```',
      '',
      '### Tier 1 · `Paulmann` 进口商层级',
      '',
      '#### 四级子标题（不进入 TOC）',
      '',
      '## 二、合规准入要求',
    ].join('\n');

    const headings = extractTocHeadings(md);
    expect(headings).toEqual([
      { level: 2, text: '一、核心渠道与 FOB 成本', id: 'section-1' },
      { level: 3, text: 'Tier 1 · Paulmann 进口商层级', id: 'section-2' },
      { level: 2, text: '二、合规准入要求', id: 'section-3' },
    ]);

    const html = renderToStaticMarkup(React.createElement(SafeMarkdown, { content: md }));
    expect(html).toContain('<h2 id="section-1"');
    expect(html).toContain('<h3 id="section-2"');
    expect(html).toContain('<h2 id="section-3"');
    expect(html).toContain('scroll-margin-top:96px');
    expect(html).not.toContain('id="section-4"');
  });
});

describe('SafeMarkdown 纯 React 安全渲染', () => {
  it('正确渲染粗体、斜体、行内代码、分隔线、安全外链与站内链接', () => {
    const md = [
      '这是**加粗核心词**、*斜体术语*与 `FOB $4.5` 行内代码。',
      '',
      '参考 [外贸智友官网](https://marketgraphic.cn) 以及 [德国照明词条](/wiki/de-lighting) 和 [第一部分](#section-1)。',
      '',
      '---',
      '',
      '***',
    ].join('\n');

    const html = renderToStaticMarkup(React.createElement(SafeMarkdown, { content: md }));
    expect(html).toContain('<strong>加粗核心词</strong>');
    expect(html).toContain('<em>斜体术语</em>');
    expect(html).toContain('<code');
    expect(html).toContain('FOB $4.5</code>');
    expect(html).toContain(
      '<a href="https://marketgraphic.cn" target="_blank" rel="noopener noreferrer"'
    );
    expect(html).toContain('<a href="/wiki/de-lighting"');
    expect(html).toContain('<a href="#section-1"');
    expect(html).toContain('<hr');
  });

  it('彻底阻断危险链接、危险图片与原生 HTML 脚本注入', () => {
    const md = [
      '点击 [危险外链](javascript:alert(1)) 或 [协议相对](//evil.com) 或 [数据协议](data:text/html,xss)。',
      '',
      '![正常图](https://marketgraphic-image-1302276463.cos.ap-shanghai.myqcloud.com/report-images/demo.png)',
      '',
      '![恶意图](javascript:alert(1))',
      '',
      '![恶意Data图](data:image/svg+xml,<svg onload=alert(1)>)',
      '',
      '<script>alert(1)</script>',
      '',
      '<img src="x" onerror="alert(1)" />',
    ].join('\n');

    const html = renderToStaticMarkup(React.createElement(SafeMarkdown, { content: md }));

    // 危险链接降级为 <span>，不包含任何 href
    expect(html).toContain('<span');
    expect(html).toContain('危险外链</span>');
    expect(html).toContain('协议相对</span>');
    expect(html).toContain('数据协议</span>');
    expect(html).not.toContain('javascript:');
    expect(html).not.toContain('data:text/html');
    expect(html).not.toContain('//evil.com');

    // 合法图片正常渲染，非法图片完全不渲染 <img>
    expect(html).toContain(
      '<img src="https://marketgraphic-image-1302276463.cos.ap-shanghai.myqcloud.com/report-images/demo.png" alt="正常图"'
    );
    const imgMatches = html.match(/<img\b/g) || [];
    expect(imgMatches.length).toBe(1);

    // 原生 HTML 标签必须被 React 自动转义，绝不出现可执行标签
    expect(html).not.toContain('<script>');
    expect(html).toContain('&lt;script&gt;alert(1)&lt;/script&gt;');
    expect(html).toContain('&lt;img src=&quot;x&quot; onerror=&quot;alert(1)&quot; /&gt;');
  });

  it('正确渲染 GFM 表格（含响应式滚动容器）、无序/有序列表、引用块与围栏代码块', () => {
    const md = [
      '> **核心提示**：进入德国建材渠道需提前备妥 `CE/ERP` 认证。',
      '',
      '| 流通阶段 | 参考价 | 说明 |',
      '| :--- | :---: | ---: |',
      '| FOB 出厂 | **$4.5** | 含基础包装 |',
      '| 终端零售 | `€39.9` | 含 19% VAT \\| 门店服务 |',
      '',
      '- 无序条目 A',
      '* 无序条目 B',
      '+ 无序条目 C',
      '',
      '1. 第一步：核验资质',
      '2. 第二步：寄样报价',
      '',
      '```ts',
      'const heading = "## 这不是标题";',
      'const bold = "**不解析粗体**";',
      '```',
    ].join('\n');

    const html = renderToStaticMarkup(React.createElement(SafeMarkdown, { content: md }));

    expect(html).toContain('<blockquote');
    expect(html).toContain('<strong>核心提示</strong>');
    expect(html).toContain('overflow-x:auto');
    expect(html).toContain('<table');
    expect(html).toContain('<thead');
    expect(html).toContain('<th');
    expect(html).toContain('<strong>$4.5</strong>');
    expect(html).toContain('含 19% VAT | 门店服务');

    expect(html).toContain('<ul');
    expect(html).toMatch(/<li[^>]*>无序条目 A<\/li>/);
    expect(html).toMatch(/<li[^>]*>无序条目 B<\/li>/);
    expect(html).toMatch(/<li[^>]*>无序条目 C<\/li>/);

    expect(html).toContain('<ol');
    expect(html).toMatch(/<li[^>]*>第一步：核验资质<\/li>/);
    expect(html).toMatch(/<li[^>]*>第二步：寄样报价<\/li>/);

    expect(html).toContain('<pre');
    expect(html).toContain('<code');
    expect(html).toContain('## 这不是标题');
    expect(html).toContain('**不解析粗体**');
    expect(html).not.toContain('<strong>不解析粗体</strong>');
  });
});

describe('JsonLdScript 结构化数据安全转义', () => {
  it('serializeJsonLd 正确转义 </script> 中的 <、> 与行分隔符，且可反序列化还原', () => {
    const payload = {
      '@context': 'https://schema.org',
      '@type': 'Article',
      headline: '测试</script><script>alert(1)</script>',
      description: '包含\u2028行分隔符与\u2029段落分隔符',
    };

    const serialized = serializeJsonLd(payload);
    expect(serialized).not.toContain('</script>');
    expect(serialized).not.toContain('<');
    expect(serialized).not.toContain('>');
    expect(serialized).toContain('\\u003c/script\\u003e');
    expect(serialized).toContain('\\u003cscript\\u003e');
    expect(serialized).toContain('\\u2028');
    expect(serialized).toContain('\\u2029');
    expect(JSON.parse(serialized)).toEqual(payload);
    expect(typeof JsonLdScript).toBe('function');
  });
});
