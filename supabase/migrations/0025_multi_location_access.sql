-- Multi-location team access. Until now a member was tied to exactly one
-- location (profiles.location_id) and can_access_location() allowed the owner
-- (super_admin) or that single location. This adds:
--   * profiles.all_locations  -- a manager/staff who can reach every location
--   * profile_locations        -- an explicit set of extra locations a member
--                                 can reach ("specific locations")
-- and lets the invite/edit flow assign a Super Admin (co-owner) as well.
-- Every table already gates on can_access_location(), so extending that one
-- function is the entire access-control surface.

-- ---------------------------------------------------------------------------
-- 1. New columns / tables
-- ---------------------------------------------------------------------------
alter table profiles add column all_locations boolean not null default false;

create table profile_locations (
  profile_id uuid not null references profiles(id) on delete cascade,
  location_id uuid not null references locations(id) on delete cascade,
  primary key (profile_id, location_id)
);
create index profile_locations_profile_idx on profile_locations(profile_id);

alter table profile_locations enable row level security;

-- Anyone in the org can read who-accesses-what (profiles are already org-
-- readable); only a Super Admin can change the grants.
create policy profile_locations_select on profile_locations for select
  using (exists (select 1 from profiles p where p.id = profile_locations.profile_id and p.org_id = current_org_id()));
create policy profile_locations_write on profile_locations for all
  using (is_super_admin() and exists (select 1 from profiles p where p.id = profile_locations.profile_id and p.org_id = current_org_id()))
  with check (is_super_admin() and exists (select 1 from profiles p where p.id = profile_locations.profile_id and p.org_id = current_org_id()));

-- ---------------------------------------------------------------------------
-- 2. The one access function every table trusts
-- ---------------------------------------------------------------------------
create or replace function can_access_location(target_location uuid) returns boolean
  language sql stable security definer set search_path = public as $$
    select
      is_super_admin()
      or coalesce((select all_locations from profiles where id = auth.uid()), false)
      or target_location = current_location_id()
      or exists (select 1 from profile_locations where profile_id = auth.uid() and location_id = target_location)
  $$;

-- ---------------------------------------------------------------------------
-- 3. Invite/assign RPC: now accepts a role (incl. super_admin), an
--    all-locations flag, and an explicit location set. Upserts, so it backs
--    both inviting and editing. Runs as definer but is locked to Super Admins.
-- ---------------------------------------------------------------------------
drop function if exists assign_team_member_profile(uuid, text, uuid, access_role);

create function assign_team_member_profile(
  new_user_id uuid,
  full_name text,
  target_role access_role,
  target_location_id uuid,
  target_all_locations boolean default false,
  target_location_ids uuid[] default '{}'
) returns void
language plpgsql security definer set search_path = public as $$
declare
  home_location uuid;
begin
  if not is_super_admin() then
    raise exception 'Only a Super Admin can add or edit team members';
  end if;

  -- Super Admin (co-owner): full access everywhere, no location needed.
  if target_role = 'super_admin' then
    insert into profiles (id, org_id, full_name, access_role, location_id, all_locations)
    values (new_user_id, current_org_id(), full_name, 'super_admin', null, false)
    on conflict (id) do update set
      full_name = excluded.full_name,
      access_role = 'super_admin',
      location_id = null,
      all_locations = false;
    delete from profile_locations where profile_id = new_user_id;
    return;
  end if;

  -- Manager / Staff: resolve a valid home location (constraint requires one).
  home_location := target_location_id;
  if home_location is null or not exists (select 1 from locations where id = home_location and org_id = current_org_id()) then
    select l.id into home_location from locations l
      where l.org_id = current_org_id() and l.id = any(target_location_ids)
      order by l.name limit 1;
  end if;
  if home_location is null then
    select l.id into home_location from locations l where l.org_id = current_org_id() order by l.name limit 1;
  end if;
  if home_location is null then
    raise exception 'A valid location is required for this role';
  end if;

  insert into profiles (id, org_id, full_name, access_role, location_id, all_locations)
  values (new_user_id, current_org_id(), full_name, target_role, home_location, coalesce(target_all_locations, false))
  on conflict (id) do update set
    full_name = excluded.full_name,
    access_role = excluded.access_role,
    location_id = excluded.location_id,
    all_locations = excluded.all_locations;

  -- Rebuild the explicit location set (skipped when they get all locations).
  delete from profile_locations where profile_id = new_user_id;
  if not coalesce(target_all_locations, false) then
    insert into profile_locations (profile_id, location_id)
    select new_user_id, l.id from locations l
      where l.org_id = current_org_id() and l.id = any(target_location_ids)
    on conflict do nothing;
  end if;
end;
$$;
