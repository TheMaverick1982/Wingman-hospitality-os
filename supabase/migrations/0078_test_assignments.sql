-- Phase 2 of Training tests: assigning a test to staff, taking it day by day,
-- auto-scoring, retakes, and lock-on-exhausted-retakes (which alerts a manager).
--
-- One assignment per (test, staff member). The take-the-test flow runs through a
-- service-role server action guarded in app code, so a staff member can only
-- ever touch their OWN assignment — that's why staff aren't granted direct
-- SELECT/UPDATE here (managers manage everything through RLS).

create table test_assignments (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id) on delete cascade,
  test_id uuid not null references tests(id) on delete cascade,
  staff_id uuid not null references staff_members(id) on delete cascade,
  -- The location this test was taken for; the lock alert routes to its email.
  location_id uuid references locations(id) on delete set null,
  assigned_by uuid references profiles(id) on delete set null,
  assigned_at timestamptz not null default now(),
  due_at timestamptz,
  status text not null default 'assigned' check (status in ('assigned', 'in_progress', 'passed', 'locked')),
  current_day smallint not null default 1,
  attempts_used smallint not null default 0,
  answers jsonb not null default '{}'::jsonb, -- question_id -> chosen option index (current attempt)
  best_score smallint,
  last_score smallint,
  passed_at timestamptz,
  locked_at timestamptz,
  locked_alerted boolean not null default false, -- so the manager is alerted once per lock
  due_alerted boolean not null default false, -- so the overdue-coaching alert fires once
  unlocked_by uuid references profiles(id) on delete set null,
  unlocked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (test_id, staff_id)
);
create index test_assignments_test_idx on test_assignments (test_id);
create index test_assignments_staff_idx on test_assignments (staff_id);
create index test_assignments_org_idx on test_assignments (org_id);

alter table test_assignments enable row level security;
create policy test_assignments_select on test_assignments for select
  using (org_id = current_org_id() and is_manager_or_above());
create policy test_assignments_write on test_assignments for all
  using (org_id = current_org_id() and is_manager_or_above())
  with check (org_id = current_org_id() and is_manager_or_above());
