const path = require('path');
const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const rateLimit = require('express-rate-limit');
const { ZodError } = require('zod');

const auth = require('./routes/auth');
const products = require('./routes/products');
const customers = require('./routes/customers');
const orders = require('./routes/orders');
const payments = require('./routes/payments');
const delivery = require('./routes/delivery');
const admin = require('./routes/admin');

const FRONTEND_DIR = path.join(__dirname, '../../frontend');
const ADMIN_DIR = path.join(__dirname, '../../admin');

const app = express();

// Render (and most hosts) put the app behind one proxy. Without this, every visitor
// shares the proxy's IP and the rate limiter would block everyone at once.
app.set('trust proxy', 1);
app.disable('x-powered-by');

app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      imgSrc: ["'self'", 'https:', 'data:'],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      connectSrc: ["'self'"],
      objectSrc: ["'none'"],
      frameAncestors: ["'none'"],
    },
  },
}));

// The storefront is served by this same app, so cross-origin access is off unless
// FRONTEND_ORIGIN lists specific extra origins (comma separated).
const allowedOrigins = String(process.env.FRONTEND_ORIGIN || '').split(',').map(s => s.trim()).filter(Boolean);
if (allowedOrigins.length) app.use(cors({ origin: allowedOrigins, credentials: true }));

app.use(express.json({ limit: '100kb' }));
app.use(cookieParser());
app.use('/api', rateLimit({ windowMs: 15 * 60 * 1000, limit: 300, standardHeaders: true, legacyHeaders: false }));
const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 20, standardHeaders: true, legacyHeaders: false, message: { error: 'Too many attempts. Try again in 15 minutes.' } });
app.use('/api/auth/login', authLimiter);
app.use('/api/auth/register', authLimiter);

app.get('/api/health', (req, res) => res.json({ ok: true, service: 'debre-birhan-market', payments: process.env.PAYMENTS_MODE || 'manual' }));
app.use('/api/auth', auth);
app.use('/api/products', products);
app.use('/api/customers', customers);
app.use('/api/orders', orders);
app.use('/api/payments', payments);
app.use('/api/delivery', delivery);
app.use('/api/admin', admin);
app.use('/api', (req, res) => res.status(404).json({ error: 'Route not found' }));

app.use('/admin', express.static(ADMIN_DIR));
app.use(express.static(FRONTEND_DIR));
app.get('*', (req, res) => res.sendFile(path.join(FRONTEND_DIR, 'index.html')));

// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  if (err instanceof ZodError) {
    const issue = err.issues[0];
    const field = issue.path.join('.');
    return res.status(400).json({ error: field ? `${field}: ${issue.message}` : issue.message });
  }
  if (err.type === 'entity.parse.failed') return res.status(400).json({ error: 'Invalid JSON body' });
  const status = err.status || 500;
  if (status >= 500) console.error(err);
  res.status(status).json({ error: status >= 500 ? 'Internal server error' : err.message });
});

module.exports = app;
