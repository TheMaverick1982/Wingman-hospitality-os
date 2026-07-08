-- Logged actuals for the Revenue Growth Planner: one row per period (week
-- or month, per the plan's frequency) so ongoing real numbers can be
-- tracked against the plan over time, not just the one-time calculator.

create table growth_plan_entries (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id) on delete cascade,
  location_id uuid references locations(id) on delete cascade,
  period_date date not null,
  customers numeric not null default 0,
  avg_sale numeric not null default 0,
  repurchase_frequency numeric not null default 0,
  created_by uuid references profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create unique index growth_plan_entries_period_all_locations_idx on growth_plan_entries(org_id, period_date) where location_id is null;
create unique index growth_plan_entries_period_location_idx on growth_plan_entries(org_id, location_id, period_date) where location_id is not null;
create index growth_plan_entries_org_id_idx on growth_plan_entries(org_id);

alter table growth_plan_entries enable row level security;

create policy growth_plan_entries_select on growth_plan_entries for select
  using (org_id = current_org_id() and is_manager_or_above() and (location_id is null or can_access_location(location_id)));
create policy growth_plan_entries_write on growth_plan_entries for all
  using (org_id = current_org_id() and is_manager_or_above() and (location_id is null or can_access_location(location_id)))
  with check (org_id = current_org_id() and is_manager_or_above() and (location_id is null or can_access_location(location_id)));
