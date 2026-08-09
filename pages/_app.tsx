import '../styles/globals.css';
import '../styles/admin.css';
import type { AppProps } from 'next/app';
import BackgroundGraph from '../components/BackgroundGraph';
import { useRouter } from 'next/router';
import Head from 'next/head';

export default function App({ Component, pageProps }: AppProps) {
  const router = useRouter();
  const isAdmin = router.pathname.startsWith('/admin');

  return (
    <div>
      <Head>
        <title>Market Graphic - 俯瞰全球市场</title>
      </Head>
      {!isAdmin && <BackgroundGraph />}
      <Component {...pageProps} />
    </div>
  );
}
