-- Guest Survey (feature #3, Phase 1): collect guest experience feedback via a
-- per-location QR / short link (/s/<code>), stored in its own Guest Reviews
-- archive. Deliberately SEPARATE from Guest Bounce Back: a survey response never
-- creates a guest and never counts as a visit. The only crossover is a
-- match-ONLY link — if the optional contact matches a guest already in Bounce
-- Back, we tag matched_guest_id; otherwise it just lives here.

-- One shareable survey link per location (QR + short URL), with scan tracking —
-- mirrors the job-openings short-link engine.
create table guest_survey_links (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id) on delete cascade,
  location_id uuid not null references locations(id) on delete cascade,
  code text unique,
  scan_count integer not null default 0,
  created_at timestamptz not null default now()
);
create unique index guest_survey_links_location_idx on guest_survey_links(location_id);
create index guest_survey_links_org_idx on guest_survey_links(org_id);

alter table guest_survey_links enable row level security;
-- Managers/owners read their org's links (to show the QR + short link). Links
-- are created server-side via the service-role client, so no write policy here.
create policy guest_survey_links_select on guest_survey_links for select
  using (org_id = current_org_id() and is_manager_or_above());

-- The Guest Reviews archive: every survey response lives here and nowhere else.
create table guest_survey_responses (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id) on delete cascade,
  location_id uuid references locations(id) on delete set null,
  -- Which FOH staff member the guest said served them (first name shown; nullable).
  server_staff_id uuid references staff_members(id) on delete set null,
  ratings jsonb not null default '{}'::jsonb,   -- { food: 5, service: 4, return: 5 }
  comment text not null default '',
  contact text not null default '',             -- optional email/phone the guest left
  -- Match-ONLY link to Bounce Back: set only if the contact matches a guest that
  -- already exists. A survey NEVER creates a guest.
  matched_guest_id uuid references guests(id) on delete set null,
  sentiment text,                               -- AI-derived later (Phase 2); null for now
  created_at timestamptz not null default now(),
  deleted_at timestamptz                        -- soft delete only
);
create index guest_survey_responses_org_idx on guest_survey_responses(org_id, created_at desc);
create index guest_survey_responses_location_idx on guest_survey_responses(location_id, created_at desc);

alter table guest_survey_responses enable row level security;
-- Managers/owners read their org's responses. Responses are inserted by the
-- public survey form through the service-role client (no user session), so no
-- write policy is needed here.
create policy guest_survey_responses_select on guest_survey_responses for select
  using (org_id = current_org_id() and is_manager_or_above());
