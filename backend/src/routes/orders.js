const router = require('express').Router();
const { z } = require('zod');
const db = require('../config/db');
const { requireAuth } = require('../utils/auth');
const { isUuid, httpError } = require('../utils/validate');
const { LOCAL_DELIVERY_CITY, localDeliveryFee } = require('../config/env');
const { enabledMethodIds } = require('./payments');

const orderSchema = z.object({
  items: z.array(z.object({
    productId: z.string().uuid(),
    quantity: z.number().int().positive().max(1000),
  })).min(1).max(100),
  addressId: z.string().uuid(),
  deliveryType: z.enum(['local', 'nationwide']),
  paymentMethod: z.enum(['telebirr', 'cbe_birr', 'mpesa', 'card', 'bank_transfer', 'cod']),
});

const toCents = etb => Math.round(Number(etb) * 100);
const toEtb = cents => (cents / 100).toFixed(2);

router.post('/', requireAuth, async (req, res, next) => {
  let client;
  try {
    const input = orderSchema.parse(req.body);
    if (!enabledMethodIds().includes(input.paymentMethod)) throw httpError(400, 'This payment method is not available yet');

    // Merge duplicate lines for the same product.
    const quantities = new Map();
    for (const item of input.items) quantities.set(item.productId, (quantities.get(item.productId) || 0) + item.quantity);
    // Lock rows in a fixed order so concurrent orders can't deadlock each other.
    const productIds = [...quantities.keys()].sort();

    client = await db.connect();
    await client.query('BEGIN');

    // The address must belong to the customer placing the order.
    const address = (await client.query('SELECT id, city FROM addresses WHERE id = $1 AND user_id = $2', [input.addressId, req.user.sub])).rows[0];
    if (!address) throw httpError(404, 'Address not found');
    if (input.deliveryType === 'local' && address.city.trim().toLowerCase() !== LOCAL_DELIVERY_CITY) {
      throw httpError(400, 'Local delivery is only available in Debre Birhan. Choose nationwide delivery.');
    }

    // Lock the inventory rows (the rows we update), not just the product rows.
    const rows = (await client.query(
      `SELECT p.id, p.name, p.price_etb, p.discount_percent, p.active, i.available_quantity
       FROM products p JOIN inventory i ON i.product_id = p.id
       WHERE p.id = ANY($1::uuid[])
       ORDER BY p.id
       FOR UPDATE OF i`,
      [productIds],
    )).rows;
    const byId = new Map(rows.map(r => [r.id, r]));

    let subtotalCents = 0;
    let discountCents = 0;
    const lines = [];
    for (const id of productIds) {
      const product = byId.get(id);
      const quantity = quantities.get(id);
      if (!product || !product.active) throw httpError(409, 'A product in your cart is no longer available');
      if (product.available_quantity < quantity) throw httpError(409, `Not enough stock for ${product.name} (only ${product.available_quantity} left)`);
      const listCents = toCents(product.price_etb);
      const unitCents = Math.round(listCents * (100 - Number(product.discount_percent)) / 100);
      subtotalCents += listCents * quantity;
      discountCents += (listCents - unitCents) * quantity;
      lines.push({ id, quantity, unitCents });
    }

    const feeCents = input.deliveryType === 'local' ? toCents(localDeliveryFee()) : 0;
    const totalCents = subtotalCents - discountCents + feeCents;

    const order = (await client.query(
      `INSERT INTO orders(customer_id, address_id, status, delivery_type, subtotal_etb, discount_etb, delivery_fee_etb, total_etb)
       VALUES ($1, $2, 'pending', $3, $4, $5, $6, $7) RETURNING *`,
      [req.user.sub, address.id, input.deliveryType, toEtb(subtotalCents), toEtb(discountCents), toEtb(feeCents), toEtb(totalCents)],
    )).rows[0];

    for (const line of lines) {
      await client.query(
        'INSERT INTO order_items(order_id, product_id, quantity, unit_price_etb) VALUES ($1, $2, $3, $4)',
        [order.id, line.id, line.quantity, toEtb(line.unitCents)],
      );
      await client.query(
        `UPDATE inventory
         SET available_quantity = available_quantity - $1, reserved_quantity = reserved_quantity + $1, updated_at = now()
         WHERE product_id = $2`,
        [line.quantity, line.id],
      );
    }

    await client.query(
      'INSERT INTO payments(order_id, method, status, amount_etb) VALUES ($1, $2, $3, $4)',
      [order.id, input.paymentMethod, input.paymentMethod === 'cod' ? 'pending_collection' : 'pending', order.total_etb],
    );
    await client.query('COMMIT');
    res.status(201).json({ order });
  } catch (error) {
    if (client) await client.query('ROLLBACK').catch(() => {});
    next(error);
  } finally {
    if (client) client.release();
  }
});

router.get('/', requireAuth, async (req, res, next) => {
  try {
    const r = await db.query('SELECT * FROM orders WHERE customer_id = $1 ORDER BY created_at DESC', [req.user.sub]);
    res.json({ orders: r.rows });
  } catch (error) {
    next(error);
  }
});

router.get('/:id', requireAuth, async (req, res, next) => {
  try {
    if (!isUuid(req.params.id)) return res.status(404).json({ error: 'Order not found' });
    const r = await db.query('SELECT * FROM orders WHERE id = $1 AND customer_id = $2', [req.params.id, req.user.sub]);
    if (!r.rows[0]) return res.status(404).json({ error: 'Order not found' });
    const items = await db.query(
      'SELECT oi.product_id, p.name, oi.quantity, oi.unit_price_etb FROM order_items oi JOIN products p ON p.id = oi.product_id WHERE oi.order_id = $1',
      [req.params.id],
    );
    res.json({ order: r.rows[0], items: items.rows });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
