-- Staff activity log (owner-only). Captures logins and meaningful create/edit/
-- delete actions across the app, tagged by area, so the account owner can see
-- who did what and where. Separate from audit_events (which is destructive-only)
-- so that trail stays clean.
--
-- Owner-only read (same pattern as audit_events). Rows are inserted by server
-- code with the service-role client, which bypasses RLS.

create table if not exists activity_events (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id) on delete cascade,
  actor_id uuid references profiles(id) on delete set null,
  actor_name text not null default '',
  area text not null,          -- 'auth' | 'guests' | 'partners' | 'training' | 'staff' | 'checklists' | 'settings' | ...
  action text not null,        -- 'login' | 'created' | 'updated' | 'deleted' | 'assigned' | ...
  label text not null default '',
  created_at timestamptz not null default now()
);

create index if not exists activity_events_org_idx on activity_events(org_id, created_at desc);
create index if not exists activity_events_actor_idx on activity_events(org_id, actor_id, created_at desc);

alter table activity_events enable row level security;
create policy activity_events_select on activity_events for select
  using (org_id = current_org_id() and is_super_admin());
