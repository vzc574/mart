const router = require('express').Router();
const db = require('../config/db');
const { requireAuth } = require('../utils/auth');
const { isUuid } = require('../utils/validate');

// Only methods with enabled: true can be used at checkout.
function paymentMethods() {
  return [
    { id: 'cod', name: 'Cash on delivery', enabled: true, status: 'pending collection' },
    { id: 'bank_transfer', name: 'Bank transfer', enabled: true, status: 'manual verification' },
    { id: 'telebirr', name: 'Telebirr', enabled: false, status: 'merchant approval required' },
    { id: 'cbe_birr', name: 'CBE Birr', enabled: false, status: 'gateway configuration required' },
    { id: 'mpesa', name: 'M-Pesa', enabled: false, status: 'merchant API access required' },
    { id: 'card', name: 'Visa or Mastercard', enabled: false, status: 'hosted gateway configuration required' },
  ];
}

const enabledMethodIds = () => paymentMethods().filter(m => m.enabled).map(m => m.id);

router.get('/methods', (req, res) => {
  res.json({
    mode: process.env.PAYMENTS_MODE || 'manual',
    methods: paymentMethods(),
    bank: {
      name: process.env.BANK_NAME || null,
      accountName: process.env.BANK_ACCOUNT_NAME || null,
      accountNumber: process.env.BANK_ACCOUNT_NUMBER || null,
    },
  });
});

router.post('/initialize', requireAuth, async (req, res, next) => {
  try {
    if (!isUuid(req.body.orderId)) return res.status(404).json({ error: 'Order not found' });
    const r = await db.query('SELECT id FROM orders WHERE id = $1 AND customer_id = $2', [req.body.orderId, req.user.sub]);
    if (!r.rows[0]) return res.status(404).json({ error: 'Order not found' });
    res.status(503).json({ error: 'Online payment providers are not enabled yet. Use bank transfer or cash on delivery.' });
  } catch (error) {
    next(error);
  }
});

router.post('/webhook/:provider', (req, res) => {
  res.status(501).json({ error: 'Webhook adapter is intentionally disabled until provider signature rules and credentials are configured.' });
});

router.get('/:id/status', requireAuth, async (req, res, next) => {
  try {
    if (!isUuid(req.params.id)) return res.status(404).json({ error: 'Payment not found' });
    const r = await db.query(
      'SELECT p.* FROM payments p JOIN orders o ON o.id = p.order_id WHERE p.id = $1 AND o.customer_id = $2',
      [req.params.id, req.user.sub],
    );
    if (!r.rows[0]) return res.status(404).json({ error: 'Payment not found' });
    res.json({ payment: r.rows[0] });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
module.exports.enabledMethodIds = enabledMethodIds;
