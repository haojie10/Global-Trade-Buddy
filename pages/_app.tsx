import '../styles/globals.css';
import '../styles/admin.css';
import type { AppProps } from 'next/app';
import BackgroundGraph from '../components/BackgroundGraph';
import ErrorBoundary from '../components/ErrorBoundary';
import Footer from '../components/Footer';
import { useRouter } from 'next/router';
import Head from 'next/head';

export default function App({ Component, pageProps }: AppProps) {
  const router = useRouter();
  const isAdmin = router.pathname.startsWith('/admin');
  const noFooterPages = ['/', '/my-graph'];
  const showFooter = !isAdmin && !noFooterPages.includes(router.pathname);

  return (
    <ErrorBoundary>
      <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
        <Head>
          <title>Market Graphic (外贸智友) - 俯瞰全球市场结构</title>
          <meta name="viewport" content="width=device-width, initial-scale=1.0" />
          <link rel="icon" href="/favicon.ico?v=3" sizes="any" />
          <link rel="icon" type="image/png" sizes="32x32" href="/favicon-32x32.png?v=3" />
          <link rel="icon" type="image/png" sizes="16x16" href="/favicon-16x16.png?v=3" />
          <link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png?v=3" />
        </Head>
        {!isAdmin && <BackgroundGraph />}
        <div style={{ flex: '1 0 auto' }}>
          <Component {...pageProps} />
        </div>
        {showFooter && <Footer />}
      </div>
    </ErrorBoundary>
  );
}

