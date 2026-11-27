import React from 'react';
import { isSafeWikiUrl } from '../../lib/wiki-schema';

export type TocHeading = {
  level: 2 | 3;
  text: string;
  id: string;
};

type MarkdownBlock =
  | { type: 'heading'; level: 1 | 2 | 3 | 4; text: string; tocId?: string }
  | { type: 'hr' }
  | { type: 'code'; lang: string; code: string }
  | { type: 'image'; alt: string; url: string }
  | { type: 'blockquote'; lines: string[] }
  | { type: 'list'; ordered: boolean; items: string[] }
  | {
      type: 'table';
      headers: string[];
      alignments: Array<'left' | 'center' | 'right'>;
      rows: string[][];
    }
  | { type: 'paragraph'; text: string };

/**
 * 清洗并校验 Markdown 中的链接与图片 URL
 * 复用 lib/wiki-schema.ts 的 isSafeWikiUrl，额外放行安全页内锚点 #...，
 * 拦截控制字符、javascript:、data:、//evil.com、/\evil.com 等危险协议或路径。
 * @param raw 原始 URL 字符串
 * @returns 清洗后的安全 URL，非法返回 null
 */
export function sanitizeUrl(raw: string): string | null {
  if (typeof raw !== 'string') return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;

  // 拒绝任何 ASCII 控制字符，防止协议绕过
  if (/[\u0000-\u001f\u007f]/.test(trimmed)) return null;

  if (trimmed.startsWith('#')) {
    return trimmed.length > 1 && !/\s/.test(trimmed) ? trimmed : null;
  }

  return isSafeWikiUrl(trimmed) ? trimmed : null;
}

/**
 * 去除标题中的行内格式标记（** 与 `），生成干净的目录文本
 */
