-- Applicant replies: let a manager send a first-class "we're interested, we'll
-- reach out" or a polite "not a good fit at the moment" note to an applicant, so
-- people who apply actually hear back. We record which reply went out and when,
-- so the UI can show it was sent and avoid accidental double-sends. Additive,
-- nullable columns — no backfill, safe on live data.
alter table job_applications add column if not exists reply_sent_kind text;
alter table job_applications add column if not exists reply_sent_at timestamptz;
