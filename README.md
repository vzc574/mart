# Debre Birhan Market

Online supermarket for one central warehouse in Debre Birhan, Ethiopia. Prices are in Ethiopian Birr (ETB). Node.js + Express API, PostgreSQL, and a plain HTML/CSS/JS storefront served by the same app.

The store starts with **no products**. The owner adds real products in the store manager at `/admin/products.html`.

## Deploy on Render

1. Push this folder to a GitHub repository (`.env` is git-ignored and must never be committed).
2. In Render: **New → Blueprint**, pick the repository. `render.yaml` creates:
   - the web service (`npm ci`, then `npm run migrate && npm start`)
   - a PostgreSQL database, connected through `DATABASE_URL`
   - a random `JWT_SECRET`
3. When asked, fill in `ADMIN_EMAIL` and `ADMIN_PASSWORD` (8+ characters) for the owner account, and the bank details shown at checkout.
4. When the deploy is live, sign in with that email and password. The admin account is created automatically on start; changing `ADMIN_PASSWORD` and redeploying resets the password.
5. Sign in and add products at `https://<your-app>.onrender.com/admin/products.html`.

Notes:
- Keep `ADMIN_PASSWORD` secret. Anyone with it can manage the store.
- Render's free database is deleted after 30 days and the free web service sleeps when idle. Use paid plans for a real store.

## Run locally

1. Create a PostgreSQL database, e.g. `createdb debre_birhan_market`.
2. `cp .env.example .env` and set `DATABASE_URL` (and `ADMIN_EMAIL` if you want an admin).
3. `npm install`
4. `npm run migrate`
5. `npm run dev`, then open http://localhost:3000

Without `JWT_SECRET`, development uses a temporary random secret (you get logged out on restart). Production refuses to start without a strong one.

To promote an existing account at any time: `npm run make-admin -- owner@example.com`

## Migrations

SQL files in `backend/migrations/` run in name order. Each file runs once inside a transaction and is recorded in the `schema_migrations` table, so `npm run migrate` is safe to run repeatedly. To change the schema, add a new file (e.g. `004_something.sql`) instead of editing old ones.

## Payments and delivery

Cash on delivery and bank transfer (manual verification) are enabled. Telebirr, CBE Birr, M-Pesa and cards stay disabled until merchant credentials and provider integrations exist. Local delivery in Debre Birhan costs `LOCAL_DELIVERY_FEE_ETB` (default 100). Nationwide delivery is quoted manually by the store.

## Tests

`npm test`
# mart
