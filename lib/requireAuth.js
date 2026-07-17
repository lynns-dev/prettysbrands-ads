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

// Same guard, but also accepts a static bearer token (DRAFTS_API_KEY) as an
// alternative to the browser session cookie — for external callers that
// can't hold a login session (a script, a Shortcut, an agent creating
// drafts on the operator's behalf). Deliberately scoped to draft-creation
// routes only (asset upload + save-draft) — publishing, settings, and
// everything else stays cookie-only, so "someone/something filled in a
// draft for me" can never itself mean "and it went live."
export function withAuthOrApiKey(handler) {
  return async (req, res) => {
    const apiKey = process.env.DRAFTS_API_KEY;
    const authHeader = req.headers.authorization || '';
    if (apiKey && authHeader === `Bearer ${apiKey}`) {
      return handler(req, res);
    }
    const token = req.cookies?.[SESSION_COOKIE];
    const valid = await verifySession(token).catch(() => false);
    if (!valid) return res.status(401).json({ error: 'Not authenticated.' });
    return handler(req, res);
  };
}

