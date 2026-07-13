-- Weekly 3-moves commitment. One row per org per week holds up to three moves
-- the owner committed to, each with a done flag. Owners set and tick them; the
-- dashboard shows this week's progress.
create table weekly_commitments (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id) on delete cascade,
  week_start date not null,
  moves jsonb not null default '[]',
  created_by uuid references profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (org_id, week_start)
);

create index weekly_commitments_org_idx on weekly_commitments(org_id);

alter table weekly_commitments enable row level security;

-- Anyone in the org can see the week's moves; only the owner (Super Admin) sets
-- or ticks them — mirrors report_schedules.
create policy weekly_commitments_select on weekly_commitments for select using (org_id = current_org_id());
create policy weekly_commitments_write on weekly_commitments for all
  using (org_id = current_org_id() and is_super_admin())
  with check (org_id = current_org_id() and is_super_admin());
