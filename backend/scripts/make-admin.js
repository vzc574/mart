// Usage: npm run make-admin -- owner@example.com
require('dotenv').config();
const { Client } = require('pg');
const { sslConfig } = require('../src/config/env');

(async () => {
  const email = String(process.argv[2] || '').trim().toLowerCase();
  if (!email) throw new Error('Usage: npm run make-admin -- <email>');
  const client = new Client({ connectionString: process.env.DATABASE_URL, ssl: sslConfig() });
  await client.connect();
  try {
    const r = await client.query("UPDATE users SET role = 'admin' WHERE email = $1 RETURNING email", [email]);
    if (!r.rowCount) throw new Error(`No registered user with email ${email}. Register on the site first.`);
    console.log(`${email} is now an admin`);
  } finally {
    await client.end();
  }
})().catch(error => {
  console.error(error.message);
  process.exit(1);
});
