-- A logged touch can also move the relationship forward: set the outreach
-- status and who it's handed off to. Record what each touch changed them to, so
-- the contact's timeline keeps the history; the contact's current value is
-- updated alongside (latest wins). Both nullable/additive.
alter table partner_activities
  add column if not exists set_status text
    check (set_status is null or set_status in ('no_answer', 'follow_up', 'booked', 'not_interested')),
  add column if not exists set_handoff text;
