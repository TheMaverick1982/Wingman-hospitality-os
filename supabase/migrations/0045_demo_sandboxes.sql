-- Per-visitor demo sandboxes (product-led "Try it live" funnel).
--
-- The shared wingmandemo@gmail.com login (0044) is a single org that reseeds on
-- every sign-in — great for a sales rep, but everyone shares one dataset. To let
-- many prospects explore concurrently and independently, each visitor who clicks
-- "Try the live demo" gets their own throwaway auth user + freshly-seeded org
-- that auto-expires. See src/lib/demo/reseed.ts (provisionDemoSandbox) and the
-- /api/cron/demo-cleanup reaper.

-- When set, this org is an ephemeral sandbox the cleanup cron reaps once the
-- timestamp has passed. NULL means a durable demo org (the shared master).
alter table organizations
  add column if not exists demo_expires_at timestamptz;

-- We now allow many demo orgs (one shared master + N ephemeral sandboxes), so
-- the 0044 "at most one demo org" guard no longer applies.
drop index if exists organizations_single_demo_idx;

-- The reaper scans for expired sandboxes; the shared master is disambiguated as
-- the demo org whose demo_expires_at is null.
create index if not exists organizations_demo_expiry_idx
  on organizations (demo_expires_at) where demo_expires_at is not null;
