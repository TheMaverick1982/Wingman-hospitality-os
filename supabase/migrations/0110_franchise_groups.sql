-- Franchise / multi-org tier (Phase 1: group + membership + oversight).
--
-- A Franchise Group sits one level above the org: member franchisees keep their
-- own accounts (team, staff, locations, billing) while the franchisor sets brand
-- standards and sees compliance oversight across everyone. See
-- docs/franchise-architecture.md.
--
-- All three tables are deny-all RLS: access is exclusively via the service-role
-- client after an app-level franchise-admin / platform-admin check (same pattern
-- as platform_pricing). Franchisors see compliance/aggregates only — NEVER raw
-- guest contact info, which stays with the franchisee owner.

create table if not exists franchise_groups (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  owner_user_id uuid references profiles(id) on delete set null,
  billing_mode text not null default 'distributed',   -- 'central' | 'distributed'
  created_at timestamptz not null default now()
);

-- One org belongs to at most one group (the unique on org_id enforces it).
create table if not exists franchise_memberships (
  group_id uuid not null references franchise_groups(id) on delete cascade,
  org_id uuid not null references organizations(id) on delete cascade,
  status text not null default 'active',               -- 'invited' | 'active' | 'removed'
  joined_at timestamptz not null default now(),
  primary key (group_id, org_id),
  unique (org_id)
);

-- Who can act at the group level (the franchisor's people).
create table if not exists franchise_admins (
  group_id uuid not null references franchise_groups(id) on delete cascade,
  user_id uuid not null references profiles(id) on delete cascade,
  role text not null default 'admin',                  -- 'admin' | 'viewer'
  created_at timestamptz not null default now(),
  primary key (group_id, user_id)
);

-- Denormalized pointer for quick "is this org in a group?" lookups.
alter table organizations add column if not exists franchise_group_id uuid references franchise_groups(id) on delete set null;

alter table franchise_groups enable row level security;
alter table franchise_memberships enable row level security;
alter table franchise_admins enable row level security;
-- Intentionally NO policies on any of the three: deny-all to the RLS client.
