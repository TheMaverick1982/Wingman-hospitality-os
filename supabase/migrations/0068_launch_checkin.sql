-- Weekly Launch Plan accountability email. Track the last time we nudged an
-- owner about their 14-day launch, and how many nudges we've sent, so the daily
-- cron emails each org at most once a week and stops after a handful. Columns on
-- organizations (service-role cron reads/writes them); no policy change needed.
alter table organizations add column if not exists launch_checkin_sent_at timestamptz;
alter table organizations add column if not exists launch_checkin_count int not null default 0;
