-- Migrate the 2-tier access model (gm/manager) to the 3-tier model used by
-- the design_v2 handoff: super_admin (account owner, full access everywhere)
-- / manager (full on operational sections, view-only on Reporting, no
-- Settings) / staff (view-only on most sections, no Guest Bounce Back,
-- Hiring, Reporting, or Settings at all).
--
-- Guest Bounce Back keeps its cross-location behavior for roles that can see
-- it at all (super_admin, manager) - that part of the schema doesn't change.

-- ---------------------------------------------------------------------------
-- 1. Swap the access_role enum for a 3-value version, backfilling gm ->
--    super_admin and manager -> manager.
-- ---------------------------------------------------------------------------

create type access_role_v2 as enum ('super_admin', 'manager', 'staff');

alter table profiles add column access_role_v2 access_role_v2;

update profiles set access_role_v2 = case access_role
  when 'gm' then 'super_admin'::access_role_v2
  when 'manager' then 'manager'::access_role_v2
end;

alter table profiles alter column access_role_v2 set not null;
alter table profiles drop constraint manager_requires_location;
alter table profiles drop column access_role;
alter table profiles rename column access_role_v2 to access_role;

-- current_access_role() returns the old 2-value enum, which blocks dropping
-- it; drop the function here and recreate it against the new type below.
drop function current_access_role();

drop type access_role;
alter type access_role_v2 rename to access_role;

alter table profiles add constraint location_required_below_super_admin
  check (access_role = 'super_admin' or location_id is not null);

create function current_access_role() returns access_role
  language sql stable security definer set search_path = public as $$
    select access_role from profiles where id = auth.uid()
  $$;

-- ---------------------------------------------------------------------------
-- 2. Add the new role-tier helper functions, and repoint
--    can_access_location() at is_super_admin() instead of is_gm() (it's a
--    `language sql` function, so its old call to is_gm() is a real catalog
--    dependency that must be cleared before is_gm() can be dropped).
--    is_gm() itself isn't dropped until step 4, after every policy that
--    depends on it has been re-pointed in step 3.
-- ---------------------------------------------------------------------------

create function is_super_admin() returns boolean
  language sql stable security definer set search_path = public as $$
    select coalesce((select access_role from profiles where id = auth.uid()) = 'super_admin', false)
  $$;

create function is_manager_or_above() returns boolean
  language sql stable security definer set search_path = public as $$
    select coalesce((select access_role from profiles where id = auth.uid()) in ('super_admin', 'manager'), false)
  $$;

create or replace function can_access_location(target_location uuid) returns boolean
  language sql stable security definer set search_path = public as $$
    select is_super_admin() or target_location = current_location_id()
  $$;

-- ---------------------------------------------------------------------------
-- 3. Re-point every policy that used is_gm() at is_super_admin(), and add
--    manager_or_above / staff-blocking checks where the design's permission
--    matrix now requires them. After this section, nothing references
--    is_gm() anymore.
-- ---------------------------------------------------------------------------

drop policy organizations_update on organizations;
create policy organizations_update on organizations for update using (id = current_org_id() and is_super_admin());

drop policy locations_write on locations;
create policy locations_write on locations for all
  using (org_id = current_org_id() and is_super_admin())
  with check (org_id = current_org_id() and is_super_admin());

drop policy profiles_update on profiles;
create policy profiles_update on profiles for update
  using (org_id = current_org_id() and (id = auth.uid() or is_super_admin()));

-- Culture, Training & Standards, and Hiring are all "Full" for Manager per
-- the design's permission matrix (only Staff is view-only, and only
-- Settings/billing/location management stay Super-Admin-only) - so these
-- content tables move from super-admin-only to manager-or-above.
drop policy core_values_write on core_values;
create policy core_values_write on core_values for all
  using (org_id = current_org_id() and is_manager_or_above()) with check (org_id = current_org_id() and is_manager_or_above());

drop policy department_standards_write on department_standards;
create policy department_standards_write on department_standards for all
  using (org_id = current_org_id() and is_manager_or_above()) with check (org_id = current_org_id() and is_manager_or_above());

drop policy department_meta_write on department_meta;
create policy department_meta_write on department_meta for all
  using (org_id = current_org_id() and is_manager_or_above()) with check (org_id = current_org_id() and is_manager_or_above());

drop policy department_training_items_write on department_training_items;
create policy department_training_items_write on department_training_items for all
  using (org_id = current_org_id() and is_manager_or_above()) with check (org_id = current_org_id() and is_manager_or_above());

drop policy menu_references_write on menu_references;
create policy menu_references_write on menu_references for all
  using (org_id = current_org_id() and is_manager_or_above()) with check (org_id = current_org_id() and is_manager_or_above());

