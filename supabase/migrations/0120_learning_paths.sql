-- Learning Paths: a sequenced onboarding curriculum that bundles existing content
-- (tests, role training) plus simple tasks into an ordered path you assign to a
-- new hire, with per-step progress. Deny-all RLS — all access is via
-- permission-checked server code using the service-role client.

create table if not exists learning_paths (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id) on delete cascade,
  title text not null,
  description text not null default '',
  archived boolean not null default false,
  created_by uuid references profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists learning_path_steps (
  id uuid primary key default gen_random_uuid(),
  path_id uuid not null references learning_paths(id) on delete cascade,
  org_id uuid not null references organizations(id) on delete cascade,
  sort_order integer not null default 0,
  kind text not null,                 -- 'test' | 'training' | 'task'
  test_id uuid references tests(id) on delete set null,
  department text,                    -- for 'training' steps
  title text not null default '',
  detail text not null default ''
);

create table if not exists learning_path_assignments (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id) on delete cascade,
  path_id uuid not null references learning_paths(id) on delete cascade,
  staff_profile_id uuid not null references profiles(id) on delete cascade,
  assigned_by uuid references profiles(id) on delete set null,
  assigned_at timestamptz not null default now(),
  unique (path_id, staff_profile_id)
);

create table if not exists learning_path_progress (
  id uuid primary key default gen_random_uuid(),
  assignment_id uuid not null references learning_path_assignments(id) on delete cascade,
  step_id uuid not null references learning_path_steps(id) on delete cascade,
  completed_at timestamptz not null default now(),
  unique (assignment_id, step_id)
);

create index if not exists learning_path_steps_path_idx on learning_path_steps(path_id, sort_order);
create index if not exists learning_path_assignments_staff_idx on learning_path_assignments(staff_profile_id);
create index if not exists learning_path_assignments_path_idx on learning_path_assignments(path_id);
create index if not exists learning_path_progress_assignment_idx on learning_path_progress(assignment_id);

alter table learning_paths enable row level security;
alter table learning_path_steps enable row level security;
alter table learning_path_assignments enable row level security;
alter table learning_path_progress enable row level security;
