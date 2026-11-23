# Database

Apply migrations with:

```bash
npm run migrate
```

Files in `backend/migrations/` run once each, in name order, inside a transaction, and are recorded in `schema_migrations`. Add new numbered files for schema changes; never edit an applied file.

Prices and fees use PostgreSQL `NUMERIC(12,2)` in ETB. Order totals are computed in santim (integer cents) on the server.
