-- Partners goals + monthly-report snapshots.
--
-- Goals are STANDING per-store targets (not stored per quarter): "20 new
-- contacts per quarter", etc. The quarter is just the measurement window — live
-- progress is counted from partner_activities/partner_contacts against the
-- current quarter, and the target carries forward until the owner changes it.
-- A row with location_id = null is the org-wide default; a per-location row
-- overrides it for that store. Only the account owner (super_admin) sets goals.
--
-- Snapshots freeze each store's actuals per (year, quarter) at quarter close so
-- the "Prior Years" archive is instant and immune to later edits.

-- ---------------------------------------------------------------------------
-- Standing goals
-- ---------------------------------------------------------------------------
create table partner_goals (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id) on delete cascade,
  location_id uuid references locations(id) on delete cascade, -- null = org default
  goal_new_contacts integer not null default 20,
  goal_events integer not null default 3,
  goal_fundraisers integer not null default 3,
  goal_active_connections integer not null default 20,
  updated_at timestamptz not null default now()
);
-- One org-default row, and at most one row per location.
create unique index partner_goals_org_default_key on partner_goals(org_id) where location_id is null;
create unique index partner_goals_org_location_key on partner_goals(org_id, location_id) where location_id is not null;

alter table partner_goals enable row level security;

-- Owners + managers can read goals for stores they can reach (managers see
-- their progress); only the owner writes them.
create policy partner_goals_select on partner_goals for select
  using (org_id = current_org_id() and current_access_role() in ('super_admin', 'manager') and (location_id is null or can_access_location(location_id)));
create policy partner_goals_write on partner_goals for all
  using (org_id = current_org_id() and is_super_admin())
  with check (org_id = current_org_id() and is_super_admin());

-- ---------------------------------------------------------------------------
-- Quarter-close snapshots
-- ---------------------------------------------------------------------------
create table partner_metrics_snapshots (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id) on delete cascade,
  location_id uuid references locations(id) on delete cascade,
  year integer not null,
  quarter integer not null check (quarter between 1 and 4),
  total_contacts integer not null default 0,
  new_contacts integer not null default 0,
  active_connections integer not null default 0,
  events_booked integer not null default 0,
  fundraisers_booked integer not null default 0,
  revenue_cents integer not null default 0,
  snapshot_at timestamptz not null default now()
);
create unique index partner_snapshots_key on partner_metrics_snapshots(org_id, location_id, year, quarter);

alter table partner_metrics_snapshots enable row level security;

-- Read-only to owners/managers for stores they can reach; writes happen via the
-- service-role cron (which bypasses RLS), plus the owner for manual backfill.
create policy partner_snapshots_select on partner_metrics_snapshots for select
  using (org_id = current_org_id() and current_access_role() in ('super_admin', 'manager') and (location_id is null or can_access_location(location_id)));
create policy partner_snapshots_write on partner_metrics_snapshots for all
  using (org_id = current_org_id() and is_super_admin())
  with check (org_id = current_org_id() and is_super_admin());

-- ---------------------------------------------------------------------------
-- Configurable recipient for the monthly Partners rollup (accounting / HR /
-- leadership). Customer-editable, so deliberately NOT on protect_org_pricing.
-- ---------------------------------------------------------------------------
alter table organizations add column partners_report_email text;
