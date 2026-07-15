import React from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';
import { T, S } from '../lib/theme';

export default function Login() {
  const router = useRouter();
  const [password, setPassword] = React.useState('');
  const [error, setError] = React.useState('');
  const [busy, setBusy] = React.useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const res = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      });
      if (!res.ok) {
        const data = await res.json();
        setError(data.error || 'Login failed.');
        return;
      }
      router.push('/');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: T.bg, padding: 16 }}>
      <Head><title>Sign in — Prettys Brands Ads</title></Head>
      <form onSubmit={handleSubmit} style={{ ...S.card, width: '100%', maxWidth: 340 }}>
        <p style={{ ...S.label, marginBottom: 10 }}>Prettys Brands Ads</p>
        <p style={{ fontFamily: T.sans, fontSize: 30, fontWeight: 400, margin: '0 0 20px' }}>
          Sign <span style={S.accent1}>in</span>.
        </p>
        <input
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          style={{ ...S.input, marginBottom: 12 }}
          autoFocus
          required
        />
        {error && <p style={{ color: T.warn, fontSize: 13, marginBottom: 12 }}>{error}</p>}
        <button type="submit" disabled={busy} style={{ ...S.btnFill, width: '100%', opacity: busy ? 0.6 : 1 }}>
          {busy ? 'Signing in…' : 'Continue'} {!busy && '→'}
        </button>
      </form>
    </div>
  );
}
