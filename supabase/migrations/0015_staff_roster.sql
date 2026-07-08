-- Staff directory: a real roster of people (not login accounts) so Training
-- can track per-person progress/notes and Hiring can hand a hired candidate
-- straight into it.
create table staff_members (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id) on delete cascade,
  location_id uuid not null references locations(id) on delete cascade,
  candidate_id uuid references candidates(id) on delete set null,
  full_name text not null,
  department app_department not null,
  email text not null default '',
  phone text not null default '',
  status text not null default 'active' check (status in ('active', 'inactive')),
  hired_on date,
  created_at timestamptz not null default now()
);
create index staff_members_org_location_idx on staff_members(org_id, location_id);

alter table staff_members enable row level security;
create policy staff_members_select on staff_members for select
  using (org_id = current_org_id() and can_access_location(location_id));
create policy staff_members_write on staff_members for all
  using (org_id = current_org_id() and is_manager_or_above() and can_access_location(location_id))
  with check (org_id = current_org_id() and is_manager_or_above() and can_access_location(location_id));

-- Per-person, per-checklist-item training progress: checked state, a
-- strong/needs-coaching read, and a free-text note. item_id points at
-- either department_standards.id or department_training_items.id, picked
-- by item_type -- no FK possible across the two, matched in application code.
create table staff_training_progress (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id) on delete cascade,
  staff_id uuid not null references staff_members(id) on delete cascade,
  item_type text not null check (item_type in ('standard', 'training')),
  item_id uuid not null,
  checked boolean not null default false,
  rating text not null default '' check (rating in ('', 'strong', 'coaching')),
  note text not null default '',
  updated_at timestamptz not null default now(),
  unique (staff_id, item_type, item_id)
);
create index staff_training_progress_staff_idx on staff_training_progress(staff_id);

alter table staff_training_progress enable row level security;
create policy staff_training_progress_select on staff_training_progress for select
  using (
    org_id = current_org_id()
    and can_access_location((select sm.location_id from staff_members sm where sm.id = staff_id))
  );
create policy staff_training_progress_write on staff_training_progress for all
  using (
    org_id = current_org_id() and is_manager_or_above()
    and can_access_location((select sm.location_id from staff_members sm where sm.id = staff_id))
  )
  with check (
    org_id = current_org_id() and is_manager_or_above()
    and can_access_location((select sm.location_id from staff_members sm where sm.id = staff_id))
  );

-- Ties a sign-off record to the real staff record it was logged for
-- (nullable, since pre-existing sign-offs predate the roster and only have
-- the free-text staff_name).
alter table training_signoffs add column staff_id uuid references staff_members(id) on delete set null;
