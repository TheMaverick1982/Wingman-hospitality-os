-- Ownership recap: a company-wide (ALL locations) guest-feedback recap emailed to
-- specific ownership addresses on a daily or weekly cadence. Separate from the
-- per-location review digest — this is the exec view, managed by the owner
-- (super admin) only. Additive; defaults keep it OFF until an owner turns it on.
--   review_exec_frequency:        'off' (default) | 'daily' | 'weekly'
--   review_exec_emails:           comma/newline list of ownership addresses
--   review_exec_include_actions:  include the one-line "This week" fix (default true)
--   review_exec_sent_at:          last send, to prevent duplicate sends on reruns
alter table organizations add column if not exists review_exec_frequency text not null default 'off';
alter table organizations add column if not exists review_exec_emails text not null default '';
alter table organizations add column if not exists review_exec_include_actions boolean not null default true;
alter table organizations add column if not exists review_exec_sent_at timestamptz;
