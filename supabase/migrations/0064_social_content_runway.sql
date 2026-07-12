-- Track when we last warned the owner that their scheduled social content is
-- running low (the furthest-out scheduled post is inside the runway window), so
-- the hourly social cron nudges them once rather than every hour.
alter table social_settings add column if not exists content_runway_alert_at timestamptz;