drop policy hiring_traits_write on hiring_traits;
create policy hiring_traits_write on hiring_traits for all
  using (org_id = current_org_id() and is_manager_or_above()) with check (org_id = current_org_id() and is_manager_or_above());

-- Guest Bounce Back: previously open to any org member. Staff now has no
-- access to this section at all (per the permission matrix), so gate it to
-- manager-or-above. Still cross-location (no location filter) for those who
-- can see it.
drop policy guests_all on guests;
create policy guests_all on guests for all
  using (org_id = current_org_id() and is_manager_or_above())
  with check (org_id = current_org_id() and is_manager_or_above());

drop policy guest_visits_all on guest_visits;
create policy guest_visits_all on guest_visits for all
  using (org_id = current_org_id() and is_manager_or_above())
  with check (org_id = current_org_id() and is_manager_or_above());

-- Operational logs: Staff gets read-only (View); only manager-or-above may
-- write. Select stays location-scoped via can_access_location for everyone.
drop policy discounts_insert on discounts;
create policy discounts_insert on discounts for insert
  with check (org_id = current_org_id() and can_access_location(location_id) and is_manager_or_above());

drop policy discounts_delete on discounts;
create policy discounts_delete on discounts for delete
  using (org_id = current_org_id() and can_access_location(location_id) and is_manager_or_above());

drop policy spot_checks_insert on spot_checks;
create policy spot_checks_insert on spot_checks for insert
  with check (org_id = current_org_id() and can_access_location(location_id) and is_manager_or_above());

drop policy daily_checklists_insert on daily_checklists;
create policy daily_checklists_insert on daily_checklists for insert
  with check (org_id = current_org_id() and can_access_location(location_id) and is_manager_or_above());

-- Culture and Training & Standards: Staff is view-only, so posting a culture
-- moment or logging a training sign-off (both previously open to any org
-- member) now requires manager-or-above.
drop policy culture_moments_insert on culture_moments;
create policy culture_moments_insert on culture_moments for insert
  with check (org_id = current_org_id() and is_manager_or_above());

drop policy training_signoffs_insert on training_signoffs;
create policy training_signoffs_insert on training_signoffs for insert
  with check (org_id = current_org_id() and is_manager_or_above());

-- Hiring: Staff has no access at all (not even View).
drop policy candidates_select on candidates;
create policy candidates_select on candidates for select
  using (org_id = current_org_id() and can_access_location(location_id) and is_manager_or_above());

drop policy candidates_insert on candidates;
create policy candidates_insert on candidates for insert
  with check (org_id = current_org_id() and can_access_location(location_id) and is_manager_or_above());

-- ---------------------------------------------------------------------------
-- 4. Nothing references is_gm() anymore - safe to drop.
-- ---------------------------------------------------------------------------

drop function is_gm();

-- ---------------------------------------------------------------------------
-- 5. Update the org-bootstrap function to create a super_admin instead of gm.
-- ---------------------------------------------------------------------------

create or replace function create_organization(org_name text, gm_full_name text, first_location_name text)
returns uuid
language plpgsql security definer set search_path = public as $$
declare
  new_org_id uuid;
  new_location_id uuid;