function stripHeadingMarkers(raw: string): string {
  return raw.replace(/\*\*/g, '').replace(/`/g, '').trim();
}

/**
 * 从形如 "(...)" 的起始左括号位置读取括号配对完整的内容，支持 URL 内含成对括号（如 javascript:alert(1)）
 */
function readBalancedParens(
  input: string,
  openParenIndex: number
): { content: string; endIndex: number } | null {
  if (input[openParenIndex] !== '(') return null;
  let depth = 0;
  for (let i = openParenIndex; i < input.length; i++) {
    const ch = input[i];
    if (ch === '(') {
      depth++;
    } else if (ch === ')') {
      depth--;
      if (depth === 0) {
        return {
          content: input.slice(openParenIndex + 1, i),
          endIndex: i,
        };
      }
    }
  }
  return null;
}

/**
 * 从 Markdown 链接/图片圆括号内提取目标 URL（剥离可选的尾部引号 title）
 */
function extractUrlFromParenContent(rawContent: string): string {
  const trimmed = rawContent.trim();
  const titleMatch = trimmed.match(/^(.+?)\s+(?:"[^"]*"|'[^']*')\s*$/);
  return titleMatch ? titleMatch[1].trim() : trimmed;
}

/**
 * 尝试在指定位置解析 Markdown 图片语法 ![alt](url) 或链接语法 [text](url)
 */
function parseBracketTarget(
  input: string,
  startIndex: number,
  isImage: boolean
): { label: string; rawUrl: string; nextIndex: number } | null {
  const bracketStart = isImage ? startIndex + 1 : startIndex;
  if (isImage && input[startIndex] !== '!') return null;
  if (input[bracketStart] !== '[') return null;

  // 查找匹配的闭方括号（不支持未转义换行）
  let closeBracket = -1;
  for (let i = bracketStart + 1; i < input.length; i++) {
    if (input[i] === '[') {
      // 简化处理：链接文本内不嵌套裸方括号
      return null;
    }
    if (input[i] === ']') {
      closeBracket = i;
      break;
    }
  }
  if (closeBracket === -1 || input[closeBracket + 1] !== '(') return null;

  const parenResult = readBalancedParens(input, closeBracket + 1);
  if (!parenResult) return null;

  return {
    label: input.slice(bracketStart + 1, closeBracket),
    rawUrl: extractUrlFromParenContent(parenResult.content),
    nextIndex: parenResult.endIndex + 1,
  };
}

/**
 * 解析独立图片行 ![alt](url)
 */
function parseStandaloneImageLine(line: string): { alt: string; url: string } | null {
  const trimmed = line.trim();
  if (!trimmed.startsWith('![')) return null;
  const parsed = parseBracketTarget(trimmed, 0, true);
  if (!parsed || parsed.nextIndex !== trimmed.length) return null;
  return { alt: parsed.label, url: parsed.rawUrl };
}

/**
 * 拆分 GFM 表格单行单元格，正确还原转义管道符 \|
 */
function splitTableRow(line: string): string[] {
  const trimmed = line.trim();
  const rawCells: string[] = [];
  let current = '';

  for (let i = 0; i < trimmed.length; i++) {
    const ch = trimmed[i];
    if (ch === '\\' && trimmed[i + 1] === '|') {
      current += '|';
      i++;
      continue;
    }
    if (ch === '|') {
      rawCells.push(current.trim());
      current = '';
      continue;
    }
    current += ch;
  }
  rawCells.push(current.trim());

  // 去除行首尾因标准 | col1 | col2 | 产生的空占位项
  if (trimmed.startsWith('|') && rawCells.length > 0 && rawCells[0] === '') {
    rawCells.shift();
  }
  if (trimmed.endsWith('|') && rawCells.length > 0 && rawCells[rawCells.length - 1] === '') {
    rawCells.pop();
  }
  return rawCells;
}

/**
 * 判断并解析 GFM 表格对齐分隔行
 */
function parseTableAlignments(line: string): Array<'left' | 'center' | 'right'> | null {
  if (!line.includes('|')) return null;
  const cells = splitTableRow(line);
  if (cells.length === 0) return null;

  const alignments: Array<'left' | 'center' | 'right'> = [];
  for (const cell of cells) {
    const trimmed = cell.trim();
    if (!/^:?-{2,}:?$/.test(trimmed)) return null;
    const startsColon = trimmed.startsWith(':');
    const endsColon = trimmed.endsWith(':');
    if (startsColon && endsColon) {
      alignments.push('center');
    } else if (endsColon) {
      alignments.push('right');
    } else {
      alignments.push('left');
    }
  }
  return alignments;
}

function isHeadingLine(line: string): boolean {
  return /^(#{1,4})\s+(.+)$/.test(line);
}

function isHrLine(line: string): boolean {
  return /^\s*(?:-{3,}|\*{3,}|_{3,})\s*$/.test(line);
}

function isFenceStart(line: string): RegExpMatchArray | null {
  return line.match(/^\s*```([a-zA-Z0-9_-]*)\s*$/);
}

function isBlockquoteLine(line: string): boolean {
  return /^\s*>/.test(line);
}

function isUnorderedListLine(line: string): RegExpMatchArray | null {
  return line.match(/^\s*[-*+]\s+(.+)$/);
}

function isOrderedListLine(line: string): RegExpMatchArray | null {
  return line.match(/^\s*\d+\.\s+(.+)$/);
}

/**
 * 统一的块级 Markdown 解析器，确保目录提取与正文渲染的 section-N 锚点完全一致
 */
