-- SevenRooms integration. SevenRooms is a reservation + guest-CRM platform (not
-- a POS), which makes it an especially good source for Wingman: it holds guest
-- profiles and visit history, not just sales. Like Toast, it uses machine-to-
-- machine auth — our partner app holds the client credentials in env — and each
-- venue is scoped by its SevenRooms Venue ID. So we store NO per-venue token
-- here, only the venue id + display name + sync status. A multi-location operator
-- links each venue (one row per (org, venue_id)).
--
-- Deny-all like every other connections table: RLS enabled, NO policies, so the
-- anon/authenticated client can't read it at all. Every read/write goes through
-- the service-role client in server routes that gate on the account owner; the UI
-- only ever selects the non-secret status columns.

create table if not exists sevenrooms_connections (
  org_id uuid not null references organizations(id) on delete cascade,
  venue_id text not null,
  venue_name text not null default '',
  connected_by uuid references profiles(id) on delete set null,
  connected_at timestamptz not null default now(),
  last_sync_at timestamptz,
  last_sync_status text,                   -- 'ok' | 'error: ...'
  last_sync_guests integer not null default 0,
  primary key (org_id, venue_id)
);

-- Deny-all: no policies. Access is exclusively via the service-role client.
alter table sevenrooms_connections enable row level security;
