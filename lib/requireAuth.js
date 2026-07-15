// API-route auth guard. This used to live in Edge middleware, but the KV
// layer now talks to Redis over a raw TCP connection (lib/kv.js, via
// ioredis) which Edge Runtime can't open — only regular Node.js serverless
// functions can, so the session check has to happen per-route instead.
// Pages get the equivalent guard via getServerSideProps (see pages/index.jsx,
// pages/brand/[id].jsx).

import { verifySession, SESSION_COOKIE } from './adminAuth';

export function withAuth(handler, { redirectToLogin = false } = {}) {
  return async (req, res) => {
    const token = req.cookies?.[SESSION_COOKIE];
    const valid = await verifySession(token).catch(() => false);
    if (!valid) {
      if (redirectToLogin) {
        res.writeHead(302, { Location: '/login' });
        return res.end();
      }
      return res.status(401).json({ error: 'Not authenticated.' });
    }
    return handler(req, res);
  };
}
