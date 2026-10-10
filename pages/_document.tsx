import { Html, Head, Main, NextScript } from 'next/document';

export default function Document() {
  return (
    <Html lang="zh-CN">
      <Head>
        {/* 搜索引擎站长平台所有权验证 Meta */}
        <meta name="baidu-site-verification" content="codeva-f5tW4LkOnX" />
        <meta name="google-site-verification" content="Zc_oto1WeXeyLsH7pP1F0HelY1dWT0EUPMIEHZcbtEY" />

        {/* 系统原生字体栈加速，杜绝境外 CDN 导致的 30 秒白屏渲染阻塞 */}
        
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
