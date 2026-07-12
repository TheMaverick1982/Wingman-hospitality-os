-- Track when a "commission is due to pay" reminder was emailed for a line, so the
-- daily cron nudges the owner exactly once per commission as it comes due
-- (instead of re-emailing the same owed items every day).
alter table sales_commissions add column if not exists due_reminder_sent_at timestamptz;
