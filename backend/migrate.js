require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { Client } = require('pg');
const { sslConfig } = require('./src/config/env');

const MIGRATIONS_DIR = path.join(__dirname, 'migrations');

async function migrate() {
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required');
  const client = new Client({ connectionString: process.env.DATABASE_URL, ssl: sslConfig() });
  await client.connect();
  try {
    // Only one migrator at a time (e.g. two Render instances starting together).
    await client.query('SELECT pg_advisory_lock(727274)');
    await client.query(`CREATE TABLE IF NOT EXISTS schema_migrations (
      filename TEXT PRIMARY KEY,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )`);

    // Databases created before migration tracking existed already have 001/002 applied.
    const tracked = await client.query('SELECT COUNT(*)::int AS n FROM schema_migrations');
    const legacy = await client.query("SELECT to_regclass('public.users') IS NOT NULL AS exists");
    if (tracked.rows[0].n === 0 && legacy.rows[0].exists) {
      await client.query("INSERT INTO schema_migrations(filename) VALUES ('001_initial.sql'), ('002_seed.sql')");
      console.log('Existing schema detected; marked 001 and 002 as applied');
    }

    const applied = new Set((await client.query('SELECT filename FROM schema_migrations')).rows.map(r => r.filename));
    const files = fs.readdirSync(MIGRATIONS_DIR).filter(f => f.endsWith('.sql')).sort();

    for (const file of files) {
      if (applied.has(file)) continue;
      console.log(`Applying ${file}`);
      try {
        await client.query('BEGIN');
        await client.query(fs.readFileSync(path.join(MIGRATIONS_DIR, file), 'utf8'));
        await client.query('INSERT INTO schema_migrations(filename) VALUES ($1)', [file]);
        await client.query('COMMIT');
      } catch (error) {
        await client.query('ROLLBACK');
        throw new Error(`Migration ${file} failed: ${error.message}`);
      }
    }

    // Promote the owner account named in ADMIN_EMAIL (it must already be registered).
    const adminEmail = String(process.env.ADMIN_EMAIL || '').trim().toLowerCase();
    if (adminEmail) {
      const promoted = await client.query("UPDATE users SET role = 'admin' WHERE email = $1 AND role <> 'admin' RETURNING email", [adminEmail]);
      if (promoted.rowCount) console.log(`Promoted ${adminEmail} to admin`);
    }

    console.log('Database ready');
  } finally {
    await client.end();
  }
}

migrate().catch(error => {
  console.error(error.message);
  process.exit(1);
});