begin
  if exists (select 1 from profiles where id = auth.uid()) then
    raise exception 'User already belongs to an organization';
  end if;

  insert into organizations (name) values (org_name) returning id into new_org_id;
  insert into locations (org_id, name) values (new_org_id, first_location_name) returning id into new_location_id;
  insert into profiles (id, org_id, full_name, access_role, location_id)
    values (auth.uid(), new_org_id, gm_full_name, 'super_admin', null);

  insert into core_values (org_id, title, description, hiring_question, hiring_green_flag, hiring_red_flag, sort_order) values
    (new_org_id, 'We create reactions, not transactions', 'Guests don''t return because of what they bought. They return because of how they felt.', 'Tell me about a time you made a customer or client feel genuinely special.', 'Describes reading the person and adjusting in the moment.', 'Describes following a script or company policy.', 0),
    (new_org_id, 'Recognition drives loyalty', 'A returning guest should never feel like a new guest.', 'How would you make a repeat customer feel different from a first-timer?', 'Specific ideas: names, preferences, small callbacks.', 'Treats every customer identically, no mention of familiarity.', 1),
    (new_org_id, 'Personalization over standardization', 'Read the guest. Adjust tone and pacing. Never sound scripted.', 'How would you handle two very different customers back to back?', 'Naturally shifts tone and pacing between the two.', 'Gives the same approach for both examples.', 2),
    (new_org_id, 'Every role owns the experience', 'Hospitality isn''t one position''s job. Host, server, bartender, chef, manager — all in.', 'Tell me about a time something wasn''t your job, but you helped anyway.', 'Jumps in without being asked, no "not my role" framing.', 'Waits to be told, or frames helping as an inconvenience.', 3),
    (new_org_id, 'The details define the brand', 'Speed of greeting, cleanliness, timing, eye contact. Small things, big impression.', 'What did you notice the last time you got great service somewhere?', 'Specific small details — timing, greeting, cleanliness.', 'Vague answer ("it was nice"), nothing concrete.', 4);

  insert into department_standards (org_id, department, item, sort_order)
  select new_org_id, d.department, d.item, d.sort_order
  from (values
    ('Host'::app_department, 'Greet every guest immediately — smile, eye contact, drop what you''re doing', 0),
    ('Host', 'Ask: "Is this your first time with us?"', 1),
    ('Host', 'Read the guest and seat accordingly', 2),
    ('Host', 'Notify the MOD immediately of any first-time guest', 3),
    ('Host', 'Introduce the server by name', 4),
    ('Host', 'Offer loyalty sign-up on every to-go order', 5),
    ('Server', 'Build rapport — use names, notice celebrations', 0),
    ('Server', 'One specific recommendation per course, every course', 1),
    ('Server', 'Mention loyalty early — name, points, offers', 2),
    ('Server', 'Ask: "Is this your first time dining with us?"', 3),
    ('Server', 'Fast first drinks, constant table scanning', 4),
    ('Server', 'Thank by name and invite back with something specific', 5),
    ('Bartender', 'Greet by name whenever possible', 0),
    ('Bartender', 'Ask a follow-up question from their last visit', 1),
    ('Bartender', 'First drink out fast — every time', 2),
    ('Bartender', 'Encourage second and third rounds naturally', 3),
    ('Bartender', 'Keep the bar top clean at all times', 4),
    ('Chef', 'Walk the dining room once per hour', 0),
    ('Chef', 'Inspect food quality with your eyes, not from the pass', 1),
    ('Chef', 'Introduce yourself at a table at least once per shift', 2),
    ('Chef', 'Take ownership of any issue — fix it immediately', 3),
    ('Manager', 'On the floor during every peak period', 0),
    ('Manager', 'Engage every table possible, approach first-time guests', 1),
    ('Manager', 'Thank every departing guest personally', 2),
    ('Manager', 'Coach in real time — correction and praise', 3),
    ('Manager', 'Log and follow through on every bounce-back interaction', 4)
  ) as d(department, item, sort_order);

  insert into department_meta (org_id, department, track_label, has_menu) values
    (new_org_id, 'Host', 'Seating & flow', false),
    (new_org_id, 'Server', 'Menu & product knowledge', true),
    (new_org_id, 'Bartender', 'Bar & beverage knowledge', true),
    (new_org_id, 'Chef', 'Kitchen standards & safety', false),
    (new_org_id, 'Manager', 'Operations & leadership', false);

  insert into department_training_items (org_id, department, item, sort_order)
  select new_org_id, d.department, d.item, d.sort_order
  from (values
    ('Host'::app_department, 'Know the floor plan and rotation order cold', 0),
    ('Host', 'Know how the reservation / waitlist system works', 1),
    ('Host', 'Know today''s realistic wait time before a guest asks', 2),
    ('Host', 'Know how to page a manager fast without leaving the door unattended', 3),
    ('Server', 'Know every dish''s key ingredients and prep style', 0),
    ('Server', 'Know common allergens for every menu item', 1),
    ('Server', 'Know today''s specials before the first table sits', 2),
    ('Server', 'Can describe any dish in one confident sentence, no notes', 3),
    ('Server', 'Know how to enter modifiers and allergies correctly in the POS', 4),
    ('Bartender', 'Know every cocktail recipe and pour standard exactly', 0),
    ('Bartender', 'Know the beer and wine list by style, not just name', 1),
    ('Bartender', 'Check ID every time policy requires it, no exceptions', 2),
    ('Bartender', 'Know how to 86 an item and communicate it to the floor fast', 3),
    ('Chef', 'Know safe holding temperatures cold and hot — never guess, ever', 0),
    ('Chef', 'Treat food safety as non-negotiable, not a busy-night shortcut', 1),
    ('Chef', 'Know allergen protocol and cross-contact prevention by station', 2),
    ('Chef', 'Know the plating standard for every dish on the line', 3),
    ('Chef', 'Know par levels and the prep list without being told', 4),
    ('Manager', 'Know daily KPI targets: sales, labor %, discount %', 0),
    ('Manager', 'Can run a pre-shift meeting in under 5 minutes', 1),
    ('Manager', 'Know scheduling and labor cost basics for the shift', 2),
    ('Manager', 'Know exactly when a discount needs owner-level approval', 3),
    ('Manager', 'Know what''s happening in the few blocks around the restaurant — events, competitors, foot traffic', 4)
  ) as d(department, item, sort_order);

  insert into hiring_traits (org_id, department, title, question, green_flag, red_flag, sort_order) values
    (new_org_id, 'Host', 'Composure under a full waitlist', 'Tell me about a time you had an angry line of people waiting and no tables ready. What did you do?', 'Stayed calm, communicated proactively, prioritized fairly.', 'Got flustered, avoided guests, or blamed the kitchen/servers.', 0),
    (new_org_id, 'Host', 'Spatial and organizational awareness', 'How would you decide where to seat a big walk-in group during a rush?', 'Thinks about flow, server sections, and guest comfort at once.', 'Would seat randomly with no awareness of server load.', 1),
    (new_org_id, 'Server', 'Sales confidence', 'Sell me a menu item you''ve never sold before, right now.', 'Confident, specific, enthusiastic without being pushy.', 'Hesitant, generic, or refuses to try.', 0),
    (new_org_id, 'Server', 'Resilience with a difficult table', 'Tell me about the worst table you''ve ever had. What happened?', 'Takes ownership, stays composed, focuses on resolution.', 'Blames the guest, gets defensive, no resolution offered.', 1),
    (new_org_id, 'Bartender', 'Multitasking under volume', 'Describe handling a slammed bar with tickets piling up.', 'Prioritizes, stays calm, communicates with the team.', 'Freezes, lets quality slip, or snaps at coworkers.', 0),
    (new_org_id, 'Bartender', 'Memory and rapport', 'How do you remember regulars'' usual orders?', 'Has a real system or habit and clearly cares about it.', 'Doesn''t try, or says it doesn''t really matter.', 1),
    (new_org_id, 'Chef', 'Consistency obsession', 'Tell me about a time you sent back your own team''s dish.', 'Holds a high bar even under pressure, cites a real standard.', 'Lets things slide to save time, no standard mentioned.', 0),
    (new_org_id, 'Chef', 'Coachability under pressure', 'Tell me about the last time a chef corrected you mid-service.', 'Took it well, adjusted immediately, no ego about it.', 'Got defensive, argued, or repeated the same mistake.', 1),
    (new_org_id, 'Manager', 'Leadership presence', 'Tell me about a time you had to correct a staff member mid-shift.', 'Direct but respectful, focused on the standard, not the person.', 'Avoided it, did it harshly in public, or let it slide.', 0),
    (new_org_id, 'Manager', 'Decision-making under conflict', 'A guest and a server disagree about what was ordered. What do you do?', 'Investigates fairly, protects the guest experience without throwing staff under the bus.', 'Automatically sides with one party, no real investigation.', 1);

  return new_org_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- 6. Replace the invite function to accept the target role (manager or
--    staff) instead of always creating a manager.
-- ---------------------------------------------------------------------------

