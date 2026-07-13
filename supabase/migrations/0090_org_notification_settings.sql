-- Per-account notification preferences: which of Wingman's automatic emails the
-- account wants to receive. A key set to false means "don't send this one"; a
-- missing key means the default (on). Managers and owners edit this in Settings.
alter table organizations
  add column if not exists notification_settings jsonb not null default '{}'::jsonb;
