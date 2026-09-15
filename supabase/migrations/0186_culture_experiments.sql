-- Close the weekly-experiment loop. The weekly experiment (organizations.weekly_experiment)
-- was a write-only text field: an owner set a test for the week and it was silently
-- overwritten next time, so there was no record of what was tried or whether it
-- worked. This adds a log so recording an outcome ("did it work?") archives the
-- experiment with a result and builds a history the team can learn from.
--
-- Additive and back-compatible: a brand-new table, nothing existing is touched.
-- organizations.weekly_experiment stays the "currently running" experiment;
-- recording an outcome moves it into this log and clears the field for the next.
create table if not exists culture_experiments (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id) on delete cascade,
  hypothesis text not null,                 -- what the experiment was
  outcome text,                             -- 'worked' | 'no_change' | 'mixed' (null while running)
  outcome_note text,                        -- optional "what we learned"
  started_on date not null default current_date,
  closed_on date,
  created_by uuid references profiles(id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists culture_experiments_org_idx on culture_experiments(org_id);

alter table culture_experiments enable row level security;

-- Everyone in the org can read the experiment history (it shows on Culture);
-- only managers/owners create, update, or remove entries.
create policy culture_experiments_select on culture_experiments for select
  using (org_id = current_org_id());
create policy culture_experiments_insert on culture_experiments for insert
  with check (org_id = current_org_id() and is_manager_or_above());
create policy culture_experiments_update on culture_experiments for update
  using (org_id = current_org_id() and is_manager_or_above());
create policy culture_experiments_delete on culture_experiments for delete
  using (org_id = current_org_id() and is_manager_or_above());
