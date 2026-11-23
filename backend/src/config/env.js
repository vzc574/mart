const crypto = require('crypto');

const isProduction = process.env.NODE_ENV === 'production';
const PLACEHOLDER_SECRETS = ['replace-with-a-long-random-secret', 'development-only-secret-change-me'];

let devSecret;

// Returns the JWT signing secret. In production a strong secret is mandatory;
// in development a random per-process secret is used if none is configured.
function jwtSecret() {
  const secret = process.env.JWT_SECRET;
  if (secret && secret.length >= 32 && !PLACEHOLDER_SECRETS.includes(secret)) return secret;
  if (isProduction) throw new Error('JWT_SECRET must be set to a random value of at least 32 characters');
  if (!devSecret) {
    devSecret = crypto.randomBytes(48).toString('hex');
    console.warn('WARNING: JWT_SECRET is missing or a placeholder. Using a temporary secret; logins reset on restart.');
  }
  return devSecret;
}

// Fails fast at startup instead of running an insecure production server.
function validateEnv() {
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required');
  jwtSecret();
}

// Render's *internal* database URL needs no SSL; its *external* URL (*.render.com) requires it.
// DATABASE_SSL=true|false overrides the detection.
function sslConfig(url = process.env.DATABASE_URL || '') {
  if (process.env.DATABASE_SSL === 'true') return { rejectUnauthorized: false };
  if (process.env.DATABASE_SSL === 'false') return undefined;
  return url.includes('.render.com') ? { rejectUnauthorized: false } : undefined;
}

const LOCAL_DELIVERY_CITY = 'debre birhan';
const localDeliveryFee = () => Number(process.env.LOCAL_DELIVERY_FEE_ETB || 100);

module.exports = { isProduction, jwtSecret, validateEnv, sslConfig, LOCAL_DELIVERY_CITY, localDeliveryFee };
