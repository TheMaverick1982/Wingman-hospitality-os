-- Interview scheduling on applications. A manager sets a date/time + details
-- and confirms; the application then moves into the candidates area as a
-- scheduled interview (status 'interviewing') until it's scored.
alter table job_applications add column if not exists interview_at timestamptz;
alter table job_applications add column if not exists interview_details text not null default '';

alter table job_applications drop constraint if exists job_applications_status_check;
alter table job_applications add constraint job_applications_status_check
  check (status in ('new', 'contacted', 'interviewing', 'not_a_fit', 'hired'));

create index if not exists job_applications_interview_idx on job_applications(interview_at) where status = 'interviewing';
