-- Let a partner activity be a plain "note" so notes stack on a contact's timeline
-- (a dated history of every touch) instead of overwriting the single notes field.
-- Widen the existing activity_type check to include 'note' — additive (a larger
-- allowed set), no data change.
alter table partner_activities drop constraint if exists partner_activities_activity_type_check;
alter table partner_activities
  add constraint partner_activities_activity_type_check
  check (activity_type in ('call_text', 'email', 'meeting', 'event_booked', 'fundraiser_booked', 'note'));
