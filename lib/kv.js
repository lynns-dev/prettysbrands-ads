// Thin helper over a standard Redis connection (Redis Cloud, or any other
// provider that hands you a redis:// / rediss:// URL), shared by every
// store in this app (sessions, brand configs, the Meta token, adjustment
// logs). Uses ioredis rather than a REST API, so this can only be imported
// from Node.js runtime code (regular pages/API routes) — never from Edge
// middleware, which can't open raw TCP sockets.

import Redis from 'ioredis';

let client = null;

function getClient() {
  const url = process.env.REDIS_URL;
  if (!url) {
    throw new Error('REDIS_URL is not set — provision a Redis database and set its connection string.');
  }
  // Cached at module scope so a warm serverless invocation reuses the same
  // connection instead of opening a new one per request.
  if (!client) {
    client = new Redis(url, { maxRetriesPerRequest: 3 });
  }
  return client;
}

export async function kvGetJson(key, fallback = null) {
  const raw = await getClient().get(key);
  return raw ? JSON.parse(raw) : fallback;
}

export async function kvSetJson(key, value) {
  await getClient().set(key, JSON.stringify(value));
}

export async function kvGetRaw(key) {
  const raw = await getClient().get(key);
  return raw ?? null;
}

export async function kvSetRaw(key, value, { exSeconds } = {}) {
  if (exSeconds) {
    await getClient().set(key, value, 'EX', exSeconds);
  } else {
    await getClient().set(key, value);
  }
}

export async function kvDel(key) {
  await getClient().del(key);
}
