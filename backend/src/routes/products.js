const router = require('express').Router();
const db = require('../config/db');
const { isUuid } = require('../utils/validate');

// Price after the product's discount, rounded to whole santim.
const PRODUCT_COLUMNS = `
  p.id, p.name, p.description, p.image_url, p.price_etb, p.discount_percent, p.popularity,
  ROUND(p.price_etb * (100 - p.discount_percent) / 100, 2) AS final_price_etb,
  c.name AS category, c.slug AS category_slug,
  COALESCE(i.available_quantity, 0) AS stock`;

const SORTS = {
  popular: 'p.popularity DESC, p.created_at DESC',
  newest: 'p.created_at DESC',
  price_asc: 'final_price_etb ASC',
  price_desc: 'final_price_etb DESC',
};

router.get('/categories', async (req, res, next) => {
  try {
    const r = await db.query('SELECT id, name, slug FROM categories ORDER BY name');
    res.json({ categories: r.rows });
  } catch (error) {
    next(error);
  }
});

router.get('/', async (req, res, next) => {
  try {
    const q = typeof req.query.q === 'string' ? req.query.q.trim().slice(0, 100) : '';
    const category = typeof req.query.category === 'string' ? req.query.category : '';
    const order = SORTS[req.query.sort] || SORTS.popular;
    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 100, 1), 200);

    const values = [];
    const where = ['p.active = true'];
    if (q) {
      // Escape LIKE wildcards so a search for "%" doesn't match everything.
      values.push(`%${q.replace(/[\\%_]/g, '\\$&')}%`);
      where.push(`(p.name ILIKE $${values.length} OR p.description ILIKE $${values.length})`);
    }
    if (category) {
      values.push(category);
      where.push(`c.slug = $${values.length}`);
    }
    if (req.query.deals === '1') where.push('p.discount_percent > 0');
    if (typeof req.query.ids === 'string') {
      const ids = req.query.ids.split(',').filter(isUuid).slice(0, 100);
      values.push(ids);
      where.push(`p.id = ANY($${values.length}::uuid[])`);
    }
    values.push(limit);

    const sql = `SELECT ${PRODUCT_COLUMNS}
      FROM products p
      JOIN categories c ON c.id = p.category_id
      LEFT JOIN inventory i ON i.product_id = p.id
      WHERE ${where.join(' AND ')}
      ORDER BY ${order}
      LIMIT $${values.length}`;
    res.json({ products: (await db.query(sql, values)).rows });
  } catch (error) {
    next(error);
  }
});

router.get('/:id', async (req, res, next) => {
  try {
    if (!isUuid(req.params.id)) return res.status(404).json({ error: 'Product not found' });
    const r = await db.query(
      `SELECT ${PRODUCT_COLUMNS}
       FROM products p
       JOIN categories c ON c.id = p.category_id
       LEFT JOIN inventory i ON i.product_id = p.id
       WHERE p.id = $1 AND p.active = true`,
      [req.params.id],
    );
    if (!r.rows[0]) return res.status(404).json({ error: 'Product not found' });
    res.json({ product: r.rows[0] });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
