-- URGENT FIX: interview scheduling errors in production with
--   "Could not find the 'interview_at' column of 'job_applications'".
--
-- 0087_application_interviews.sql added interview_at / interview_details and
-- widened the status check to include 'interviewing', but on the production
-- database those columns are missing — 0087 was marked applied by the one-time
-- baseline without its DDL ever actually running against the live schema, so the
-- migrator skips it forever. This migration has a fresh filename, so it WILL run,
-- and every statement is idempotent (`if not exists` / drop-then-add), so it's a
-- no-op on any database where 0087 did land correctly.

alter table job_applications add column if not exists interview_at timestamptz;
alter table job_applications add column if not exists interview_details text not null default '';

alter table job_applications drop constraint if exists job_applications_status_check;
alter table job_applications add constraint job_applications_status_check
  check (status in ('new', 'contacted', 'interviewing', 'not_a_fit', 'hired'));

create index if not exists job_applications_interview_idx on job_applications(interview_at) where status = 'interviewing';

-- The reported error is a PostgREST *schema cache* miss: even once the column
-- exists, the API layer serves a stale schema until it reloads. Force a reload so
-- the fix is live immediately instead of on the next periodic refresh.
notify pgrst, 'reload schema';