drop function assign_manager_profile(uuid, text, uuid);

create function assign_team_member_profile(new_user_id uuid, full_name text, target_location_id uuid, target_role access_role)
returns void
language plpgsql security definer set search_path = public as $$
begin
  if not is_super_admin() then
    raise exception 'Only a Super Admin can add team members';
  end if;
  if target_role = 'super_admin' then
    raise exception 'Cannot invite another Super Admin';
  end if;
  if not exists (select 1 from locations where id = target_location_id and org_id = current_org_id()) then
    raise exception 'Location does not belong to your organization';
  end if;

  insert into profiles (id, org_id, full_name, access_role, location_id)
  values (new_user_id, current_org_id(), full_name, target_role, target_location_id)
  on conflict (id) do update set full_name = excluded.full_name, location_id = excluded.location_id, access_role = excluded.access_role;
end;
$$;

-- protect_profile_fields()'s body called is_gm(); redefine it against
-- is_super_admin() (plpgsql bodies aren't dependency-tracked the way SQL
-- functions and RLS policies are, so this could technically run anywhere,
-- but it's placed here to read naturally alongside the other updates).
create or replace function protect_profile_fields() returns trigger
  language plpgsql as $$
begin
  if auth.uid() = old.id and not is_super_admin() then
    if new.access_role is distinct from old.access_role
      or new.org_id is distinct from old.org_id
      or new.location_id is distinct from old.location_id then
      raise exception 'You cannot change your own role, org, or location';
    end if;
  end if;
  return new;
end;
$$;
