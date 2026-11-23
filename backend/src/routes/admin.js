const router = require('express').Router();
const { z } = require('zod');
const db = require('../config/db');
const { requireAuth, requireRole } = require('../utils/auth');
const { isUuid, httpError } = require('../utils/validate');

router.use(requireAuth, requireRole('admin', 'dispatcher'));
const adminOnly = requireRole('admin');

const productSchema = z.object({
  name: z.string().trim().min(2).max(200),
  description: z.string().trim().max(5000).optional().default(''),
  categoryId: z.string().uuid(),
  priceEtb: z.number().min(0).max(10_000_000),
  discountPercent: z.number().min(0).max(100).optional().default(0),
  stock: z.number().int().min(0).max(1_000_000),
  imageUrl: z.string().trim().max(2000).url().refine(u => /^https?:\/\//i.test(u), 'Image URL must start with http:// or https://').or(z.literal('')).optional().default(''),
  popularity: z.number().int().min(0).max(1_000_000).optional().default(0),
  active: z.boolean().optional().default(true),
});

router.get('/dashboard', async (req, res, next) => {
  try {
    const [sales, orders, stock, pending] = await Promise.all([
      db.query("SELECT COALESCE(SUM(total_etb), 0) AS sales FROM orders WHERE status = 'completed'"),
      db.query('SELECT COUNT(*) AS orders FROM orders'),
      db.query('SELECT COALESCE(SUM(available_quantity), 0) AS stock FROM inventory'),
      db.query("SELECT COUNT(*) AS pending FROM payments WHERE status IN ('pending', 'pending_collection')"),
    ]);
    res.json({ sales: sales.rows[0], orders: orders.rows[0], stock: stock.rows[0], pendingPayments: pending.rows[0] });
  } catch (error) {
    next(error);
  }
});

router.get('/products', async (req, res, next) => {
  try {
    const r = await db.query(
      `SELECT p.*, c.name AS category, COALESCE(i.available_quantity, 0) AS stock
       FROM products p JOIN categories c ON c.id = p.category_id LEFT JOIN inventory i ON i.product_id = p.id
       ORDER BY p.active DESC, p.created_at DESC`,
    );
    res.json({ products: r.rows });
  } catch (error) {
    next(error);
  }
});

router.post('/products', adminOnly, async (req, res, next) => {
  const client = await db.connect();
  try {
    const p = productSchema.parse(req.body);
    await client.query('BEGIN');
    const product = (await client.query(
      `INSERT INTO products(name, description, category_id, price_etb, discount_percent, popularity, active, image_url)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
      [p.name, p.description, p.categoryId, p.priceEtb, p.discountPercent, p.popularity, p.active, p.imageUrl || null],
    )).rows[0];
    await client.query('INSERT INTO inventory(product_id, available_quantity) VALUES ($1, $2)', [product.id, p.stock]);
    await client.query('COMMIT');
    res.status(201).json({ product: { ...product, stock: p.stock } });
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    if (error.code === '23503') return next(httpError(400, 'Unknown category'));
    next(error);
  } finally {
    client.release();
  }
});

router.put('/products/:id', adminOnly, async (req, res, next) => {
  const client = await db.connect();
  try {
    if (!isUuid(req.params.id)) throw httpError(404, 'Product not found');
    const p = productSchema.parse(req.body);
    await client.query('BEGIN');
    const product = (await client.query(
      `UPDATE products SET name = $2, description = $3, category_id = $4, price_etb = $5, discount_percent = $6,
         popularity = $7, active = $8, image_url = $9, updated_at = now()
       WHERE id = $1 RETURNING *`,
      [req.params.id, p.name, p.description, p.categoryId, p.priceEtb, p.discountPercent, p.popularity, p.active, p.imageUrl || null],
    )).rows[0];
    if (!product) throw httpError(404, 'Product not found');
    await client.query(
      `INSERT INTO inventory(product_id, available_quantity) VALUES ($1, $2)
       ON CONFLICT (product_id) DO UPDATE SET available_quantity = EXCLUDED.available_quantity, updated_at = now()`,
      [product.id, p.stock],
    );
    await client.query('COMMIT');
    res.json({ product: { ...product, stock: p.stock } });
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    if (error.code === '23503') return next(httpError(400, 'Unknown category'));
    next(error);
  } finally {
    client.release();
  }
});

// Products that appear in past orders are archived (hidden) instead of deleted,
// so order history stays intact.
router.delete('/products/:id', adminOnly, async (req, res, next) => {
  try {
    if (!isUuid(req.params.id)) throw httpError(404, 'Product not found');
    const used = await db.query('SELECT 1 FROM order_items WHERE product_id = $1 LIMIT 1', [req.params.id]);
    if (used.rowCount) {
      const r = await db.query('UPDATE products SET active = false, updated_at = now() WHERE id = $1', [req.params.id]);
      if (!r.rowCount) throw httpError(404, 'Product not found');
      return res.json({ archived: true });
    }
    const r = await db.query('DELETE FROM products WHERE id = $1', [req.params.id]);
    if (!r.rowCount) throw httpError(404, 'Product not found');
    res.json({ deleted: true });
  } catch (error) {
    next(error);
  }
});

router.get('/orders', async (req, res, next) => {
  try {
    const r = await db.query(
      `SELECT o.*, u.full_name AS customer_name, u.phone AS customer_phone, a.city, a.street_or_landmark,
              pay.method AS payment_method, pay.status AS payment_status
       FROM orders o
       JOIN users u ON u.id = o.customer_id
       JOIN addresses a ON a.id = o.address_id
       LEFT JOIN payments pay ON pay.order_id = o.id
       ORDER BY o.created_at DESC LIMIT 500`,
    );
    res.json({ orders: r.rows });
  } catch (error) {
    next(error);
  }
});

router.get('/inventory', async (req, res, next) => {
  try {
    const r = await db.query('SELECT p.id, p.name, i.* FROM products p JOIN inventory i ON i.product_id = p.id ORDER BY i.available_quantity ASC');
    res.json({ inventory: r.rows });
  } catch (error) {
    next(error);
  }
});

router.get('/payments', async (req, res, next) => {
  try {
    res.json({ payments: (await db.query('SELECT * FROM payments ORDER BY created_at DESC LIMIT 500')).rows });
  } catch (error) {
    next(error);
  }
});

router.get('/deliveries', async (req, res, next) => {
  try {
    res.json({ deliveries: (await db.query('SELECT * FROM deliveries ORDER BY created_at DESC LIMIT 500')).rows });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
