-- Card-on-file for subscription billing (Global Payments).
--
-- We store ONLY the processor's multi-use payment token (PMT_…) plus the
-- non-sensitive card display bits (brand, last 4, expiry). The raw card number
-- and CVV never touch our database. Like square_connections, this table holds a
-- secret credential, so RLS is enabled with NO policies: it is completely
-- inaccessible to the anon/authenticated (RLS) client and is reached only via
-- the service-role client after an app-level owner check. The token is never
-- selected to the browser.

create table if not exists billing_payment_methods (
  org_id uuid primary key references organizations(id) on delete cascade,
  provider text not null default 'global_payments',
  environment text not null default 'sandbox',       -- sandbox | production
  payment_token text not null,                        -- GP multi-use PMT_ id (secret-ish; server-only)
  card_brand text,
  card_last4 text,
  card_exp_month smallint,
  card_exp_year smallint,
  connected_by uuid references profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table billing_payment_methods enable row level security;
-- Intentionally NO policies: deny-all to the RLS client. Access is service-role
-- only (billing actions and the recurring-charge cron).

-- Records each subscription charge attempt so receipts/audit have a trail and a
-- failed charge can trigger dunning. Owner-readable (non-sensitive) so the
-- customer can see their own payment history; writes are service-role only.
create table if not exists billing_charges (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id) on delete cascade,
  provider text not null default 'global_payments',
  environment text not null default 'sandbox',
  transaction_id text,
  amount_cents integer not null,
  currency text not null default 'USD',
  status text not null,                               -- CAPTURED | DECLINED | ERROR
  approved boolean not null default false,
  reference text,
  error text,
  created_at timestamptz not null default now()
);

create index if not exists billing_charges_org_idx on billing_charges (org_id, created_at desc);

alter table billing_charges enable row level security;

-- Owners (super_admins) of the org may read their own charge history.
drop policy if exists billing_charges_select on billing_charges;
create policy billing_charges_select on billing_charges
  for select using (
    org_id = current_org_id() and current_access_role() = 'super_admin'
  );
