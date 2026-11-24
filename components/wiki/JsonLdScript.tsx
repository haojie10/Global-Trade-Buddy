import React from 'react';
import Head from 'next/head';

/**
 * 将结构化 JSON-LD 对象安全序列化为脚本内容
 * 转义 <、> 与 U+2028/U+2029 行分隔符，彻底防止 </script> 闭合注入与行分隔符逃逸
 * @param data JSON-LD 结构化数据对象
 * @returns 经安全转义的 JSON 字符串
 */
export function serializeJsonLd(data: Record<string, unknown>): string {
  return (JSON.stringify(data) ?? '{}')
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e')
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029');
}

/**
 * 行业百科专职 JSON-LD 结构化数据输出组件
 * @remarks 组件内部已包裹 next/head 的 <Head>，调用方必须将其作为 <Head> 的兄弟节点渲染，切勿嵌套在 <Head> 内。
 * NOTE: 仅此专职序列化组件因 React 18 对 <script> 文本节点双引号会转义为 &quot; 的限制，
 * 在受控调用 serializeJsonLd 完成安全转义后，通过 Head 输出 application/ld+json。
 */
export default function JsonLdScript({ data }: { data: Record<string, unknown> }) {
  const serialized = serializeJsonLd(data);
  return (
    <Head>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: serialized }}
      />
    </Head>
  );
}
