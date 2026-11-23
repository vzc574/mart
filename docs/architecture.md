# Debre Birhan Market architecture

The platform uses a vanilla HTML/CSS/JavaScript storefront, an Express REST API, and PostgreSQL. The central warehouse is represented by the `inventory` table. Orders lock the inventory rows, check stock, apply product discounts and record the payment in one transaction.

Customer-facing pages live in `frontend/`; protected operations are exposed under `/api/admin`. Passwords are hashed with bcryptjs and JWTs are stored in an HTTP-only cookie. In production, terminate HTTPS at the reverse proxy, set a strong `JWT_SECRET`, configure a real CORS origin, and add a managed PostgreSQL backup policy.

Local delivery uses configurable `delivery_zones`, own `drivers`, and delivery events. Nationwide delivery is intentionally manual until a courier contract/API is verified.
