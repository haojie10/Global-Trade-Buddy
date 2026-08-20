import { Html, Head, Main, NextScript } from 'next/document';

export default function Document() {
  return (
    <Html lang="zh-CN">
      <Head>
        {/* 搜索引擎站长平台所有权验证 Meta */}
        <meta name="baidu-site-verification" content={process.env.NEXT_PUBLIC_BAIDU_SITE_VERIFICATION || "code-verification"} />
        <meta name="google-site-verification" content="google0eb32fd071eb9e70" />

        {/* 高性能字体预连接与跨源加速 (font-display: swap 保障 0 渲染阻塞与原生视觉完全一致) */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&family=Playfair+Display:ital,wght@0,400..700;1,400..700&display=swap" rel="stylesheet" />
        
        <link rel="icon" href="/favicon.ico?v=3" sizes="any" />
        <link rel="icon" type="image/png" sizes="32x32" href="/favicon-32x32.png?v=3" />
        <link rel="icon" type="image/png" sizes="16x16" href="/favicon-16x16.png?v=3" />
        <link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png?v=3" />
        <meta name="theme-color" content="#ff641e" />
      </Head>
      <body>
        <Main />
        <NextScript />
      </body>
    </Html>
  );
}
