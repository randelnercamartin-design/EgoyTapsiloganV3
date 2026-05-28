// api/auth.js — Login & Register
// Handles: POST /api/auth  (body: { action: 'login'|'register', ... })

const bcrypt  = require('bcryptjs');
const { getPool } = require('./_db');
const { signToken, setCors } = require('./_auth');

module.exports = async (req, res) => {
  setCors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();

  const pool = getPool();
  const { action, email, password, full_name, phone } = req.body || {};

  // ===== LOGIN =====
  if (action === 'login') {
    if (!email || !password)
      return res.status(400).json({ error: 'Email and password required' });

    try {
      const result = await pool.query('SELECT * FROM users WHERE email = $1', [email.toLowerCase()]);
      const user = result.rows[0];
      if (!user) return res.status(401).json({ error: 'Invalid email or password' });

      const valid = await bcrypt.compare(password, user.password_hash);
      if (!valid) return res.status(401).json({ error: 'Invalid email or password' });

      const token = signToken({
        id: user.id, email: user.email,
        role: user.role, name: user.full_name, av: user.avatar
      });

      return res.status(200).json({
        token,
        user: { id: user.id, email: user.email, name: user.full_name, role: user.role, av: user.avatar }
      });
    } catch (err) {
      console.error('Login error:', err);
      return res.status(500).json({ error: 'Server error' });
    }
  }

  // ===== REGISTER =====
  if (action === 'register') {
    if (!email || !password || !full_name)
      return res.status(400).json({ error: 'Name, email, and password required' });
    if (password.length < 8)
      return res.status(400).json({ error: 'Password must be at least 8 characters' });

    try {
      const exists = await pool.query('SELECT id FROM users WHERE email = $1', [email.toLowerCase()]);
      if (exists.rows.length) return res.status(409).json({ error: 'Email already registered' });

      const hash     = await bcrypt.hash(password, 10);
      const initials = full_name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);

      const result = await pool.query(
        `INSERT INTO users (email, password_hash, full_name, phone, role, avatar)
         VALUES ($1,$2,$3,$4,'customer',$5)
         RETURNING id, email, full_name, role, avatar`,
        [email.toLowerCase(), hash, full_name, phone || '', initials]
      );
      const user = result.rows[0];

      const token = signToken({
        id: user.id, email: user.email,
        role: user.role, name: user.full_name, av: user.avatar
      });

      return res.status(201).json({
        token,
        user: { id: user.id, email: user.email, name: user.full_name, role: user.role, av: user.avatar }
      });
    } catch (err) {
      console.error('Register error:', err);
      return res.status(500).json({ error: 'Server error' });
    }
  }

  return res.status(400).json({ error: 'Invalid action. Use login or register.' });
};
