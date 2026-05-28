// api/menu-image.js — Upload image for a menu item
// POST /api/menu-image?id=X   body: { image_url: 'data:image/...' }
// (Vercel doesn't support multipart in serverless easily, so we accept base64 data URL from frontend)

const { getPool }              = require('./_db');
const { requireAdmin, setCors } = require('./_auth');

module.exports = async (req, res) => {
  setCors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });

  const admin = requireAdmin(req, res);
  if (!admin) return;

  const { id } = req.query;
  const { image_url } = req.body || {};

  if (!id)        return res.status(400).json({ error: 'Item ID required' });
  if (!image_url) return res.status(400).json({ error: 'image_url required (base64 data URL)' });

  const pool = getPool();
  try {
    // Save to uploaded_images for record-keeping
    const mimeMatch = image_url.match(/^data:([^;]+);base64,/);
    const mime = mimeMatch ? mimeMatch[1] : 'image/jpeg';

    await pool.query(
      `INSERT INTO uploaded_images (type, filename, data, mime_type)
       VALUES ('menu_item', $1, $2, $3)`,
      [`item_${id}_${Date.now()}`, image_url, mime]
    );

    // Update the menu item image_url
    await pool.query(
      'UPDATE menu_items SET image_url=$1, updated_at=NOW() WHERE id=$2',
      [image_url, id]
    );

    return res.status(200).json({ image_url });
  } catch (err) {
    console.error('Menu image error:', err);
    return res.status(500).json({ error: 'Server error' });
  }
};
