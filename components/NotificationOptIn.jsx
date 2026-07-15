// One-time opt-in control for phone push notifications (pacing alerts).
// Not tied to any single brand — one subscription covers alerts for every
// brand, so this lives in the dashboard header rather than a brand page.
import React from 'react';
import { S, T } from '../lib/theme';

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = atob(base64);
  return Uint8Array.from([...rawData].map((c) => c.charCodeAt(0)));
}

export default function NotificationOptIn() {
  const [status, setStatus] = React.useState('checking');
  const [busy, setBusy] = React.useState(false);

  React.useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!('serviceWorker' in navigator) || !('PushManager' in window) || !process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY) {
      setStatus('unsupported');
      return;
    }
    if (Notification.permission === 'denied') {
      setStatus('denied');
      return;
    }
    navigator.serviceWorker.register('/sw.js')
      .then((reg) => reg.pushManager.getSubscription())
      .then((sub) => setStatus(sub ? 'on' : 'off'))
      .catch(() => setStatus('unsupported'));
  }, []);

  const enable = async () => {
    setBusy(true);
    try {
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') {
        setStatus('denied');
        return;
      }
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY),
      });
      await fetch('/api/push/subscribe', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(sub),
      });
      setStatus('on');
    } finally {
      setBusy(false);
    }
  };

  const disable = async () => {
    setBusy(true);
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        await fetch('/api/push/subscribe', {
          method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ endpoint: sub.endpoint }),
        });
        await sub.unsubscribe();
      }
      setStatus('off');
    } finally {
      setBusy(false);
    }
  };

  if (status === 'checking' || status === 'unsupported') return null;

  if (status === 'denied') {
    return <p style={{ fontSize: 12, color: T.soft }}>Notifications blocked in this browser — allow them in site settings for pacing alerts on this device.</p>;
  }

  return (
    <button onClick={status === 'on' ? disable : enable} disabled={busy} style={{ ...S.btnOutline, opacity: busy ? 0.6 : 1 }}>
      {busy ? 'Working…' : status === 'on' ? 'Notifications on ✓' : 'Enable phone notifications →'}
    </button>
  );
}
