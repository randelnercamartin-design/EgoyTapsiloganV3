// api/config.js — Business config
// GET  /api/config             → fetch all config (public)
// POST /api/config             → save config fields (admin)
// POST /api/config?type=image  → upload logo/QR as base64 (admin)

const { getPool }               = require('./_db');
const { requireAdmin, setCors } = require('./_auth');

module.exports = async (req, res) => {
  setCors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();

  const pool = getPool();

  // ===== GET — Public =====
  if (req.method === 'GET') {
    try {
      const result = await pool.query('SELECT key, value FROM business_config');
      const config = {};
      result.rows.forEach(row => { config[row.key] = row.value; });
      return res.status(200).json(config);
    } catch (err) {
      console.error('Config GET error:', err);
      return res.status(500).json({ error: 'Server error' });
    }
  }

  // ===== POST — Admin only =====
  if (req.method === 'POST') {
    const admin = requireAdmin(req, res);
    if (!admin) return;

    const { type } = req.query;

    // Image upload (logo, gcash_qr, maya_qr) — sent as base64 data URL
    if (type === 'image') {
      const { image_url, image_type } = req.body || {};
      if (!image_url || !image_type)
        return res.status(400).json({ error: 'image_url and image_type required' });

      try {
        const mimeMatch = image_url.match(/^data:([^;]+);base64,/);
        const mime = mimeMatch ? mimeMatch[1] : 'image/jpeg';

        await pool.query(
          `INSERT INTO uploaded_images (type, filename, data, mime_type)
           VALUES ($1, $2, $3, $4)`,
          [image_type, `${image_type}_${Date.now()}`, image_url, mime]
        );

        // Also store as config key so it loads everywhere
        await pool.query(
          `INSERT INTO business_config (key, value, updated_at)
           VALUES ($1, $2, NOW())
           ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()`,
          [`img_${image_type}`, image_url]
        );

        return res.status(200).json({ url: image_url });
      } catch (err) {
        console.error('Config image error:', err);
        return res.status(500).json({ error: 'Server error' });
      }
    }

    // Save text config fields
    const updates = req.body || {};
    if (!Object.keys(updates).length)
      return res.status(400).json({ error: 'No fields provided' });

    try {
      for (const [key, value] of Object.entries(updates)) {
        await pool.query(
          `INSERT INTO business_config (key, value, updated_at)
           VALUES ($1, $2, NOW())
           ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()`,
          [key, value]
        );
      }
      return res.status(200).json({ success: true });
    } catch (err) {
      console.error('Config POST error:', err);
      return res.status(500).json({ error: 'Server error' });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
};
