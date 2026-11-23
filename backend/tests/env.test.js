const test = require('node:test');
const assert = require('node:assert');

function freshEnv(vars) {
  for (const key of ['NODE_ENV', 'JWT_SECRET', 'DATABASE_SSL']) delete process.env[key];
  Object.assign(process.env, vars);
  delete require.cache[require.resolve('../src/config/env')];
  return require('../src/config/env');
}

test('production refuses a missing or placeholder JWT secret', () => {
  assert.throws(() => freshEnv({ NODE_ENV: 'production' }).jwtSecret());
  assert.throws(() => freshEnv({ NODE_ENV: 'production', JWT_SECRET: 'replace-with-a-long-random-secret' }).jwtSecret());
  assert.throws(() => freshEnv({ NODE_ENV: 'production', JWT_SECRET: 'short' }).jwtSecret());
});

test('production accepts a strong JWT secret', () => {
  const secret = 'x'.repeat(48);
  assert.strictEqual(freshEnv({ NODE_ENV: 'production', JWT_SECRET: secret }).jwtSecret(), secret);
});

test('development falls back to a random secret', () => {
  const env = freshEnv({ NODE_ENV: 'development' });
  const secret = env.jwtSecret();
  assert.ok(secret.length >= 32);
  assert.strictEqual(env.jwtSecret(), secret);
});

test('SSL is used for Render external URLs only', () => {
  const env = freshEnv({});
  assert.ok(env.sslConfig('postgresql://u:p@dpg-abc.oregon-postgres.render.com/db'));
  assert.strictEqual(env.sslConfig('postgresql://u:p@dpg-abc-a/db'), undefined);
  assert.ok(freshEnv({ DATABASE_SSL: 'true' }).sslConfig('postgresql://localhost/db'));
});
