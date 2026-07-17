import { getBrand } from '../../../../../../lib/brandsStore';
import { deleteDraft } from '../../../../../../lib/creativeDraftStore';
import { withAuth } from '../../../../../../lib/requireAuth';

async function handler(req, res) {
  if (req.method !== 'DELETE') {
    res.setHeader('Allow', 'DELETE');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const brand = await getBrand(req.query.id);
  if (!brand) return res.status(404).json({ error: 'Brand not found.' });

  const drafts = await deleteDraft(brand.id, req.query.draftId);
  return res.status(200).json({ drafts });
}

export default withAuth(handler);
