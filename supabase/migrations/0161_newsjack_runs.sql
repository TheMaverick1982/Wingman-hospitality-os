-- Newsjack run log. Every daily (or manual) scan records its outcome here so the
-- Admin → Playbook page can show "last scan ran at X, result: drafted / skipped /
-- no fresh news / error". Without this, a healthy quiet day (nothing timely to
-- newsjack, so no email) is indistinguishable from a broken cron — the log makes
-- "it's alive" visible even on days it sends nothing.
create table if not exists public.newsjack_runs (
  id uuid primary key default gen_random_uuid(),
  ran_at timestamptz not null default now(),
  -- 'drafted' | 'skipped' (nothing safe/timely) | 'no_fresh_news' | 'error'
  outcome text not null,
  detail text not null default '',
  considered integer not null default 0,
  post_id uuid references public.blog_posts(id) on delete set null,
  trigger text not null default 'cron' -- 'cron' | 'manual'
);

create index if not exists newsjack_runs_ran_at_idx on public.newsjack_runs(ran_at desc);

-- Internal table: only the service-role migrator/cron writes and reads it (via the
-- admin client, which bypasses RLS). RLS on with no policies = inaccessible to the
-- browser API, same pattern as newsjack_seen.
alter table public.newsjack_runs enable row level security;
