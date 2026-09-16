-- Monthly Culture Recap: an AI-written summary of how the team's culture showed
-- up over the past month (wins, recognition, the anonymous pulse, experiments),
-- emailed to the owner + managers on the 1st. Additive: two columns on
-- organizations, default keeps it OFF until an owner turns it on.
--   culture_recap_enabled: false (default) | true
--   culture_recap_sent_at: last time the recap cron sent, to prevent duplicates
alter table organizations add column if not exists culture_recap_enabled boolean not null default false;
alter table organizations add column if not exists culture_recap_sent_at timestamptz;
