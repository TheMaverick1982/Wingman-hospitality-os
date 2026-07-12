-- Make every guest traceable to how they were captured. The Guest Journey's
-- stage-1 "log a first-timer" quick-capture writes source='journey' and the
-- capturing staff member's name, so a first-timer caught at the door becomes a
-- real guest row (visit 1) instead of relying on someone re-typing them into
-- Bounce Back later.
alter table guests
  add column if not exists source text,
  add column if not exists captured_by text;
