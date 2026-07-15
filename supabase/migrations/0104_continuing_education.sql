-- Continuing Education: make the existing tests.rotates_monthly flag actually
-- recur. A monthly cron re-assigns every active "rotates monthly" study-quiz
-- test to staff as a FRESH attempt, so ongoing hospitality training becomes a
-- habit (a short "day one" every month) instead of a one-time program. No new
-- content model — owners just tick "Rotates monthly" on any test.
--
-- This column guards the cron so it assigns once per org per month even though
-- the job runs on a schedule.
alter table organizations add column if not exists continuing_ed_month text;
