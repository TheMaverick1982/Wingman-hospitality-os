-- Let a rep mark how a booked demo actually went (showed / no-show) so it can
-- drive the CRM (advance to Demo Completed, or start the no-show re-engagement).
-- Kept separate from `status` (confirmed/cancelled) so the reminders index — which
-- keys on status='confirmed' — is untouched. Additive + nullable.
alter table calendar_bookings add column if not exists outcome text check (outcome in ('showed', 'no_show'));
alter table calendar_bookings add column if not exists outcome_at timestamptz;
