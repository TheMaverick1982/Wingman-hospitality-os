-- Platform staff isolation + a dedicated "Log in as client" permission.
--
-- The one-step "invite as platform staff" flow used to give a brand-new
-- teammate a normal Staff profile inside the INVITER's customer org (because
-- every profile must belong to an org). That leaked platform staff into a
-- customer's team list and gave them client-app access to that customer's data.
--
-- Fix: keep all platform staff in a single hidden internal org ("Wingman
-- Platform"). They get NO client account in any customer org. The only way they
-- ever touch customer data is the explicit "Log in as client" (impersonation)
-- feature, which becomes its own grantable permission: client_login.

-- 1. Flag internal (non-customer) organizations so we can hide them everywhere
--    customer orgs are listed.
alter table organizations add column if not exists is_platform boolean not null default false;

-- 2. Create the single internal org that houses platform staff (idempotent).
insert into organizations (name, is_platform, system_generated)
select 'Wingman Platform', true, true
where not exists (select 1 from organizations where is_platform = true);

-- 3. Move any platform staff mistakenly created inside a customer org into the
--    internal org. Only rows created by the one-step invite are moved: those are
--    always access_role = 'staff'. Real account owners (platform admins who are
--    ALSO super_admin of their own org, e.g. the founder) are super_admin, so
--    this never touches them.
update profiles p
  set org_id = (select id from organizations where is_platform = true order by created_at limit 1),
      access_role = 'super_admin',   -- super_admin needs no location, which suits the empty internal org
      location_id = null,
      all_locations = false
  where p.is_platform_admin = true
    and p.access_role = 'staff';

-- 4. Clear any stale explicit location links the moved staff carried over from
--    their old customer org.
delete from profile_locations
  where profile_id in (
    select id from profiles
    where is_platform_admin = true
      and org_id = (select id from organizations where is_platform = true order by created_at limit 1)
  );

-- 5. Preserve today's behavior: everyone who can impersonate right now (gated
--    until this migration by the 'organizations' section) keeps that ability
--    under the new dedicated client_login permission. You can revoke it
--    per-person on the Team page afterward.
update profiles
  set platform_access = array_append(platform_access, 'client_login')
  where is_platform_admin = true
    and 'organizations' = any(platform_access)
    and not ('client_login' = any(platform_access));
