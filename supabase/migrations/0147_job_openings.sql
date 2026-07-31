-- Job openings: saved, trackable postings for a role at a location (or all
-- locations). Each has AI-written ad copy and a pre-filled apply link; applicants
-- who come through that link are tagged back to the opening. Per-org.
create table if not exists job_openings (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id) on delete cascade,
  department app_department not null,
  location_id uuid references locations(id) on delete set null, -- null = all locations
  title text,                                                   -- optional custom headline; falls back to the role name
  ad_copy text not null default '',                             -- the job ad shown/posted (AI-drafted, owner-edited)
  pay_note text,                                                -- optional, e.g. "$18-22/hr + tips"
  employment_type text,                                         -- optional, e.g. "Full-time", "Part-time"
  status text not null default 'open',                          -- 'open' | 'closed'
  created_by uuid references profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  closed_at timestamptz
);

create index if not exists job_openings_org_idx on job_openings (org_id, status, created_at desc);

alter table job_openings enable row level security;

-- Readable by org members; writable by managers and above (mirrors screening_questions).
create policy job_openings_select on job_openings for select using (org_id = current_org_id());
create policy job_openings_write on job_openings for all
  using (org_id = current_org_id() and is_manager_or_above())
  with check (org_id = current_org_id() and is_manager_or_above());

-- Tag each application with the opening it came from (nullable; set when an
-- applicant arrives through an opening's link).
alter table job_applications add column if not exists opening_id uuid references job_openings(id) on delete set null;
create index if not exists job_applications_opening_idx on job_applications (opening_id);
