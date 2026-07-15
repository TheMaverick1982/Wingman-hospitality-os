-- Clover POS integration. Unlike Square, each Clover STORE is its own merchant,
-- so a multi-location operator connects each store — one row per (org, merchant).
-- Tokens are SECRETS: RLS is enabled with NO policies, so the anon/authenticated
-- client can't read this table at all. Every read/write happens through the
-- service-role client in server routes, which also gate on the account owner,
-- and the UI only ever selects non-secret status columns, never the token.

create table if not exists clover_connections (
  org_id uuid not null references organizations(id) on delete cascade,
  merchant_id text not null,
  merchant_name text not null default '',
  access_token text not null,
  refresh_token text not null default '',
  token_expires_at timestamptz,          -- access token expiry (short — ~30 min)
  refresh_expires_at timestamptz,
  scopes text not null default '',
  connected_by uuid references profiles(id) on delete set null,
  connected_at timestamptz not null default now(),
  last_sync_at timestamptz,
  last_sync_status text,                  -- 'ok' | 'error: ...'
  last_sync_guests integer not null default 0,
  last_sync_sales_cents bigint not null default 0,
  primary key (org_id, merchant_id)
);

-- Deny-all: no policies. Access is exclusively via the service-role client.
alter table clover_connections enable row level security;
