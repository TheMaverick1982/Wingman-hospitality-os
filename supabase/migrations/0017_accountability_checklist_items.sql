-- Editable checklist "templates" for Accountability, mirroring
-- department_standards: a per-org, per-type list of item labels used by the
-- Manager daily checklist and Pre-shift staff checklist modals, instead of
-- a fixed hardcoded list. Falls back to the app's built-in defaults
-- (lib/constants.ts) when an org has no rows yet, so no backfill is
-- required. Only the Super Admin can edit these -- unlike Training/Hiring
-- where Managers can too -- since this reshapes what the whole account is
-- measured against.
create table accountability_checklist_items (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id) on delete cascade,
  checklist_type text not null check (checklist_type in ('daily', 'preshift')),
  item text not null,
  sort_order int not null default 0,
  source text not null default 'custom' check (source in ('wingman', 'custom')),
  created_at timestamptz not null default now()
);
create index accountability_checklist_items_org_type_idx on accountability_checklist_items(org_id, checklist_type);

alter table accountability_checklist_items enable row level security;
create policy accountability_checklist_items_select on accountability_checklist_items for select
  using (org_id = current_org_id());
create policy accountability_checklist_items_write on accountability_checklist_items for all
  using (org_id = current_org_id() and is_super_admin())
  with check (org_id = current_org_id() and is_super_admin());
