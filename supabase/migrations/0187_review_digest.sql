-- Auto-send the combined guest-feedback report (survey + Google reviews) to each
-- location's managers + the owner, on a cadence the owner picks. Additive: two
-- new columns on organizations, defaults keep it OFF until an owner turns it on.
--   review_digest_frequency: 'off' (default) | 'weekly' | 'monthly'
--   review_digest_sent_at:   last time the digest cron sent, to prevent duplicates
alter table organizations add column if not exists review_digest_frequency text not null default 'off';
alter table organizations add column if not exists review_digest_sent_at timestamptz;
