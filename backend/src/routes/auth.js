const router = require('express').Router();
const bcrypt = require('bcryptjs');
const { z } = require('zod');
const db = require('../config/db');
const { setAuthCookie, clearAuthCookie, requireAuth } = require('../utils/auth');

const registerSchema = z.object({
  name: z.string().trim().min(2).max(100),
  email: z.string().trim().toLowerCase().email().max(254),
  phone: z.string().trim().min(7).max(20).regex(/^[0-9+\-\s()]+$/, 'Invalid phone number'),
  password: z.string().min(8).max(128),
});

const loginSchema = z.object({
  email: z.string().trim().toLowerCase().max(254),
  password: z.string().max(128),
});

// Used when the email is unknown, so failed logins take the same time either way.
const DUMMY_HASH = bcrypt.hashSync('timing-equalizer-not-a-real-password', 12);

router.post('/register', async (req, res, next) => {
  try {
    const data = registerSchema.parse(req.body);
    const hash = await bcrypt.hash(data.password, 12);
    const result = await db.query(
      `INSERT INTO users(full_name, email, phone, password_hash, role)
       VALUES ($1, $2, $3, $4, 'customer')
       RETURNING id, full_name, email, phone, role`,
      [data.name, data.email, data.phone, hash],
    );
    const user = result.rows[0];
    setAuthCookie(res, user);
    res.status(201).json({ user });
  } catch (error) {
    if (error.code === '23505') return res.status(409).json({ error: 'An account with this email already exists' });
    next(error);
  }
});

router.post('/login', async (req, res, next) => {
  try {
    const { email, password } = loginSchema.parse(req.body);
    const result = await db.query('SELECT id, full_name, email, phone, password_hash, role FROM users WHERE email = $1', [email]);
    const user = result.rows[0];
    const ok = await bcrypt.compare(password, user ? user.password_hash : DUMMY_HASH);
    if (!user || !ok) return res.status(401).json({ error: 'Invalid email or password' });
    delete user.password_hash;
    setAuthCookie(res, user);
    res.json({ user });
  } catch (error) {
    next(error);
  }
});

router.post('/logout', (req, res) => {
  clearAuthCookie(res);
  res.status(204).end();
});

router.get('/me', requireAuth, async (req, res, next) => {
  try {
    const result = await db.query('SELECT id, full_name, email, phone, role FROM users WHERE id = $1', [req.user.sub]);
    if (!result.rows[0]) return res.status(401).json({ error: 'Authentication required' });
    res.json({ user: result.rows[0] });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
