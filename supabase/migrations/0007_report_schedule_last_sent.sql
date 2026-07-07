-- Tracks when each report schedule last actually sent, so the cron job
-- can tell whether a weekly/biweekly/monthly schedule is due yet.
alter table report_schedules add column last_sent_at timestamptz;
