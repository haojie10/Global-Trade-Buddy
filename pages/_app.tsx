import '../styles/globals.css';
import '../styles/admin.css';
import type { AppProps } from 'next/app';
import { Outfit, Playfair_Display } from 'next/font/google';
import BackgroundGraph from '../components/BackgroundGraph';
import { useRouter } from 'next/router';
import Head from 'next/head';

const outfit = Outfit({
  subsets: ['latin'],
  weight: ['300', '400', '500', '600'],
  variable: '--font-outfit',
  display: 'swap',
});

const playfair = Playfair_Display({
  subsets: ['latin'],
  weight: ['400', '600'],
  style: ['normal', 'italic'],
  variable: '--font-playfair',
  display: 'swap',
});

export default function App({ Component, pageProps }: AppProps) {
  const router = useRouter();
  const isAdmin = router.pathname.startsWith('/admin');

  return (
    <div className={`${outfit.variable} ${playfair.variable}`}>
      <Head>
        <title>Market Graphic - 俯瞰全球市场</title>
      </Head>
      {!isAdmin && <BackgroundGraph />}
      <Component {...pageProps} />
    </div>
  );
}
