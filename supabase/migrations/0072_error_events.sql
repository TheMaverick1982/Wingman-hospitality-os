-- Built-in error monitor. Runtime errors (client boundary, server request hook,
-- and explicit reportError calls) are recorded here, grouped by a stable
-- fingerprint so the same bug is one row with a count — not thousands. The
-- platform Health dashboard reads this, and a new fingerprint emails an alert.
-- Platform-only: no RLS policies means only the service-role client can touch it.
create table error_events (
  id uuid primary key default gen_random_uuid(),
  fingerprint text not null unique,
  message text not null,
  stack text,
  route text,
  source text not null default 'server', -- 'client' | 'server' | 'action'
  org_id uuid,
  user_email text,
  count int not null default 1,
  resolved boolean not null default false,
  alerted_at timestamptz,
  first_seen timestamptz not null default now(),
  last_seen timestamptz not null default now()
);

create index error_events_last_seen_idx on error_events(last_seen desc);
create index error_events_unresolved_idx on error_events(resolved, last_seen desc);

alter table error_events enable row level security;

-- Give every current platform admin access to the new Health section so it shows
-- up for them without a manual grant. New staff get it if granted like any section.
update profiles
  set platform_access = array_append(platform_access, 'health')
  where is_platform_admin = true
    and not (coalesce(platform_access, '{}') @> array['health']);
