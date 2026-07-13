-- Momentum stall nudge. Track when we last nudged an owner whose usage has gone
-- quiet, and how many we've sent, so the daily cron emails a stalled org at most
-- once a week and backs off after a handful (never harass). Columns on
-- organizations (service-role cron reads/writes them); no policy change needed.
alter table organizations add column if not exists momentum_nudge_sent_at timestamptz;
alter table organizations add column if not exists momentum_nudge_count int not null default 0;
