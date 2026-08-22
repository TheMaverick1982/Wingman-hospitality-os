-- Add an "Other" bucket to app_department so a restaurant can post a job opening
-- for a role that isn't in the standard list (e.g. Baker, Valet, Event Lead). The
-- human-readable custom role name is stored in job_openings.title and shown as the
-- role label everywhere the posting appears (openings list, careers page, apply
-- form, Google Jobs markup). "Other" is deliberately NOT part of the app's role
-- system (training, standards, staff assignments) — it exists only so an opening
-- and any downstream candidate has a valid, safe enum value to fall back to.
--
-- Enum additions are additive and irreversible in Postgres (no value is dropped or
-- renamed), so this is safe for tenant data.
alter type app_department add value if not exists 'Other';

notify pgrst, 'reload schema';
