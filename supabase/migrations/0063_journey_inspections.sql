-- Per-stage inspection log for the Guest Journey. Each stage defines a yes/no
-- "manager inspects" standard; this records whether that standard was met on a
-- given spot-check, so the journey stops being a static poster and starts
-- showing whether the mapped standard is actually happening. Org-scoped RLS like
-- journey_stages (managers+ write).
create table journey_inspections (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id) on delete cascade,
  stage_id uuid not null references journey_stages(id) on delete cascade,
  location_id uuid references locations(id) on delete set null,
  passed boolean not null,            -- was the stage's inspect standard met?
  note text,
  checked_by text,                    -- who logged it
  created_at timestamptz not null default now()
);
create index journey_inspections_stage_idx on journey_inspections (stage_id, created_at);
create index journey_inspections_org_idx on journey_inspections (org_id, created_at);

alter table journey_inspections enable row level security;
create policy journey_inspections_select on journey_inspections for select
  using (org_id = current_org_id());
create policy journey_inspections_write on journey_inspections for all
  using (org_id = current_org_id() and is_manager_or_above())
  with check (org_id = current_org_id() and is_manager_or_above());
