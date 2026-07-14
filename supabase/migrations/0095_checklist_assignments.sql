-- Role assignment for the built-in staff-facing checklists (pre-shift, server,
-- loyalty), so an owner controls which roles each one shows up for on login —
-- the same control custom checklists already have. One row per org per built-in
-- checklist_type; an empty departments array means "all staff". No row means the
-- app's default audience for that checklist.
create table checklist_assignments (
  org_id uuid not null references organizations(id) on delete cascade,
  checklist_type text not null,
  departments text[] not null default '{}',
  updated_at timestamptz not null default now(),
  primary key (org_id, checklist_type)
);

alter table checklist_assignments enable row level security;
create policy checklist_assignments_select on checklist_assignments for select
  using (org_id = current_org_id());
create policy checklist_assignments_write on checklist_assignments for all
  using (org_id = current_org_id() and is_super_admin())
  with check (org_id = current_org_id() and is_super_admin());
