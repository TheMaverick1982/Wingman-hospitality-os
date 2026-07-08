-- Two operator-authored culture fields:
--   x_factor         -- the one thing this restaurant does better than anyone,
--                       that the whole team should reinforce (Robbins' X-Factor).
--   weekly_experiment -- one small test to run this week (the CANI / constant-
--                       improvement habit), alongside the existing weekly focus.
-- Both default to empty so existing orgs stay valid.

alter table organizations
  add column x_factor text not null default '',
  add column weekly_experiment text not null default '';
