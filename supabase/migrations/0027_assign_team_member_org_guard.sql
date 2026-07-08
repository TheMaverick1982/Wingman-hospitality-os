-- Hardening: ensure assign_team_member_profile() can only ever touch a profile
-- that belongs to the caller's own organization.
--
-- The function is already locked to Super Admins, but its `on conflict (id) do
-- update` branches (and the profile_locations delete) act on whatever
-- new_user_id is passed without confirming that row's org. Today the only
-- caller derives new_user_id from inviteUserByEmail (which errors for an
-- existing user), so it isn't reachable -- but a single explicit guard removes
-- the latent cross-org tampering primitive entirely. Body is otherwise
-- identical to 0025.

create or replace function assign_team_member_profile(
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

  -- Never mutate a profile that already belongs to a different organization.
  if exists (select 1 from profiles where id = new_user_id and org_id <> current_org_id()) then
    raise exception 'That user belongs to another organization';
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
