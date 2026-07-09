-- Weekly business-health inputs pushed from a POS integration (via the API).
--
-- The dashboard "Business health" card derives its ratios (revenue/seat,
-- revenue/labor hour, labor %, avg check, comp cost, retention $ impact) from
-- these RAW inputs, so every integration pushes the same primitive numbers and
-- Wingman does the math consistently.
--
-- One row per (org, location, week). location_id null = an org-wide row. Mirrors
-- the growth_plan_entries partial-unique-index pattern so the API can upsert by
-- (org, location, period_date).

create table business_health_metrics (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id) on delete cascade,
  location_id uuid references locations(id) on delete cascade,
  period_date date not null,                 -- the week the numbers are for (any day in it)
  net_sales numeric not null default 0,      -- gross/net sales for the period
  labor_cost numeric not null default 0,     -- total labor dollars
  labor_hours numeric not null default 0,    -- total labor hours worked
  comp_cost numeric not null default 0,      -- comps / voids / discounts dollars
  covers integer not null default 0,         -- guests served
  checks integer not null default 0,         -- number of checks / transactions
  seats integer,                             -- physical seat count (optional; falls back to covers)
  created_by uuid references profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

-- Exactly one org-wide row per week, and at most one row per real location per week.
create unique index business_health_period_all_locations_idx
  on business_health_metrics(org_id, period_date) where location_id is null;
create unique index business_health_period_location_idx
  on business_health_metrics(org_id, location_id, period_date) where location_id is not null;
create index business_health_org_id_idx on business_health_metrics(org_id);

alter table business_health_metrics enable row level security;

create policy business_health_metrics_select on business_health_metrics for select
  using (org_id = current_org_id() and is_manager_or_above() and (location_id is null or can_access_location(location_id)));
create policy business_health_metrics_write on business_health_metrics for all
  using (org_id = current_org_id() and is_manager_or_above() and (location_id is null or can_access_location(location_id)))
  with check (org_id = current_org_id() and is_manager_or_above() and (location_id is null or can_access_location(location_id)));
