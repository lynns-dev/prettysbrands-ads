import { checkPassword, createSession, SESSION_COOKIE, SESSION_TTL_SECONDS } from '../../lib/adminAuth';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    if (!checkPassword(req.body?.password)) {
      return res.status(401).json({ error: 'Incorrect password.' });
    }
    const token = await createSession();
    res.setHeader('Set-Cookie', `${SESSION_COOKIE}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${SESSION_TTL_SECONDS}${process.env.NODE_ENV === 'production' ? '; Secure' : ''}`);
    return res.status(200).json({ ok: true });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
