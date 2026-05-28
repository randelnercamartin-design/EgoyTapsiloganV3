// api/menu.js — Menu CRUD
// GET    /api/menu?category=all        → list all active items
// POST   /api/menu                     → add item (admin)
// PUT    /api/menu?id=X                → update item (admin)
// DELETE /api/menu?id=X                → soft-delete item (admin)

const { getPool }       = require('./_db');
const { requireAdmin, setCors } = require('./_auth');

module.exports = async (req, res) => {
  setCors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();

  const pool = getPool();

  // ===== GET — Public =====
  if (req.method === 'GET') {
    try {
      const { category } = req.query;
      let query  = 'SELECT * FROM menu_items WHERE is_active = TRUE';
      const params = [];
      if (category && category !== 'all') {
        params.push(category);
        query += ` AND category = $${params.length}`;
      }
      query += ' ORDER BY id ASC';
      const result = await pool.query(query, params);
      return res.status(200).json(result.rows);
    } catch (err) {
      console.error('Menu GET error:', err);
      return res.status(500).json({ error: 'Server error' });
    }
  }

  // ===== POST — Admin only =====
  if (req.method === 'POST') {
    const admin = requireAdmin(req, res);
    if (!admin) return;
    const { name, category, price, description, emoji } = req.body || {};
    if (!name || !price) return res.status(400).json({ error: 'Name and price required' });
    try {
      const result = await pool.query(
        `INSERT INTO menu_items (name, category, price, description, emoji)
         VALUES ($1,$2,$3,$4,$5) RETURNING *`,
        [name, category || 'tapsilog', parseInt(price), description || '', emoji || '🍽️']
      );
      return res.status(201).json(result.rows[0]);
    } catch (err) {
      console.error('Menu POST error:', err);
      return res.status(500).json({ error: 'Server error' });
    }
  }

  // ===== PUT — Admin only =====
  if (req.method === 'PUT') {
    const admin = requireAdmin(req, res);
    if (!admin) return;
    const { id } = req.query;
    if (!id) return res.status(400).json({ error: 'Item ID required' });
    const { name, category, price, description, emoji, image_url } = req.body || {};
    try {
      const result = await pool.query(
        `UPDATE menu_items
         SET name=$1, category=$2, price=$3, description=$4, emoji=$5,
             image_url=COALESCE($6, image_url), updated_at=NOW()
         WHERE id=$7 RETURNING *`,
        [name, category, parseInt(price), description, emoji, image_url || null, id]
      );
      if (!result.rows.length) return res.status(404).json({ error: 'Item not found' });
      return res.status(200).json(result.rows[0]);
    } catch (err) {
      console.error('Menu PUT error:', err);
      return res.status(500).json({ error: 'Server error' });
    }
  }

  // ===== DELETE — Admin only =====
  if (req.method === 'DELETE') {
    const admin = requireAdmin(req, res);
    if (!admin) return;
    const { id } = req.query;
    if (!id) return res.status(400).json({ error: 'Item ID required' });
    try {
      await pool.query('UPDATE menu_items SET is_active=FALSE WHERE id=$1', [id]);
      return res.status(200).json({ success: true });
    } catch (err) {
      console.error('Menu DELETE error:', err);
      return res.status(500).json({ error: 'Server error' });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
};
