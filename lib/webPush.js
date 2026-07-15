// Server-side Web Push sending, wrapping the `web-push` library with this
// app's VAPID key pair. There's one admin user but potentially several
// devices/browsers opted in, so subscriptions are stored as a small list in
// Redis and pruned automatically once a push service reports one as
// gone (404/410 — the user uninstalled, cleared data, or revoked permission).

import webpush from 'web-push';
import { kvGetJson, kvSetJson } from './kv';

const SUBS_KEY = 'push-subscriptions';

function configure() {
  const { VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT } = process.env;
  if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) {
    throw new Error('VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY are not set.');
  }
  webpush.setVapidDetails(VAPID_SUBJECT || 'mailto:admin@example.com', VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
}

export async function saveSubscription(subscription) {
  const subs = await kvGetJson(SUBS_KEY, []);
  if (!subs.some((s) => s.endpoint === subscription.endpoint)) {
    subs.push(subscription);
    await kvSetJson(SUBS_KEY, subs);
  }
}

export async function removeSubscription(endpoint) {
  const subs = await kvGetJson(SUBS_KEY, []);
  await kvSetJson(SUBS_KEY, subs.filter((s) => s.endpoint !== endpoint));
}

// Sends to every registered subscription — with one admin user this means
// "every device that's opted in." Returns how many actually went through so
// callers/logs can tell a silent no-op (nobody's subscribed yet) from a send.
export async function sendPushToAll(payload) {
  if (!process.env.VAPID_PUBLIC_KEY || !process.env.VAPID_PRIVATE_KEY) return { sent: 0 };
  const subs = await kvGetJson(SUBS_KEY, []);
  if (subs.length === 0) return { sent: 0 };
  configure();

  const body = JSON.stringify(payload);
  let sent = 0;
  const stale = [];
  await Promise.all(subs.map(async (sub) => {
    try {
      await webpush.sendNotification(sub, body);
      sent += 1;
    } catch (err) {
      if (err.statusCode === 404 || err.statusCode === 410) stale.push(sub.endpoint);
    }
  }));

  if (stale.length > 0) {
    const remaining = subs.filter((s) => !stale.includes(s.endpoint));
    await kvSetJson(SUBS_KEY, remaining);
  }
  return { sent };
}
