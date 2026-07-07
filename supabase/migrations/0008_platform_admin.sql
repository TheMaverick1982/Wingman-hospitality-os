-- Platform admin: a cross-org privilege level for the software owner, separate
-- from the org-scoped super_admin role. Grant it manually per-user:
--   update profiles set is_platform_admin = true where id = '<your-user-id>';
alter table profiles add column is_platform_admin boolean not null default false;

-- Audit trail for "log in as" impersonation from the platform admin area.
create table impersonation_log (
  id uuid primary key default gen_random_uuid(),
  platform_admin_id uuid not null references auth.users(id) on delete cascade,
  target_profile_id uuid not null references profiles(id) on delete cascade,
  target_org_id uuid not null references organizations(id) on delete cascade,
  started_at timestamptz not null default now()
);

alter table impersonation_log enable row level security;
-- No policies: only ever read/written through the service-role admin client
-- from server code that has already verified is_platform_admin, so RLS with
-- zero policies (deny-all for anon/authenticated) is the correct default.
