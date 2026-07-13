-- A before-deadline reminder to the trainee (the person taking the test), so a
-- test — especially a multi-day one — gets finished in time. This is separate
-- from due_alerted, which alerts the MANAGER after the deadline has passed.
alter table test_assignments
  add column if not exists reminder_alerted boolean not null default false;
