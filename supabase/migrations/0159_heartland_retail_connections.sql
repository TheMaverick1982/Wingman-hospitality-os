-- Heartland Retail POS integration. Heartland's OAuth registrations are closed,
-- so a store connects with a USER ACCESS TOKEN the owner generates in Heartland
-- Retail and pastes into Wingman. Each account lives on its own subdomain
-- (account_host), so a multi-account operator connects each — one row per
-- (org, account_host).
--
-- The access token is a SECRET: RLS is enabled with NO policies, so the anon/
-- authenticated client can't read this table at all. Every read/write happens
-- through the service-role client in server routes, which also gate on the
-- account owner, and the UI only ever selects non-secret status columns, never
-- the token.

create table if not exists heartland_retail_connections (
  org_id uuid not null references organizations(id) on delete cascade,
  account_host text not null,
  account_name text not null default '',
  access_token text not null,             -- SECRET Bearer token — server-side only
  connected_by uuid references profiles(id) on delete set null,
  connected_at timestamptz not null default now(),
  last_sync_at timestamptz,
  last_sync_status text,                  -- 'ok' | 'error: ...'
  last_sync_guests integer not null default 0,
  last_sync_sales_cents bigint not null default 0,
  primary key (org_id, account_host)
);

-- Deny-all: no policies. Access is exclusively via the service-role client.
alter table heartland_retail_connections enable row level security;
