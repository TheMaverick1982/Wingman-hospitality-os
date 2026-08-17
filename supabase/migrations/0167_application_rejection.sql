-- Rejection details on an application: an optional note on why, and a "do not
-- hire" flag for people who should never be reconsidered. Rejected applications
-- move to an Archive tab in the tracker, out of the day-to-day flow. Additive;
-- defaults preserve today's behavior.
alter table job_applications add column if not exists rejection_note text not null default '';
alter table job_applications add column if not exists do_not_hire boolean not null default false;
