-- Three new Accountability features from the design_v2 handoff:
-- coaching-flag resolution logging (State -> Story -> Strategy), a
-- per-shift hospitality pre-shift check, and an ambiance/first-impression
-- check of the physical space. All location-scoped like the existing
-- accountability tables (spot_checks, daily_checklists).

create table coaching_logs (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id) on delete cascade,
  location_id uuid not null references locations(id) on delete cascade,
  flag_text text not null,
  strategy_note text not null default '',
  occurred_on date not null default current_date,
  created_by uuid references profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create table pre_shift_checks (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id) on delete cascade,
  location_id uuid not null references locations(id) on delete cascade,
  staff_name text not null,
  department app_department not null,
  checked boolean[] not null,
  occurred_on date not null default current_date,
  created_by uuid references profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create table ambiance_checks (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id) on delete cascade,
  location_id uuid not null references locations(id) on delete cascade,
  scores smallint[] not null,
  notes text not null default '',
  occurred_on date not null default current_date,
  created_by uuid references profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create index coaching_logs_org_location_idx on coaching_logs(org_id, location_id);
create index pre_shift_checks_org_location_idx on pre_shift_checks(org_id, location_id);
create index ambiance_checks_org_location_idx on ambiance_checks(org_id, location_id);

alter table coaching_logs enable row level security;
alter table pre_shift_checks enable row level security;
alter table ambiance_checks enable row level security;

create policy coaching_logs_select on coaching_logs for select
  using (org_id = current_org_id() and can_access_location(location_id));
create policy coaching_logs_insert on coaching_logs for insert
  with check (org_id = current_org_id() and can_access_location(location_id) and is_manager_or_above());

create policy pre_shift_checks_select on pre_shift_checks for select
  using (org_id = current_org_id() and can_access_location(location_id));
create policy pre_shift_checks_insert on pre_shift_checks for insert
  with check (org_id = current_org_id() and can_access_location(location_id) and is_manager_or_above());

create policy ambiance_checks_select on ambiance_checks for select
  using (org_id = current_org_id() and can_access_location(location_id));
create policy ambiance_checks_insert on ambiance_checks for insert
  with check (org_id = current_org_id() and can_access_location(location_id) and is_manager_or_above());
