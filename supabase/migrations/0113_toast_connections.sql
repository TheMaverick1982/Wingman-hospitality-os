-- Toast POS integration. Toast uses machine-to-machine auth (our partner app
-- holds the client credentials in env), and each restaurant is scoped by its
-- Restaurant GUID. So unlike Clover we do NOT store a per-merchant token here —
-- only the restaurant GUID + display name + sync status. A multi-location
-- operator links each restaurant (one row per (org, restaurant_guid)).
--
-- We still keep this table deny-all (RLS enabled, NO policies): the anon/
-- authenticated client can't read it at all. Every read/write happens through
-- the service-role client in server routes, which gate on the account owner; the
-- UI only ever selects non-secret status columns.

create table if not exists toast_connections (
  org_id uuid not null references organizations(id) on delete cascade,
  restaurant_guid text not null,
  restaurant_name text not null default '',
  connected_by uuid references profiles(id) on delete set null,
  connected_at timestamptz not null default now(),
  last_sync_at timestamptz,
  last_sync_status text,                  -- 'ok' | 'error: ...'
  last_sync_guests integer not null default 0,
  last_sync_sales_cents bigint not null default 0,
  primary key (org_id, restaurant_guid)
);

-- Deny-all: no policies. Access is exclusively via the service-role client.
alter table toast_connections enable row level security;
