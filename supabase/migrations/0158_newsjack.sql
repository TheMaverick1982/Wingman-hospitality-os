-- Newsjacking: the Playbook engine can now draft posts that ride current
-- restaurant-industry news. `source_url` ties a draft to the story it jacks (also
-- shown in the review email). `newsjack_seen` is a dedup ledger so the same
-- headline is never drafted twice. Both are platform-marketing internals, read
-- only via the service-role client.
alter table blog_posts add column if not exists source_url text;

create table if not exists newsjack_seen (
  url text primary key,
  seen_at timestamptz not null default now()
);
-- Internal ledger — no policies, so it's inaccessible via the API; the cron
-- connects as the service role and bypasses RLS.
alter table newsjack_seen enable row level security;
