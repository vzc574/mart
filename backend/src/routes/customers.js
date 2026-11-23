const router = require('express').Router();
const { z } = require('zod');
const db = require('../config/db');
const { requireAuth } = require('../utils/auth');

const addressSchema = z.object({
  region: z.string().trim().min(2).max(100),
  city: z.string().trim().min(2).max(100),
  neighborhood: z.string().trim().max(200).optional().default(''),
  streetOrLandmark: z.string().trim().min(2).max(500),
  latitude: z.number().min(-90).max(90).nullable().optional().default(null),
  longitude: z.number().min(-180).max(180).nullable().optional().default(null),
});

router.post('/addresses', requireAuth, async (req, res, next) => {
  try {
    const a = addressSchema.parse(req.body);
    const r = await db.query(
      `INSERT INTO addresses(user_id, region, city, neighborhood, street_or_landmark, latitude, longitude)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [req.user.sub, a.region, a.city, a.neighborhood, a.streetOrLandmark, a.latitude, a.longitude],
    );
    res.status(201).json({ address: r.rows[0] });
  } catch (error) {
    next(error);
  }
});

router.get('/addresses', requireAuth, async (req, res, next) => {
  try {
    const r = await db.query('SELECT * FROM addresses WHERE user_id = $1 ORDER BY created_at DESC', [req.user.sub]);
    res.json({ addresses: r.rows });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
