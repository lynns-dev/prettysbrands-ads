// Relays one binary chunk of a video upload to Meta's resumable-upload
// "transfer" phase. bodyParser is disabled so the raw bytes can be read
// directly off the request stream instead of being JSON-decoded — the
// client sends each chunk as a plain octet-stream body, with the upload
// session id and byte offset carried in headers instead of the body.

import { getBrand } from '../../../../../../lib/brandsStore';
import { transferVideoChunk } from '../../../../../../lib/metaMarketingApi';
import { withAuth } from '../../../../../../lib/requireAuth';

export const config = { api: { bodyParser: false } };

function readRawBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', (c) => chunks.push(c));
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const brand = await getBrand(req.query.id);
  if (!brand) return res.status(404).json({ error: 'Brand not found.' });

  const uploadSessionId = req.headers['x-upload-session-id'];
  const startOffset = Number(req.headers['x-start-offset']);
  if (!uploadSessionId || Number.isNaN(startOffset)) {
    return res.status(400).json({ error: 'Missing x-upload-session-id / x-start-offset headers.' });
  }

  try {
    const chunk = await readRawBody(req);
    const result = await transferVideoChunk(brand.adAccountId, { uploadSessionId, startOffset, chunk });
    return res.status(200).json(result);
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }
}

export default withAuth(handler);
