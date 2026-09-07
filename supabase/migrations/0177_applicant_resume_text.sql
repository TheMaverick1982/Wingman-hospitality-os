-- Extracted plain text of an applicant's uploaded resume, so the "Ask about your
-- applicants" AI can search resume content (work history, skills) alongside the
-- form + screening answers. Filled once per resume by a background cron (Claude
-- reads the PDF/image), then reused for every question. Additive, nullable:
--   null  = not yet processed (the cron will pick it up)
--   ''    = processed but nothing extractable (unsupported type / empty) — skip
--   text  = the resume's text
alter table job_applications add column if not exists resume_text text;
