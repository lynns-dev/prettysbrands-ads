import { T } from '../lib/theme';

export default function App({ Component, pageProps }) {
  return (
    <div style={{ fontFamily: T.sans, color: T.ink, background: T.bg, minHeight: '100vh' }}>
      <Component {...pageProps} />
    </div>
  );
}
