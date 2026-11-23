-- Product image shown in the storefront, plus constraints the admin product manager relies on.
ALTER TABLE products ADD COLUMN IF NOT EXISTS image_url TEXT;
ALTER TABLE products ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();
CREATE INDEX IF NOT EXISTS products_active_idx ON products(active);
CREATE INDEX IF NOT EXISTS order_items_order_idx ON order_items(order_id);
CREATE INDEX IF NOT EXISTS addresses_user_idx ON addresses(user_id);
CREATE UNIQUE INDEX IF NOT EXISTS users_email_lower_idx ON users(lower(email));
