CREATE TABLE billing_checkouts (
  id uuid PRIMARY KEY,
  user_id integer NOT NULL REFERENCES users (id) ON DELETE RESTRICT,
  request_key uuid NOT NULL,
  kind text NOT NULL CHECK (kind IN ('report', 'subscription')),
  sku text NOT NULL,
  title text NOT NULL,
  tier text CHECK (tier IN ('plus', 'premium', 'professional')),
  amount_paise integer NOT NULL CHECK (amount_paise > 0),
  provider_id text UNIQUE,
  provider_plan_id text,
  place_id text,
  state text NOT NULL DEFAULT 'preparing',
  period_end timestamptz,
  state_event_at bigint NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, request_key),
  CHECK ((kind = 'report') = (place_id IS NOT NULL)),
  CHECK ((kind = 'subscription') = (provider_plan_id IS NOT NULL))
);
--> statement-breakpoint
CREATE INDEX billing_checkouts_user_idx ON billing_checkouts (user_id, created_at DESC);
--> statement-breakpoint
CREATE TABLE billing_charges (
  provider_payment_id text PRIMARY KEY,
  checkout_id uuid NOT NULL REFERENCES billing_checkouts (id) ON DELETE RESTRICT,
  amount_paise integer NOT NULL CHECK (amount_paise > 0),
  provider_invoice_id text,
  charged_at timestamptz NOT NULL
);
--> statement-breakpoint
CREATE INDEX billing_charges_checkout_idx ON billing_charges (checkout_id);
--> statement-breakpoint
CREATE TABLE billing_refunds (
  provider_refund_id text PRIMARY KEY,
  provider_payment_id text NOT NULL,
  amount_paise integer NOT NULL CHECK (amount_paise > 0),
  refunded_at timestamptz NOT NULL
);
--> statement-breakpoint
CREATE INDEX billing_refunds_payment_idx ON billing_refunds (provider_payment_id);
--> statement-breakpoint
CREATE TABLE billing_events (
  event_id text PRIMARY KEY,
  event_type text NOT NULL,
  digest text NOT NULL,
  received_at timestamptz NOT NULL DEFAULT now()
);
