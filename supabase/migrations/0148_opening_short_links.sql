-- Short links + click tracking for job openings. Each opening gets a short code
-- (joinwingman.app/j/<code>) that redirects to its pre-filled apply form and
-- counts the click, so operators can see clicks vs applications per posting.
alter table job_openings add column if not exists code text;
alter table job_openings add column if not exists click_count integer not null default 0;

-- Backfill existing openings with a short code before enforcing uniqueness.
update job_openings set code = substr(md5(random()::text || id::text || clock_timestamp()::text), 1, 7) where code is null;

-- Unique across all openings (Postgres allows multiple NULLs, which is fine —
-- new rows get a code assigned right after insert).
create unique index if not exists job_openings_code_key on job_openings (code);
