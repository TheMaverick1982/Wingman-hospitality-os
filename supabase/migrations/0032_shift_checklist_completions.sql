-- Per-staff pre-shift checklist completions.
--
-- Unlike daily_checklists / pre_shift_checks (which a MANAGER runs for a whole
-- location), this records that an INDIVIDUAL staff member completed their own
-- pre-shift checklist, tied to their login. One row per person per day per
-- checklist type.
--
-- Accountability model: completion is the signal. We never assume who was
-- "supposed" to work (Wingman has no schedule), so the report is built from who
-- actually completed — nobody is flagged missing just for an off day.

create table shift_checklist_completions (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id) on delete cascade,
  location_id uuid references locations(id) on delete set null,
  profile_id uuid not null references profiles(id) on delete cascade,
  checklist_type text not null default 'preshift',
  occurred_on date not null default current_date,
  checked boolean[] not null default '{}',
  item_count integer not null default 0,
  completed_count integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- One completion per person, per checklist type, per day (re-submitting updates it).
create unique index shift_checklist_completions_unique_idx
  on shift_checklist_completions(profile_id, checklist_type, occurred_on);
create index shift_checklist_completions_org_occurred_idx
  on shift_checklist_completions(org_id, occurred_on desc);

alter table shift_checklist_completions enable row level security;

-- A staff member can see and write their OWN completions. Managers and above can
-- see everyone's within their org, scoped to locations they can access.
create policy scc_select on shift_checklist_completions for select
  using (
    org_id = current_org_id()
    and (
      profile_id = auth.uid()
      or (is_manager_or_above() and (location_id is null or can_access_location(location_id)))
    )
  );
create policy scc_insert on shift_checklist_completions for insert
  with check (org_id = current_org_id() and profile_id = auth.uid());
create policy scc_update on shift_checklist_completions for update
  using (org_id = current_org_id() and profile_id = auth.uid())
  with check (org_id = current_org_id() and profile_id = auth.uid());
