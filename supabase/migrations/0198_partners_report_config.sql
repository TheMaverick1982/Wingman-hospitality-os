-- Configurable Partners report (replaces the monthly-only rollup).
--
-- The owner chooses the cadence (off / weekly on a chosen day / monthly), whether
-- it goes out as ONE combined email across all stores or INDIVIDUALLY (one email
-- per location), and the recipient list (as many addresses as they like). Mirrors
-- the reviews ownership recap. All additive.
alter table organizations
  add column if not exists partners_report_frequency text not null default 'monthly'
    check (partners_report_frequency in ('off', 'weekly', 'monthly')),
  add column if not exists partners_report_day integer not null default 1,  -- 0=Sun .. 6=Sat, for weekly
  add column if not exists partners_report_mode text not null default 'combined'
    check (partners_report_mode in ('combined', 'per_location')),
  add column if not exists partners_report_emails text not null default '',
  add column if not exists partners_report_sent_at timestamptz;

-- Carry the old single report email into the new recipient list so nobody who was
-- already receiving it loses it. (Data move only — additive, non-destructive.)
update organizations
  set partners_report_emails = partners_report_email
  where partners_report_email is not null
    and partners_report_email <> ''
    and partners_report_emails = '';
