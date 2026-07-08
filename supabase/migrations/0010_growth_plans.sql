-- Revenue Growth Planner: the classic "10/10/10" compounding-growth
-- calculator (Total = # customers x avg $ per sale x repurchase frequency).
-- One row per location, plus an optional org-wide row (location_id null)
-- for "All Locations". Manager-or-above only, per the design's revenue/
-- planning-sensitive sections (matches Reporting/Hiring, hidden from Staff).

create table growth_plans (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id) on delete cascade,
  location_id uuid references locations(id) on delete cascade,
  frequency text not null default 'monthly' check (frequency in ('weekly', 'monthly')),
  current_customers numeric not null default 0,
  current_avg_sale numeric not null default 0,
  current_repurchase_frequency numeric not null default 0,
  target_customers_pct numeric not null default 20,
  target_avg_sale_pct numeric not null default 20,
  target_frequency_pct numeric not null default 20,
  updated_by uuid references profiles(id) on delete set null,
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

-- Partial unique indexes: exactly one org-wide row (location_id null) and
-- at most one row per real location.
create unique index growth_plans_org_all_locations_idx on growth_plans(org_id) where location_id is null;
create unique index growth_plans_org_location_idx on growth_plans(org_id, location_id) where location_id is not null;
create index growth_plans_org_id_idx on growth_plans(org_id);

alter table growth_plans enable row level security;

create policy growth_plans_select on growth_plans for select
  using (org_id = current_org_id() and is_manager_or_above() and (location_id is null or can_access_location(location_id)));
create policy growth_plans_write on growth_plans for all
  using (org_id = current_org_id() and is_manager_or_above() and (location_id is null or can_access_location(location_id)))
  with check (org_id = current_org_id() and is_manager_or_above() and (location_id is null or can_access_location(location_id)));
