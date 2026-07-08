-- The Standout Audit + 5-Gap Diagnosis: the front-door scorecard of the
-- Regulars Operating System. One walkthrough produces a Health Score (the
-- 5-Gap Diagnosis) and an Audit Score (the weighted 7-domain guest-experience
-- read), plus a written action plan. Scored per location; manager-or-above
-- only, matching the other planning/leadership-sensitive sections (Growth,
-- Reporting) -- hidden from Staff.

create table audits (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id) on delete cascade,
  location_id uuid references locations(id) on delete set null,
  occurred_on date not null default current_date,
  gap_scores smallint[] not null,
  domain_scores smallint[] not null,
  health_score smallint not null check (health_score between 0 and 100),
  audit_score smallint not null check (audit_score between 0 and 100),
  action_plan text not null default '',
  created_by uuid references profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create index audits_org_id_idx on audits(org_id);
create index audits_org_location_idx on audits(org_id, location_id);

alter table audits enable row level security;

create policy audits_select on audits for select
  using (org_id = current_org_id() and is_manager_or_above() and (location_id is null or can_access_location(location_id)));
create policy audits_insert on audits for insert
  with check (org_id = current_org_id() and is_manager_or_above() and (location_id is null or can_access_location(location_id)));
create policy audits_delete on audits for delete
  using (org_id = current_org_id() and is_manager_or_above() and (location_id is null or can_access_location(location_id)));
