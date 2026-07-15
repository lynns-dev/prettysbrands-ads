import { saveSubscription, removeSubscription } from '../../../lib/webPush';
import { withAuth } from '../../../lib/requireAuth';

async function handler(req, res) {
  if (req.method === 'POST') {
    if (!req.body?.endpoint) return res.status(400).json({ error: 'Missing subscription.' });
    await saveSubscription(req.body);
    return res.status(200).json({ ok: true });
  }
  if (req.method === 'DELETE') {
    if (!req.body?.endpoint) return res.status(400).json({ error: 'Missing endpoint.' });
    await removeSubscription(req.body.endpoint);
    return res.status(200).json({ ok: true });
  }
  res.setHeader('Allow', 'POST, DELETE');
  return res.status(405).json({ error: 'Method not allowed' });
}

export default withAuth(handler);
