-- Shift Hub, Slice 2: post-shift staff feedback. At the end of a shift a team
-- member takes 30 seconds to reflect — what went well, what to improve, and
-- anything guests said — and it reports to that location's managers. business_day
-- is the local calendar day at the location (see src/lib/local-date.ts) so the
-- manager feed groups by shift day. staff_id/department are captured for the
-- manager view; author_id links the submitter's login for their own read-back.
create table shift_feedback (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id) on delete cascade,
  location_id uuid not null references locations(id) on delete cascade,
  staff_id uuid references staff_members(id) on delete set null,
  author_id uuid references profiles(id) on delete set null,
  author_name text not null default '',
  department text not null default '',
  went_well text not null default '',
  improve text not null default '',
  guest_notes text not null default '',
  business_day date not null,
  created_at timestamptz not null default now(),
  deleted_at timestamptz                -- soft delete only
);
create index shift_feedback_loc_day_idx on shift_feedback(location_id, business_day desc, created_at desc);
create index shift_feedback_org_day_idx on shift_feedback(org_id, business_day desc);
create index shift_feedback_author_idx on shift_feedback(author_id, business_day desc);

alter table shift_feedback enable row level security;
-- Managers/shift-leads read their team's reflections; a submitter can read their
-- own back (so the page can show "you already checked in today").
create policy shift_feedback_select on shift_feedback for select
  using (org_id = current_org_id() and (is_manager_or_above() or author_id = auth.uid()));
-- Any team member in the org can submit their own reflection.
create policy shift_feedback_insert on shift_feedback for insert
  with check (org_id = current_org_id() and author_id = auth.uid());
-- Only managers/shift-leads can edit (e.g. soft-delete) a reflection.
create policy shift_feedback_write on shift_feedback for update
  using (org_id = current_org_id() and is_manager_or_above())
  with check (org_id = current_org_id() and is_manager_or_above());