function parseMarkdownBlocks(markdown: string): MarkdownBlock[] {
  const lines = String(markdown ?? '')
    .replace(/\r\n?/g, '\n')
    .split('\n');
  const blocks: MarkdownBlock[] = [];
  let tocIndex = 0;
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    if (!line.trim()) {
      i++;
      continue;
    }

    // 1. 围栏代码块（内部不做任何标题/内联解析）
    const fenceMatch = isFenceStart(line);
    if (fenceMatch) {
      const lang = fenceMatch[1] || '';
      const codeLines: string[] = [];
      i++;
      while (i < lines.length && !/^\s*```\s*$/.test(lines[i])) {
        codeLines.push(lines[i]);
        i++;
      }
      if (i < lines.length && /^\s*```\s*$/.test(lines[i])) {
        i++;
      }
      blocks.push({ type: 'code', lang, code: codeLines.join('\n') });
      continue;
    }

    // 2. 分隔线（需在无序列表前判断，避免 *** 被误判为列表）
    if (isHrLine(line)) {
      blocks.push({ type: 'hr' });
      i++;
      continue;
    }

    // 3. H1–H4 标题
    const headingMatch = line.match(/^(#{1,4})\s+(.+?)\s*#*\s*$/);
    if (headingMatch) {
      const level = headingMatch[1].length as 1 | 2 | 3 | 4;
      let tocId: string | undefined;
      if (level === 2 || level === 3) {
        tocIndex += 1;
        tocId = `section-${tocIndex}`;
      }
      blocks.push({
        type: 'heading',
        level,
        text: headingMatch[2],
        tocId,
      });
      i++;
      continue;
    }

    // 4. 独立图片行
    const standaloneImg = parseStandaloneImageLine(line);
    if (standaloneImg) {
      blocks.push({
        type: 'image',
        alt: standaloneImg.alt,
        url: standaloneImg.url,
      });
      i++;
      continue;
    }

    // 5. GFM 表格
    if (line.includes('|') && i + 1 < lines.length) {
      const alignments = parseTableAlignments(lines[i + 1]);
      if (alignments) {
        const headers = splitTableRow(line);
        const rows: string[][] = [];
        i += 2;
        while (i < lines.length && lines[i].trim() !== '' && lines[i].includes('|')) {
          rows.push(splitTableRow(lines[i]));
          i++;
        }
        blocks.push({
          type: 'table',
          headers,
          alignments,
          rows,
        });
        continue;
      }
    }

    // 6. 引用块
    if (isBlockquoteLine(line)) {
      const quoteLines: string[] = [];
      while (i < lines.length && isBlockquoteLine(lines[i])) {
        quoteLines.push(lines[i].replace(/^\s*>\s?/, ''));
        i++;
      }
      blocks.push({ type: 'blockquote', lines: quoteLines });
      continue;
    }

    // 7. 无序列表
    if (isUnorderedListLine(line)) {
      const items: string[] = [];
      while (i < lines.length) {
        if (isHrLine(lines[i])) break;
        const m = isUnorderedListLine(lines[i]);
        if (!m) break;
        items.push(m[1]);
        i++;
      }
      blocks.push({ type: 'list', ordered: false, items });
      continue;
    }

    // 8. 有序列表
    if (isOrderedListLine(line)) {
      const items: string[] = [];
      while (i < lines.length) {
        const m = isOrderedListLine(lines[i]);
        if (!m) break;
        items.push(m[1]);
        i++;
      }
      blocks.push({ type: 'list', ordered: true, items });
      continue;
    }

    // 9. 普通段落（合并连续普通文本行）
    const paraLines: string[] = [line.trim()];
    i++;
    while (i < lines.length) {
      const next = lines[i];
      if (!next.trim()) break;
      if (
        isFenceStart(next) ||
        isHrLine(next) ||
        isHeadingLine(next) ||
        parseStandaloneImageLine(next) ||
        isBlockquoteLine(next) ||
        isUnorderedListLine(next) ||
        isOrderedListLine(next) ||
        (next.includes('|') && i + 1 < lines.length && parseTableAlignments(lines[i + 1]))
      ) {
        break;
      }
      paraLines.push(next.trim());
      i++;
    }
    blocks.push({ type: 'paragraph', text: paraLines.join(' ') });
  }

  return blocks;
}

/**
 * 提取 Markdown 正文中的 H2 与 H3 标题用于目录导航
 * @param markdown Markdown 原文
 * @returns 目录项数组，id 与正文渲染的 section-N 完全一致
 */
export function extractTocHeadings(markdown: string): TocHeading[] {
  const blocks = parseMarkdownBlocks(markdown);
  const headings: TocHeading[] = [];
  for (const block of blocks) {
    if (block.type === 'heading' && (block.level === 2 || block.level === 3) && block.tocId) {
      headings.push({
        level: block.level,
        text: stripHeadingMarkers(block.text),
        id: block.tocId,
      });
    }
  }
  return headings;
}

const inlineCodeStyle: React.CSSProperties = {
  fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
  fontSize: '0.88em',
  background: 'rgba(15, 23, 42, 0.06)',
  color: '#0f172a',
  padding: '0.12em 0.4em',
  borderRadius: '4px',
};

const linkStyle: React.CSSProperties = {
  color: '#ff641e',
  textDecoration: 'underline',
  textUnderlineOffset: '3px',
  fontWeight: 500,
};

/**
 * 纯 React 行内元素渲染器：支持行内代码、图片、链接、粗体、斜体，
 * 任何原生 HTML 标签均作为 React 文本节点自动转义，彻底杜绝 XSS。
 */
function renderInline(text: string, keyPrefix: string): React.ReactNode[] {
  const nodes: React.ReactNode[] = [];
  let buffer = '';
  let i = 0;
  let tokenIdx = 0;

  const flushBuffer = () => {
    if (buffer) {
      nodes.push(buffer);
      buffer = '';
    }
  };

  while (i < text.length) {
    // 1. 行内代码 `code`
    if (text[i] === '`') {
      const closeIdx = text.indexOf('`', i + 1);
      if (closeIdx > i + 1) {
        flushBuffer();
        nodes.push(
          <code key={`${keyPrefix}-code-${tokenIdx++}`} style={inlineCodeStyle}>
            {text.slice(i + 1, closeIdx)}
          </code>
        );
        i = closeIdx + 1;
        continue;
      }
    }

    // 2. 行内图片 ![alt](url)
    if (text[i] === '!' && text[i + 1] === '[') {
      const parsedImg = parseBracketTarget(text, i, true);
      if (parsedImg) {
        flushBuffer();
        const safeUrl = sanitizeUrl(parsedImg.rawUrl);
        if (safeUrl) {
          nodes.push(
            <img
              key={`${keyPrefix}-img-${tokenIdx++}`}
              src={safeUrl}
              alt={parsedImg.label}
              loading="lazy"
              decoding="async"
              style={{
                maxWidth: '100%',
                height: 'auto',
                borderRadius: '8px',
                display: 'inline-block',
              }}
            />
          );
        }
        i = parsedImg.nextIndex;
        continue;
      }
    }

    // 3. 链接 [text](url)
    if (text[i] === '[') {
      const parsedLink = parseBracketTarget(text, i, false);
      if (parsedLink) {
        flushBuffer();
        const safeUrl = sanitizeUrl(parsedLink.rawUrl);
        const childKey = `${keyPrefix}-link-${tokenIdx++}`;
        const labelNodes = renderInline(parsedLink.label, childKey);
        if (safeUrl) {
          const isExternal =
            safeUrl.startsWith('http://') || safeUrl.startsWith('https://');
          nodes.push(
            isExternal ? (
              <a
                key={childKey}
                href={safeUrl}
                target="_blank"
                rel="noopener noreferrer"
                style={linkStyle}
              >
                {labelNodes}
              </a>
            ) : (
              <a key={childKey} href={safeUrl} style={linkStyle}>
                {labelNodes}
              </a>
            )
          );
        } else {
          // 非法协议链接降级为纯文本 span，不输出 href
          nodes.push(<span key={childKey}>{labelNodes}</span>);
        }
        i = parsedLink.nextIndex;
        continue;
      }
    }

    // 4. 粗体 **bold**
    if (text[i] === '*' && text[i + 1] === '*') {
      const closeIdx = text.indexOf('**', i + 2);
      if (closeIdx > i + 2) {
        flushBuffer();
        const childKey = `${keyPrefix}-b-${tokenIdx++}`;
        nodes.push(
          <strong key={childKey}>{renderInline(text.slice(i + 2, closeIdx), childKey)}</strong>
        );
        i = closeIdx + 2;
        continue;
      }
    }

    // 5. 斜体 *italic*
    if (text[i] === '*' && text[i + 1] !== '*') {
      const closeIdx = text.indexOf('*', i + 1);
      if (closeIdx > i + 1) {
        flushBuffer();
        const childKey = `${keyPrefix}-i-${tokenIdx++}`;
        nodes.push(
          <em key={childKey}>{renderInline(text.slice(i + 1, closeIdx), childKey)}</em>
        );
        i = closeIdx + 1;
        continue;
      }
    }

    buffer += text[i];
    i++;
  }

  flushBuffer();
  return nodes;
}

/**
 * 纯 React 安全 Markdown 渲染组件（严禁使用 dangerouslySetInnerHTML）
 * 支持标题（含与 TOC 同步的 section-N 锚点）、围栏代码块、GFM 表格、列表、引用块、图片与链接清洗。
 */
export default function SafeMarkdown({ content }: { content: string }) {
  const blocks = parseMarkdownBlocks(content);

  return (
    <div style={{ color: '#1e293b', fontSize: '15.5px', lineHeight: 1.8 }}>
      {blocks.map((block, idx) => {
        const key = `md-block-${idx}`;

        switch (block.type) {
          case 'code': {
            // 支持正文内嵌轻量水平条形图语法（```chart-bars），格式：标签 | 数值 | 可选说明
            if (block.lang.toLowerCase() === 'chart-bars') {
              const chartRows = block.code
                .split(/\r?\n/)
                .map((line) => line.trim())
                .filter(Boolean)
                .map((line) => {
                  const parts = line.split('|').map((s) => s.trim());
                  const label = parts[0] || '';
                  const rawVal = parts[1] || '0';
                  const num = Number.parseFloat(rawVal.replace(/[^0-9.\-]/g, ''));
                  const note = parts[2] || '';
                  return { label, rawVal, num: Number.isFinite(num) ? Math.max(0, num) : 0, note };
                })
                .filter((r) => r.label);

              if (chartRows.length > 0) {
                const maxVal = Math.max(...chartRows.map((r) => r.num), 1);
                return (
                  <div
                    key={key}
                    role="figure"
                    aria-label="正文数据对比图表"
                    style={{
                      margin: '20px 0',
                      padding: '18px 20px',
                      borderRadius: '12px',
                      background: '#fafafa',
                      border: '1px solid rgba(15, 23, 42, 0.09)',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '12px',
                    }}
                  >
                    {chartRows.map((row, rIdx) => {
                      const pctWidth = Math.max(4, Math.min(100, (row.num / maxVal) * 100));
                      const barColors = ['#ff641e', '#2563eb', '#059669', '#d97706', '#7c3aed', '#475569'];
                      const color = barColors[rIdx % barColors.length];
                      return (
                        <div key={`${key}-bar-${rIdx}`} style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                          <div
                            style={{
                              display: 'flex',
                              justifyContent: 'space-between',
                              alignItems: 'baseline',
                              gap: '10px',
                              fontSize: '13.5px',
                            }}
                          >
                            <span style={{ fontWeight: 700, color: '#0f172a' }}>
                              {row.label}
                              {row.note && (
                                <span style={{ fontWeight: 400, color: '#64748b', marginLeft: '8px', fontSize: '12.5px' }}>
                                  {row.note}
                                </span>
                              )}
                            </span>
                            <span style={{ fontWeight: 800, color, whiteSpace: 'nowrap' }}>{row.rawVal}</span>
                          </div>
                          <div
                            style={{
                              width: '100%',
                              height: '10px',
                              borderRadius: '999px',
                              background: 'rgba(15, 23, 42, 0.07)',
                              overflow: 'hidden',
                            }}
                          >
                            <div
                              style={{
                                width: `${pctWidth}%`,
                                height: '100%',
                                borderRadius: '999px',
                                background: color,
                              }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                );
              }
            }

            return (
              <pre
                key={key}
                style={{
                  background: '#0f172a',
                  color: '#e2e8f0',
                  padding: '16px 18px',
                  borderRadius: '10px',
                  overflowX: 'auto',
                  fontSize: '13.5px',
                  lineHeight: 1.6,
                  margin: '16px 0',
                }}
              >
                <code className={block.lang ? `language-${block.lang}` : undefined}>
                  {block.code}
                </code>
              </pre>
            );
          }

          case 'hr':
            return (
              <hr
                key={key}
                style={{
                  border: 'none',
                  borderTop: '1px solid rgba(15, 23, 42, 0.1)',
                  margin: '24px 0',
                }}
              />
            );

          case 'heading': {
            const inlineChildren = renderInline(block.text, key);
            if (block.level === 1) {
              return (
                <h1
                  key={key}
                  style={{
                    fontSize: '1.65rem',
                    fontWeight: 800,
                    color: '#0f172a',
                    margin: '24px 0 12px',
                    lineHeight: 1.35,
                  }}
                >
                  {inlineChildren}
                </h1>
              );
            }
            if (block.level === 2) {
              return (
                <h2
                  key={key}
                  id={block.tocId}
                  style={{
                    scrollMarginTop: '96px',
                    fontSize: '1.35rem',
                    fontWeight: 700,
                    color: '#0f172a',
                    margin: '28px 0 12px',
                    paddingBottom: '8px',
                    borderBottom: '1px solid rgba(15, 23, 42, 0.08)',
                    lineHeight: 1.4,
                  }}
                >
                  {inlineChildren}
                </h2>
              );
            }
            if (block.level === 3) {
              return (
                <h3
                  key={key}
                  id={block.tocId}
                  style={{
                    scrollMarginTop: '96px',
                    fontSize: '1.12rem',
                    fontWeight: 700,
                    color: '#1e293b',
                    margin: '20px 0 8px',
                    lineHeight: 1.45,
                  }}
                >
                  {inlineChildren}
                </h3>
              );
            }
            return (
              <h4
                key={key}
                style={{
                  fontSize: '1rem',
                  fontWeight: 700,
                  color: '#334155',
                  margin: '16px 0 6px',
                  lineHeight: 1.5,
                }}
              >
                {inlineChildren}
              </h4>
            );
          }

          case 'image': {
            const safeUrl = sanitizeUrl(block.url);
            if (!safeUrl) return null;
            return (
              <figure key={key} style={{ margin: '18px 0', textAlign: 'center' }}>
                <img
                  src={safeUrl}
                  alt={block.alt}
                  loading="lazy"
                  decoding="async"
                  style={{
                    maxWidth: '100%',
                    height: 'auto',
                    borderRadius: '10px',
                    border: '1px solid rgba(15, 23, 42, 0.08)',
                  }}
                />
              </figure>
            );
          }

          case 'table':
            return (
              <div
                key={key}
                style={{
                  overflowX: 'auto',
                  margin: '18px 0',
                  borderRadius: '10px',
                  border: '1px solid rgba(15, 23, 42, 0.1)',
                }}
              >
                <table
                  style={{
                    width: '100%',
                    borderCollapse: 'collapse',
                    fontSize: '14px',
                    textAlign: 'left',
                    background: '#ffffff',
                  }}
                >
                  <thead>
                    <tr style={{ background: 'rgba(15, 23, 42, 0.04)' }}>
                      {block.headers.map((header, colIdx) => (
                        <th
                          key={`${key}-th-${colIdx}`}
                          style={{
                            padding: '10px 14px',
                            fontWeight: 700,
                            color: '#0f172a',
                            borderBottom: '1px solid rgba(15, 23, 42, 0.1)',
                            textAlign: block.alignments[colIdx] || 'left',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {renderInline(header, `${key}-th-${colIdx}`)}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {block.rows.map((row, rowIdx) => (
                      <tr
                        key={`${key}-tr-${rowIdx}`}
                        style={{
                          borderBottom:
                            rowIdx === block.rows.length - 1
                              ? 'none'
                              : '1px solid rgba(15, 23, 42, 0.06)',
                        }}
                      >
                        {block.headers.map((_, colIdx) => (
                          <td
                            key={`${key}-td-${rowIdx}-${colIdx}`}
                            style={{
                              padding: '10px 14px',
                              color: '#334155',
                              textAlign: block.alignments[colIdx] || 'left',
                              verticalAlign: 'top',
                            }}
                          >
                            {renderInline(row[colIdx] ?? '', `${key}-td-${rowIdx}-${colIdx}`)}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            );

          case 'blockquote': {
            const firstLine = (block.lines[0] || '').trim();
            const calloutMatch = firstLine.match(/^\[!(TIP|WARNING|IMPORTANT|NOTE)\]\s*(.*)$/i);
            if (calloutMatch) {
              const kind = calloutMatch[1].toUpperCase();
              const restFirst = calloutMatch[2].trim();
              const bodyLines = restFirst ? [restFirst, ...block.lines.slice(1)] : block.lines.slice(1);
              const calloutStyles: Record<
                string,
                { title: string; border: string; bg: string; titleColor: string }
              > = {
                TIP: {
                  title: '实战建议',
                  border: '#059669',
                  bg: 'rgba(5, 150, 105, 0.06)',
                  titleColor: '#047857',
                },
                WARNING: {
                  title: '避坑红线',
                  border: '#dc2626',
                  bg: 'rgba(220, 38, 38, 0.06)',
                  titleColor: '#b91c1c',
                },
                IMPORTANT: {
                  title: '核心商业洞察',
                  border: '#ff641e',
                  bg: 'rgba(255, 100, 30, 0.06)',
                  titleColor: '#c2410c',
                },
                NOTE: {
                  title: '背景说明',
                  border: '#2563eb',
                  bg: 'rgba(37, 99, 235, 0.06)',
                  titleColor: '#1d4ed8',
                },
              };
              const cs = calloutStyles[kind] || calloutStyles.NOTE;
              return (
                <div
                  key={key}
                  style={{
                    margin: '18px 0',
                    padding: '14px 18px',
                    borderLeft: `4px solid ${cs.border}`,
                    background: cs.bg,
                    borderRadius: '0 10px 10px 0',
                    color: '#1e293b',
                  }}
                >
                  <div
                    style={{
                      fontSize: '13px',
                      fontWeight: 800,
                      color: cs.titleColor,
                      marginBottom: '6px',
                      letterSpacing: '0.02em',
                    }}
                  >
                    {cs.title}
                  </div>
                  {bodyLines.map((qLine, qIdx) => (
                    <p key={`${key}-q-${qIdx}`} style={{ margin: qIdx === 0 ? 0 : '6px 0 0' }}>
                      {renderInline(qLine, `${key}-q-${qIdx}`)}
                    </p>
                  ))}
                </div>
              );
            }

            return (
              <blockquote
                key={key}
                style={{
                  margin: '16px 0',
                  padding: '12px 16px',
                  borderLeft: '4px solid #ff641e',
                  background: 'rgba(255, 100, 30, 0.05)',
                  borderRadius: '0 8px 8px 0',
                  color: '#334155',
                }}
              >
                {block.lines.map((qLine, qIdx) => (
                  <p key={`${key}-q-${qIdx}`} style={{ margin: qIdx === 0 ? 0 : '6px 0 0' }}>
                    {renderInline(qLine, `${key}-q-${qIdx}`)}
                  </p>
                ))}
              </blockquote>
            );
          }

          case 'list': {
            const listStyle: React.CSSProperties = {
              margin: '12px 0',
              paddingLeft: '24px',
            };
            const listItems = block.items.map((item, itemIdx) => (
              <li key={`${key}-li-${itemIdx}`} style={{ margin: '4px 0' }}>
                {renderInline(item, `${key}-li-${itemIdx}`)}
              </li>
            ));
            return block.ordered ? (
              <ol key={key} style={listStyle}>
                {listItems}
              </ol>
            ) : (
              <ul key={key} style={listStyle}>
                {listItems}
              </ul>
            );
          }

          case 'paragraph':
            return (
              <p key={key} style={{ margin: '12px 0' }}>
                {renderInline(block.text, key)}
              </p>
            );
        }
      })}
    </div>
  );
}
