import Head from 'next/head';
import '../styles/globals.css';
import { T } from '../lib/theme';

export default function App({ Component, pageProps }) {
  return (
    <div style={{ fontFamily: T.sans, color: T.ink, background: T.bg, minHeight: '100vh' }}>
      <Head>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>
      <Component {...pageProps} />
    </div>
  );
}
