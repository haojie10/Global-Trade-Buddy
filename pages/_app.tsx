import '../styles/globals.css';
import '../styles/admin.css';
import type { AppProps } from 'next/app';
import BackgroundGraph from '../components/BackgroundGraph';
import ErrorBoundary from '../components/ErrorBoundary';
import { useRouter } from 'next/router';
import Head from 'next/head';

export default function App({ Component, pageProps }: AppProps) {
  const router = useRouter();
  const isAdmin = router.pathname.startsWith('/admin');

  return (
    <ErrorBoundary>
      <div>
        <Head>
          <title>Market Graphic - 俯瞰全球市场结构</title>
          <meta name="viewport" content="width=device-width, initial-scale=1.0" />
          <link rel="icon" href="/favicon.ico" sizes="any" />
          <link rel="icon" type="image/png" sizes="32x32" href="/favicon-32x32.png" />
          <link rel="icon" type="image/png" sizes="16x16" href="/favicon-16x16.png" />
          <link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png" />
        </Head>
        {!isAdmin && <BackgroundGraph />}
        <Component {...pageProps} />
      </div>
    </ErrorBoundary>
  );
}

