-- The Hospitality Score: the owner's periodic 10-statement self-assessment
-- (0-100). Each submission is stored so the score can be tracked over time and
-- retaken quarterly to show a trendline. Read by managers and above; only the
-- owner (super_admin) submits.
create table if not exists public.hospitality_assessments (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id) on delete cascade,
  created_by uuid,
  scores jsonb not null default '[]'::jsonb, -- array of 10 integers, each 1-10
  total integer not null default 0,          -- 0-100
  created_at timestamptz not null default now()
);
create index if not exists hospitality_assessments_org_idx on public.hospitality_assessments(org_id, created_at desc);

alter table public.hospitality_assessments enable row level security;

-- Managers and above can read their org's history; only the owner records one.
drop policy if exists hospitality_assessments_select on public.hospitality_assessments;
create policy hospitality_assessments_select on public.hospitality_assessments
  for select using (org_id = current_org_id() and is_manager_or_above());

drop policy if exists hospitality_assessments_insert on public.hospitality_assessments;
create policy hospitality_assessments_insert on public.hospitality_assessments
  for insert with check (org_id = current_org_id() and is_super_admin() and created_by = auth.uid());
