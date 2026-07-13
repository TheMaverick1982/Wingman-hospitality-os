-- Let owners customize their public job-application form: relabel/enable/require
-- the built-in fields and add their own custom questions. The config lives on the
-- organization; each application stores the answers to any custom questions.
alter table organizations
  add column if not exists application_form_config jsonb not null default '{}'::jsonb;

alter table job_applications
  add column if not exists custom_answers jsonb not null default '[]'::jsonb;
