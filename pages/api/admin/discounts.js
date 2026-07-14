import { getDiscounts, addDiscount, removeDiscount } from '../../../lib/discountsStore';

export default async function handler(req, res) {
  if (req.method === 'GET') {
    try {
      const discounts = await getDiscounts();
      return res.status(200).json({ discounts });
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  }

  if (req.method === 'POST') {
    const { code, type, value } = req.body || {};
    if (!code || !code.trim()) return res.status(400).json({ error: 'Code is required.' });
    if (type !== 'percent' && type !== 'fixed') return res.status(400).json({ error: 'Type must be "percent" or "fixed".' });
    const numericValue = Number(value);
    if (!numericValue || numericValue <= 0) return res.status(400).json({ error: 'Value must be a positive number.' });

    try {
      const discounts = await addDiscount({ code: code.trim().toUpperCase(), type, value: numericValue });
      return res.status(200).json({ discounts });
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  }

  if (req.method === 'DELETE') {
    const { code } = req.body || {};
    if (!code) return res.status(400).json({ error: 'Code is required.' });
    try {
      const discounts = await removeDiscount(code);
      return res.status(200).json({ discounts });
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  }

  res.setHeader('Allow', 'GET, POST, DELETE');
  return res.status(405).json({ error: 'Method not allowed' });
}
