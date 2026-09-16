-- Staff Culture Pulse: an anonymous monthly check-in from the team — the leading
-- indicator of retention (do they feel recognized, are the values clear, are they
-- proud to work here). Responses carry NO staff identity. A separate marker table
-- records only THAT a person checked in this period (never what they said), so we
-- can prevent double-submits without ever de-anonymizing an answer.
create table if not exists culture_pulse_responses (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id) on delete cascade,
  location_id uuid references locations(id) on delete set null,
  period text not null,             -- 'YYYY-MM'
  recognized smallint,              -- 1-5 (I feel recognized for good work)
  values_clear smallint,            -- 1-5 (I'm clear on what we stand for)
  proud smallint,                   -- 1-5 (I'm proud to work here)
  comment text,
  created_at timestamptz not null default now()
);
create index if not exists culture_pulse_responses_org_period_idx on culture_pulse_responses(org_id, period);

create table if not exists culture_pulse_submissions (
  org_id uuid not null references organizations(id) on delete cascade,
  user_id uuid not null references profiles(id) on delete cascade,
  period text not null,
  created_at timestamptz not null default now(),
  primary key (org_id, user_id, period)
);

alter table culture_pulse_responses enable row level security;
alter table culture_pulse_submissions enable row level security;

-- Anyone in the org can submit a response (no identity stored on it); only
-- managers/owners read the aggregate — never who said what.
create policy cpr_insert on culture_pulse_responses for insert
  with check (org_id = current_org_id());
create policy cpr_select on culture_pulse_responses for select
  using (org_id = current_org_id() and is_manager_or_above());

-- The marker is private to each person: they record and see only their own
-- check-in, so a manager can't correlate it back to a response.
create policy cps_insert on culture_pulse_submissions for insert
  with check (org_id = current_org_id() and user_id = auth.uid());
create policy cps_select on culture_pulse_submissions for select
  using (org_id = current_org_id() and user_id = auth.uid());
