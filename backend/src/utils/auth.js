const jwt = require('jsonwebtoken');
const db = require('../config/db');
const { jwtSecret, isProduction } = require('../config/env');

const COOKIE_NAME = 'market_token';
const cookieOptions = { httpOnly: true, sameSite: 'lax', secure: isProduction, path: '/' };

function sign(user) {
  return jwt.sign({ sub: user.id, email: user.email, role: user.role }, jwtSecret(), { expiresIn: '7d', algorithm: 'HS256' });
}

function setAuthCookie(res, user) {
  res.cookie(COOKIE_NAME, sign(user), { ...cookieOptions, maxAge: 7 * 24 * 60 * 60 * 1000 });
}

function clearAuthCookie(res) {
  res.clearCookie(COOKIE_NAME, cookieOptions);
}

function readToken(req) {
  if (req.cookies[COOKIE_NAME]) return req.cookies[COOKIE_NAME];
  const header = String(req.headers.authorization || '');
  return header.startsWith('Bearer ') ? header.slice(7) : null;
}

function requireAuth(req, res, next) {
  try {
    const token = readToken(req);
    if (!token) throw new Error('missing token');
    req.user = jwt.verify(token, jwtSecret(), { algorithms: ['HS256'] });
    next();
  } catch {
    res.status(401).json({ error: 'Authentication required' });
  }
}

// Checks the role stored in the database, not the one in the token,
// so a demoted or deleted user loses access immediately.
function requireRole(...roles) {
  return async (req, res, next) => {
    try {
      const result = await db.query('SELECT role FROM users WHERE id = $1', [req.user.sub]);
      const role = result.rows[0]?.role;
      if (!roles.includes(role)) return res.status(403).json({ error: 'Insufficient permissions' });
      req.user.role = role;
      next();
    } catch (error) {
      next(error);
    }
  };
}

module.exports = { sign, setAuthCookie, clearAuthCookie, requireAuth, requireRole };
