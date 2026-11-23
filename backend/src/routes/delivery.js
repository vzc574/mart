const router = require('express').Router();
const { requireAuth, requireRole } = require('../utils/auth');
const { LOCAL_DELIVERY_CITY, localDeliveryFee } = require('../config/env');

// Public so the cart can show the real delivery fee before sign-in.
router.get('/fees', (req, res) => {
  res.json({ local: { city: 'Debre Birhan', feeEtb: localDeliveryFee() }, nationwide: { feeEtb: null, note: 'Quoted by the store after the order is placed' } });
});

router.post('/quote', requireAuth, (req, res) => {
  const local = String(req.body.city || '').trim().toLowerCase() === LOCAL_DELIVERY_CITY;
  res.json({
    coverage: local ? 'confirmed' : 'manual_review_required',
    provider: local ? 'own_drivers' : 'courier_manual_workflow',
    feeEtb: local ? localDeliveryFee() : null,
    message: local ? 'Local delivery fee is configurable by zone.' : 'Nationwide delivery requires administrator courier quotation before checkout.',
  });
});

router.post('/assign', requireAuth, requireRole('admin', 'dispatcher'), (req, res) => {
  res.status(501).json({ error: 'Driver assignment requires configured delivery records and is available through the admin workflow.' });
});

router.get('/track/:trackingNumber', (req, res) => {
  res.json({ trackingNumber: String(req.params.trackingNumber).slice(0, 64), status: 'manual_update_pending', events: [] });
});

module.exports = router;
