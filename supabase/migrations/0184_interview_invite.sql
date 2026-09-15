-- Editable interview-invitation email. When a manager books an interview, the
-- applicant is emailed the date, time, location and a "call if something changes"
-- note. Like the applicant reply emails, the copy is per-org editable.
--   organizations.interview_invite_template  jsonb   { subject, body } (null = defaults)
--   job_applications.interview_invite_sent_at timestamptz  when the invite last went out
-- Both additive and nullable — existing orgs use the built-in default copy, and
-- existing applications are untouched.
alter table organizations add column if not exists interview_invite_template jsonb;
alter table job_applications add column if not exists interview_invite_sent_at timestamptz;
