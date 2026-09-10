-- Per-opening notification email. A corporate opening isn't tied to a store, so
-- there's no location email to send new-application alerts to. This lets the
-- owner set a specific address to receive alerts for that opening (in addition to
-- any account-wide CC addresses). Nullable; only used for corporate openings today.
alter table job_openings add column if not exists notify_email text;
