-- Extend the Revenue Growth Planner with the two inputs needed to reframe
-- growth around guest lifetime value: how many years a guest stays a guest,
-- and what it costs to acquire one. LTV itself is derived (avg sale x
-- repurchase frequency x periods/yr x retained years), so only the inputs
-- are stored. Defaults keep every existing plan valid without a backfill.

alter table growth_plans
  add column retained_years numeric not null default 2,
  add column avg_acquisition_cost numeric not null default 0;
