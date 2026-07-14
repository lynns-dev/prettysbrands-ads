import { getReviews, deleteReview, approveReview } from '../../../lib/reviewsStore';
import { PRODUCTS } from '../../../lib/products';

export default async function handler(req, res) {
  if (req.method === 'GET') {
    try {
      const entries = await Promise.all(
        PRODUCTS.map(async (p) => {
          const reviews = await getReviews(p.id);
          return reviews.map((r) => ({ ...r, productId: p.id, productName: p.name }));
        })
      );
      const all = entries.flat().sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
      return res.status(200).json({ reviews: all });
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  }

  if (req.method === 'PATCH') {
    const { productId, reviewId, action } = req.body || {};
    if (!productId || !reviewId || action !== 'approve') {
      return res.status(400).json({ error: 'productId, reviewId, and action: "approve" are required.' });
    }
    try {
      await approveReview(productId, reviewId);
      return res.status(200).json({ ok: true });
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  }

  if (req.method === 'DELETE') {
    const { productId, reviewId } = req.body || {};
    if (!productId || !reviewId) {
      return res.status(400).json({ error: 'productId and reviewId are required.' });
    }
    try {
      await deleteReview(productId, reviewId);
      return res.status(200).json({ ok: true });
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  }

  res.setHeader('Allow', 'GET, PATCH, DELETE');
  return res.status(405).json({ error: 'Method not allowed' });
}
