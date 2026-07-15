import { NextResponse } from 'next/server';

const SESSION_COOKIE = 'admin_session';

// The whole app is a single admin tool (no public storefront), so
// everything requires a session except the login page/route itself and the
// cron endpoint, which is authenticated separately via CRON_SECRET.
export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};

export async function middleware(req) {
  const { pathname } = req.nextUrl;

  if (pathname === '/login' || pathname === '/api/login' || pathname.startsWith('/api/cron/')) {
    return NextResponse.next();
  }

  const token = req.cookies.get(SESSION_COOKIE)?.value;
  const valid = token ? await verifySession(token) : false;

  if (valid) return NextResponse.next();

  if (pathname.startsWith('/api/')) {
    return NextResponse.json({ error: 'Not authenticated.' }, { status: 401 });
  }

  const loginUrl = new URL('/login', req.url);
  return NextResponse.redirect(loginUrl);
}

async function verifySession(token) {
  const KV_URL = process.env.KV_REST_API_URL;
  const KV_TOKEN = process.env.KV_REST_API_TOKEN;
  if (!KV_URL || !KV_TOKEN) return false;
  try {
    const res = await fetch(`${KV_URL}/get/admin_session:${token}`, {
      headers: { Authorization: `Bearer ${KV_TOKEN}` },
    });
    const data = await res.json();
    return Boolean(data.result);
  } catch {
    return false;
  }
}
