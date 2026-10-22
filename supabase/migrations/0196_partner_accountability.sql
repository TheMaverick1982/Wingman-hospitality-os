-- Partners accountability fields (Phase 1).
--
-- Richer per-contact tracking so the team can be held accountable and the
-- relationship can be filtered/reported on: an outreach pipeline status, the
-- interests a partner has expressed, who the contact was handed off to, and the
-- agreed next step. Plus event specifics on a booking. All additive.

-- 1. partner_contacts: pipeline status + interest tags + hand-off + next step.
alter table partner_contacts
  add column if not exists outreach_status text not null default 'none'
    check (outreach_status in ('none', 'no_answer', 'follow_up', 'booked', 'not_interested')),
  add column if not exists interested_in jsonb not null default '[]'::jsonb,
  add column if not exists handed_off_to text not null default '',
  add column if not exists next_step text not null default '';

-- 2. partner_activities: capture the booking's event date + headcount, and widen
--    the loggable touch types with Visit and In-store guest. Rebuild the CHECK to
--    keep the full set (0176 added 'note'; this adds 'visit' + 'in_store_guest').
alter table partner_activities
  add column if not exists event_date date,
  add column if not exists headcount integer;

alter table partner_activities drop constraint if exists partner_activities_activity_type_check;
alter table partner_activities
  add constraint partner_activities_activity_type_check
  check (activity_type in ('call_text', 'email', 'meeting', 'visit', 'in_store_guest', 'event_booked', 'fundraiser_booked', 'note'));

-- 3. Configurable hand-off targets: who a contact can be handed to (a manager or
--    department). A company-wide default set (location_id null) plus optional
--    per-location entries. Owner-managed; managers only read it for the dropdown.
create table if not exists partner_handoff_targets (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id) on delete cascade,
  location_id uuid references locations(id) on delete cascade,  -- null = org-wide
  label text not null,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists partner_handoff_targets_org_idx on partner_handoff_targets(org_id, location_id);

alter table partner_handoff_targets enable row level security;
-- Read: any Partners user (super_admin/manager) for org-wide rows or a reachable
-- location — so the hand-off dropdown populates when logging a contact.
create policy partner_handoff_targets_select on partner_handoff_targets for select
  using (
    org_id = current_org_id()
    and current_access_role() in ('super_admin', 'manager')
    and (location_id is null or can_access_location(location_id))
  );
-- Write: owner only (the list is a company-wide accountability config).
create policy partner_handoff_targets_write on partner_handoff_targets for all
  using (org_id = current_org_id() and is_super_admin())
  with check (org_id = current_org_id() and is_super_admin());
