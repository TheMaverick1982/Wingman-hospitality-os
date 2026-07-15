-- Partners follow-up tasks. When a manager logs an activity they can schedule a
-- follow-up ("circle back in 2 weeks"); a daily cron emails the assignee when
-- one comes due. Mirrors the app's other per-feature reminder crons.

create table partner_follow_ups (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id) on delete cascade,
  contact_id uuid not null references partner_contacts(id) on delete cascade,
  location_id uuid references locations(id) on delete set null,
  -- The manager to remind (defaults to whoever created it).
  assigned_to uuid references profiles(id) on delete set null,
  due_date date not null,
  notes text not null default '',
  done boolean not null default false,
  notified_at timestamptz, -- set when the reminder email has been sent
  created_by uuid references profiles(id) on delete set null,
  created_at timestamptz not null default now()
);
create index partner_follow_ups_due_idx on partner_follow_ups(due_date) where done = false and notified_at is null;
create index partner_follow_ups_contact_idx on partner_follow_ups(contact_id);

alter table partner_follow_ups enable row level security;

create policy partner_follow_ups_select on partner_follow_ups for select
  using (org_id = current_org_id() and current_access_role() in ('super_admin', 'manager') and can_access_location(location_id));
create policy partner_follow_ups_write on partner_follow_ups for all
  using (org_id = current_org_id() and current_access_role() in ('super_admin', 'manager') and can_access_location(location_id))
  with check (org_id = current_org_id() and current_access_role() in ('super_admin', 'manager') and can_access_location(location_id));

-- Each store's timezone, so the monthly Partners report fires at 8am local for
-- that store. Defaults to US Eastern; the owner can change it per location.
alter table locations add column if not exists timezone text not null default 'America/New_York';

-- Guard so the monthly Partners report is sent once per org per month even
-- though its cron runs hourly (to hit 8am in each org's local timezone).
alter table organizations add column if not exists partners_report_month text;
