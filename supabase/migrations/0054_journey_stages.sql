-- Guest Journey Map: the guest experience broken into ordered stages (arrival →
-- the ask), each with the standard, an example script, and the one thing a
-- manager inspects. AI-generated per concept; becomes the backbone the team
-- trains on and gets spot-checked against. Org-scoped RLS like the rest of the
-- operating system (managers+ edit).

create table journey_stages (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id) on delete cascade,
  sort_order int not null default 0,
  name text not null,                 -- e.g. "Arrival", "The Greet", "The Ask"
  purpose text not null default '',   -- why this moment matters (1 sentence)
  avoid text not null default '',     -- the common mistake / anti-pattern
  standard text not null default '',  -- the non-negotiable, observable behavior
  script text not null default '',    -- an example of what to say / do
  inspect text not null default '',   -- what a manager watches for (spot-check point)
  timing text not null default '',    -- optional timing standard
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index journey_stages_org_idx on journey_stages (org_id, sort_order);

alter table journey_stages enable row level security;
create policy journey_stages_select on journey_stages for select
  using (org_id = current_org_id());
create policy journey_stages_write on journey_stages for all
  using (org_id = current_org_id() and is_manager_or_above())
  with check (org_id = current_org_id() and is_manager_or_above());
