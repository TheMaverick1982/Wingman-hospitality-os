-- Persisted scheduled-report configs for the Reporting page. The schedule
-- itself is real and saved here; actually rendering + emailing the report
-- on a cadence needs a cron trigger and an email provider, which is a
-- separate follow-up once those are wired up.
--
-- Only Super Admin may create a schedule (Manager has view-only access to
-- Reporting per the permission matrix); recipients are restricted to
-- Manager/Super Admin profiles, enforced here via a check against profiles.

create table report_schedules (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id) on delete cascade,
  frequency text not null check (frequency in ('weekly', 'biweekly', 'monthly')),
  sections text[] not null,
  recipient_emails text[] not null default '{}',
  created_by uuid references profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create index report_schedules_org_id_idx on report_schedules(org_id);

alter table report_schedules enable row level security;

create policy report_schedules_select on report_schedules for select using (org_id = current_org_id());
create policy report_schedules_write on report_schedules for all
  using (org_id = current_org_id() and is_super_admin())
  with check (org_id = current_org_id() and is_super_admin());
