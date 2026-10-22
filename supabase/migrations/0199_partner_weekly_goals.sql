-- Weekly activity goals for the Partners weekly report: how many contacts to
-- reach and how many in-person visits to make each week. Per-location overrides
-- plus the org-wide default row, same as the quarterly goals. Additive.
alter table partner_goals
  add column if not exists goal_weekly_reach integer not null default 7,
  add column if not exists goal_weekly_visits integer not null default 3;
