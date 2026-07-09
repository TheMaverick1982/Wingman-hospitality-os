-- Granular platform-admin access.
--
-- Until now is_platform_admin was all-or-nothing. This adds per-section access
-- so the owner can add teammates (e.g. a support agent) who only see certain
-- parts of /admin. is_platform_admin remains the master "is this person platform
-- staff" flag; platform_access lists which admin sections they may open.
--
-- Section keys: organizations, support, reporting, billing, analytics, team
--   ("team" = may manage other platform staff on the Team page).

alter table profiles add column if not exists platform_access text[] not null default '{}';

-- Existing platform admins keep full access (no behavior change for them).
update profiles
  set platform_access = array['organizations', 'support', 'reporting', 'billing', 'analytics', 'team']
  where is_platform_admin = true;

-- Extend the self-edit guard: platform_access is a privilege column, so like
-- is_platform_admin it may only be changed out-of-band (service-role / admin
-- actions where auth.uid() is null), never through an end-user API request.
-- This stops a limited platform admin (e.g. support-only) from PATCHing their
-- own row via PostgREST to grant themselves more sections.
create or replace function protect_profile_fields() returns trigger
  language plpgsql
  set search_path = public
  as $$
begin
  if auth.uid() is not null
     and new.is_platform_admin is distinct from old.is_platform_admin then
    raise exception 'is_platform_admin cannot be changed through the API';
  end if;

  if auth.uid() is not null
     and new.platform_access is distinct from old.platform_access then
    raise exception 'platform_access cannot be changed through the API';
  end if;

  if auth.uid() = old.id and not is_super_admin() then
    if new.access_role   is distinct from old.access_role
      or new.org_id        is distinct from old.org_id
      or new.location_id   is distinct from old.location_id
      or new.all_locations is distinct from old.all_locations then
      raise exception 'You cannot change your own role, organization, location, or access scope';
    end if;
  end if;

  return new;
end;
$$;
