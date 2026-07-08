-- Security fix: lock down privilege-bearing columns on the profiles table.
--
-- Before this migration, the `profiles_update` RLS policy had no WITH CHECK and
-- the `protect_profile_fields()` trigger guarded only `access_role`, `org_id`,
-- and `location_id`. Two privilege columns were left unguarded:
--
--   * is_platform_admin (added in 0008) -- a CROSS-tenant privilege.
--   * all_locations     (added in 0025) -- org-wide location access.
--
-- Because the browser holds the public anon key and the user's own session JWT,
-- any authenticated user could PATCH their own profiles row directly against
-- PostgREST (bypassing the app) and set either column, e.g.:
--
--   PATCH /rest/v1/profiles?id=eq.<their-own-id>  { "is_platform_admin": true }
--
-- RLS allowed it (own row, org unchanged) and the trigger ignored the column,
-- so the write succeeded -- yielding full cross-tenant platform-admin takeover
-- (or, via all_locations, org-wide location access for a single-location user).
--
-- This migration closes both holes at the trigger layer (authoritative, fires on
-- every UPDATE including direct PostgREST calls) and adds a WITH CHECK to the
-- policy for defense-in-depth. It intentionally does NOT touch:
--   * The manual promotion path `update profiles set is_platform_admin = true`
--     run in the SQL editor -- that runs as the postgres role with no end-user
--     JWT, so auth.uid() is null and the is_platform_admin guard is skipped.
--   * assign_team_member_profile() -- a super-admin-locked SECURITY DEFINER RPC
--     that edits OTHER users' rows, so the self-edit guard never trips.

create or replace function protect_profile_fields() returns trigger
  language plpgsql
  set search_path = public
  as $$
begin
  -- is_platform_admin is a cross-tenant privilege and must only ever be set
  -- out-of-band (manual SQL / service-role), never through an end-user request.
  -- Any request carrying a user JWT is blocked from changing it -- including
  -- super admins, whose authority is only org-scoped.
  if auth.uid() is not null
     and new.is_platform_admin is distinct from old.is_platform_admin then
    raise exception 'is_platform_admin cannot be changed through the API';
  end if;

  -- A user editing their own row (and not a super admin) may not change any
  -- privilege-bearing column. all_locations is newly guarded here.
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

-- Defense-in-depth: give the update policy an explicit WITH CHECK so the row,
-- after update, must still satisfy the same org/ownership predicate as USING.
-- This prevents a row from being moved to another org at the policy layer,
-- independent of the trigger.
drop policy profiles_update on profiles;
create policy profiles_update on profiles for update
  using (org_id = current_org_id() and (id = auth.uid() or is_super_admin()))
  with check (org_id = current_org_id() and (id = auth.uid() or is_super_admin()));
