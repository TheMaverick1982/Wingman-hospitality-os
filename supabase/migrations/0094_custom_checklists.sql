-- Owner-defined checklists, assignable to one or more staff roles (departments).
-- Staff whose department is in the list (or all staff, when the list is empty)
-- get the checklist as a personal card they complete each shift — same
-- completion model as the built-in pre-shift/loyalty/server checklists.
--
-- Items live in the existing accountability_checklist_items table, keyed by
-- checklist_type = the custom checklist's id (a uuid string). Completions live in
-- shift_checklist_completions, keyed the same way. So the checklist_type CHECK
-- constraint (previously limited to the four built-ins) is dropped to allow
-- arbitrary custom ids.
create table custom_checklists (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id) on delete cascade,
  title text not null,
  departments text[] not null default '{}',  -- empty = all staff; else the assigned roles
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);
create index custom_checklists_org_idx on custom_checklists(org_id, sort_order);

alter table custom_checklists enable row level security;
create policy custom_checklists_select on custom_checklists for select
  using (org_id = current_org_id());
create policy custom_checklists_write on custom_checklists for all
  using (org_id = current_org_id() and is_super_admin())
  with check (org_id = current_org_id() and is_super_admin());

-- Allow custom checklist ids as checklist_type values on the items table.
alter table accountability_checklist_items
  drop constraint if exists accountability_checklist_items_checklist_type_check;
