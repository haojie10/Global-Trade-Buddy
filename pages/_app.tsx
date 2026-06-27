import '../styles/globals.css';
import type { AppProps } from 'next/app';
import { Outfit, Playfair_Display } from 'next/font/google';

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
  return (
    <div className={`${outfit.variable} ${playfair.variable}`}>
      <Component {...pageProps} />
    </div>
  );
}
