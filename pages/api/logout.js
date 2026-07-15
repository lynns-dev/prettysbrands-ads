import { deleteSession, SESSION_COOKIE } from '../../lib/adminAuth';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const token = req.cookies?.[SESSION_COOKIE];
  await deleteSession(token).catch(() => {});
  res.setHeader('Set-Cookie', `${SESSION_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`);
  return res.status(200).json({ ok: true });
}
