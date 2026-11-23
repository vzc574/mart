# Payment integration status

The payment abstraction exposes `GET /api/payments/methods`, initialization, status, and provider webhook routes. The default mode is `manual`.

Telebirr, CBE Birr, M-Pesa, and card payments are disabled until merchant credentials, approved callback URLs, signature rules, and sandbox tests are supplied. Bank transfer is manual verification; COD remains pending collection until a driver/admin records the collected amount. No PINs, raw card data, or invented credentials are stored.

Set `PAYMENTS_MODE=sandbox` only after adding real provider adapters in `backend/src/payments/` and implementing provider-specific signature verification and idempotency.
