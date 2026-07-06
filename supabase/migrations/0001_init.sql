-- Wingman schema: multi-tenant hospitality operations platform.
-- Tenant boundary is `organizations`. Every other table carries org_id and is
-- isolated by Row Level Security. Two access roles exist per user:
--   'gm'      - General Manager, sees/edits everything in their org
--   'manager' - Store Manager, locked to one location (profiles.location_id)

create extension if not exists pgcrypto;

create type app_department as enum ('Host', 'Server', 'Bartender', 'Chef', 'Manager');
create type access_role as enum ('gm', 'manager');
create type culture_tag as enum ('Ownership', 'Guest Connection', 'Teamwork', 'Went Above');
create type candidate_recommendation as enum ('Strong fit', 'Fit', 'Unsure', 'Not a fit');

-- ---------------------------------------------------------------------------
-- Core tenancy
-- ---------------------------------------------------------------------------

create table organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  philosophy text not null default 'We are not in the food business. We are in the business of creating guest experiences that drive emotional connection, repeat visits, and long-term loyalty.',
  weekly_focus text not null default '',
  total_revenue numeric not null default 0,
  system_generated boolean not null default false,
  created_at timestamptz not null default now()
);

create table locations (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now()
);

create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  org_id uuid not null references organizations(id) on delete cascade,
  full_name text not null default '',
  access_role access_role not null,
  location_id uuid references locations(id) on delete set null,
  created_at timestamptz not null default now(),
  constraint manager_requires_location check (access_role = 'gm' or location_id is not null)
);

create index profiles_org_id_idx on profiles(org_id);
create index locations_org_id_idx on locations(org_id);

-- ---------------------------------------------------------------------------
-- Culture & training system (GM-authored, org-wide read)
-- ---------------------------------------------------------------------------

create table core_values (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id) on delete cascade,
  title text not null,
  description text not null,
  hiring_question text,
  hiring_green_flag text,
  hiring_red_flag text,
  sort_order int not null default 0
);

create table department_standards (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id) on delete cascade,
  department app_department not null,
  item text not null,
  sort_order int not null default 0
);

create table department_meta (
  org_id uuid not null references organizations(id) on delete cascade,
  department app_department not null,
  track_label text not null default '',
  has_menu boolean not null default false,
  primary key (org_id, department)
);

create table department_training_items (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id) on delete cascade,
  department app_department not null,
  item text not null,
  sort_order int not null default 0
);

create table menu_references (
  org_id uuid not null references organizations(id) on delete cascade,
  department app_department not null,
  content text not null default '',
  primary key (org_id, department)
);

create table hiring_traits (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id) on delete cascade,
  department app_department not null,
  title text not null,
  question text not null,
  green_flag text not null,
  red_flag text not null,
  sort_order int not null default 0
);

create index core_values_org_id_idx on core_values(org_id);
create index department_standards_org_dept_idx on department_standards(org_id, department);
create index department_training_items_org_dept_idx on department_training_items(org_id, department);
create index hiring_traits_org_dept_idx on hiring_traits(org_id, department);

-- ---------------------------------------------------------------------------
-- Guest bounce-back (shared org-wide, not location-locked - a guest can
-- return at a different location than they first visited)
-- ---------------------------------------------------------------------------

create table guests (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id) on delete cascade,
  name text not null,
  phone text not null default '',
  email text not null default '',
  created_at timestamptz not null default now()
);

create table guest_visits (
  id uuid primary key default gen_random_uuid(),
  guest_id uuid not null references guests(id) on delete cascade,
  org_id uuid not null references organizations(id) on delete cascade,
  visit_number smallint not null check (visit_number between 1 and 4),
  visit_date date,
  location_id uuid references locations(id) on delete set null,
  incentive text not null default '',
  notes text not null default '',
  unique (guest_id, visit_number)
);

create index guests_org_id_idx on guests(org_id);
create index guest_visits_org_id_idx on guest_visits(org_id);
create index guest_visits_guest_id_idx on guest_visits(guest_id);

-- ---------------------------------------------------------------------------
-- Culture wall & training sign-offs (org-wide, append-only)
-- ---------------------------------------------------------------------------

create table culture_moments (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id) on delete cascade,
  author text not null,
  about text not null,
  tag culture_tag not null,
  message text not null,
  created_by uuid references profiles(id) on delete set null,
  occurred_on date not null default current_date,
  created_at timestamptz not null default now()
);

create table training_signoffs (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id) on delete cascade,
  staff_name text not null,
  department app_department not null,
  completion_pct smallint not null check (completion_pct between 0 and 100),
  occurred_on date not null default current_date,
  created_by uuid references profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create index culture_moments_org_id_idx on culture_moments(org_id);
create index training_signoffs_org_id_idx on training_signoffs(org_id);

-- ---------------------------------------------------------------------------
-- Location-scoped operational logs (Store Managers see only their location)
-- ---------------------------------------------------------------------------

create table discounts (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id) on delete cascade,
  location_id uuid not null references locations(id) on delete cascade,
  occurred_on date not null,
  server_name text not null,
  category text not null,
  reason text not null,
  amount numeric not null,
  notes text not null default '',
  created_by uuid references profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create table spot_checks (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id) on delete cascade,
  location_id uuid not null references locations(id) on delete cascade,
  staff_name text not null,
  department app_department not null,
  occurred_on date not null,
  scores smallint[] not null,
  felt_like_transaction boolean not null default false,
  notes text not null default '',
  created_by uuid references profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create table daily_checklists (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id) on delete cascade,
  location_id uuid not null references locations(id) on delete cascade,
  manager_name text not null,
  occurred_on date not null,
  checked boolean[] not null,
  notes text not null default '',
  created_by uuid references profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create table candidates (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id) on delete cascade,
  location_id uuid not null references locations(id) on delete cascade,
  name text not null,
  department app_department not null,
  occurred_on date not null,
  scores smallint[] not null,
  recommendation candidate_recommendation not null,
  notes text not null default '',
  created_by uuid references profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create index discounts_org_location_idx on discounts(org_id, location_id);
create index spot_checks_org_location_idx on spot_checks(org_id, location_id);
create index daily_checklists_org_location_idx on daily_checklists(org_id, location_id);
create index candidates_org_location_idx on candidates(org_id, location_id);

-- ---------------------------------------------------------------------------
-- Auth helper functions (security definer to avoid RLS recursion on profiles)
-- ---------------------------------------------------------------------------

create function current_org_id() returns uuid
  language sql stable security definer set search_path = public as $$
    select org_id from profiles where id = auth.uid()
  $$;

create function current_access_role() returns access_role
  language sql stable security definer set search_path = public as $$
    select access_role from profiles where id = auth.uid()
  $$;

create function current_location_id() returns uuid
  language sql stable security definer set search_path = public as $$
    select location_id from profiles where id = auth.uid()
  $$;

create function is_gm() returns boolean
  language sql stable security definer set search_path = public as $$
    select coalesce((select access_role from profiles where id = auth.uid()) = 'gm', false)
  $$;

create function can_access_location(target_location uuid) returns boolean
  language sql stable security definer set search_path = public as $$
    select is_gm() or target_location = current_location_id()
  $$;

-- Bootstraps a brand-new GM + org together, bypassing RLS (profiles has no
-- row yet for this user, so ordinary policies can't apply). Also seeds the
-- default culture/training content so a fresh org isn't empty.
create function create_organization(org_name text, gm_full_name text, first_location_name text)
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
    values (auth.uid(), new_org_id, gm_full_name, 'gm', null);

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

-- Invites (or reassigns) a Store Manager into the caller's org. The auth.users
-- row + email invite is created separately, server-side, with the service
-- role key; this function only wires up the resulting profile and is locked
-- to GMs acting within their own org.
create function assign_manager_profile(new_user_id uuid, full_name text, target_location_id uuid)
returns void
language plpgsql security definer set search_path = public as $$
begin
  if not is_gm() then
    raise exception 'Only a General Manager can add Store Managers';
  end if;
  if not exists (select 1 from locations where id = target_location_id and org_id = current_org_id()) then
    raise exception 'Location does not belong to your organization';
  end if;

  insert into profiles (id, org_id, full_name, access_role, location_id)
  values (new_user_id, current_org_id(), full_name, 'manager', target_location_id)
  on conflict (id) do update set full_name = excluded.full_name, location_id = excluded.location_id;
end;
$$;

-- Prevents a user from editing their own access_role/org/location — only a
-- GM (editing someone else's profile) may change those fields.
create function protect_profile_fields() returns trigger
  language plpgsql as $$
begin
  if auth.uid() = old.id and not is_gm() then
    if new.access_role is distinct from old.access_role
      or new.org_id is distinct from old.org_id
      or new.location_id is distinct from old.location_id then
      raise exception 'You cannot change your own role, org, or location';
    end if;
  end if;
  return new;
end;
$$;

create trigger profiles_protect_fields
  before update on profiles
  for each row execute function protect_profile_fields();

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------

alter table organizations enable row level security;
alter table locations enable row level security;
alter table profiles enable row level security;
alter table core_values enable row level security;
alter table department_standards enable row level security;
alter table department_meta enable row level security;
alter table department_training_items enable row level security;
alter table menu_references enable row level security;
alter table hiring_traits enable row level security;
alter table guests enable row level security;
alter table guest_visits enable row level security;
alter table culture_moments enable row level security;
alter table training_signoffs enable row level security;
alter table discounts enable row level security;
alter table spot_checks enable row level security;
alter table daily_checklists enable row level security;
alter table candidates enable row level security;

create policy organizations_select on organizations for select using (id = current_org_id());
create policy organizations_update on organizations for update using (id = current_org_id() and is_gm());

create policy locations_select on locations for select using (org_id = current_org_id());
create policy locations_write on locations for all
  using (org_id = current_org_id() and is_gm())
  with check (org_id = current_org_id() and is_gm());

create policy profiles_select on profiles for select using (org_id = current_org_id());
create policy profiles_update on profiles for update
  using (org_id = current_org_id() and (id = auth.uid() or is_gm()));

-- GM-authored system content: everyone in the org can read, only GM writes.
create policy core_values_select on core_values for select using (org_id = current_org_id());
create policy core_values_write on core_values for all
  using (org_id = current_org_id() and is_gm()) with check (org_id = current_org_id() and is_gm());

create policy department_standards_select on department_standards for select using (org_id = current_org_id());
create policy department_standards_write on department_standards for all
  using (org_id = current_org_id() and is_gm()) with check (org_id = current_org_id() and is_gm());

create policy department_meta_select on department_meta for select using (org_id = current_org_id());
create policy department_meta_write on department_meta for all
  using (org_id = current_org_id() and is_gm()) with check (org_id = current_org_id() and is_gm());

create policy department_training_items_select on department_training_items for select using (org_id = current_org_id());
create policy department_training_items_write on department_training_items for all
  using (org_id = current_org_id() and is_gm()) with check (org_id = current_org_id() and is_gm());

create policy menu_references_select on menu_references for select using (org_id = current_org_id());
create policy menu_references_write on menu_references for all
  using (org_id = current_org_id() and is_gm()) with check (org_id = current_org_id() and is_gm());

create policy hiring_traits_select on hiring_traits for select using (org_id = current_org_id());
create policy hiring_traits_write on hiring_traits for all
  using (org_id = current_org_id() and is_gm()) with check (org_id = current_org_id() and is_gm());

-- Guest bounce-back: shared org-wide, any org member can log/edit/delete.
create policy guests_all on guests for all
  using (org_id = current_org_id()) with check (org_id = current_org_id());
create policy guest_visits_all on guest_visits for all
  using (org_id = current_org_id()) with check (org_id = current_org_id());

-- Culture wall & training sign-offs: org-wide, append-only from the client.
create policy culture_moments_select on culture_moments for select using (org_id = current_org_id());
create policy culture_moments_insert on culture_moments for insert with check (org_id = current_org_id());

create policy training_signoffs_select on training_signoffs for select using (org_id = current_org_id());
create policy training_signoffs_insert on training_signoffs for insert with check (org_id = current_org_id());

-- Location-scoped operational logs: Store Managers restricted to their own
-- location_id; GMs see and act across every location in the org.
create policy discounts_select on discounts for select
  using (org_id = current_org_id() and can_access_location(location_id));
create policy discounts_insert on discounts for insert
  with check (org_id = current_org_id() and can_access_location(location_id));
create policy discounts_delete on discounts for delete
  using (org_id = current_org_id() and can_access_location(location_id));

create policy spot_checks_select on spot_checks for select
  using (org_id = current_org_id() and can_access_location(location_id));
create policy spot_checks_insert on spot_checks for insert
  with check (org_id = current_org_id() and can_access_location(location_id));

create policy daily_checklists_select on daily_checklists for select
  using (org_id = current_org_id() and can_access_location(location_id));
create policy daily_checklists_insert on daily_checklists for insert
  with check (org_id = current_org_id() and can_access_location(location_id));

create policy candidates_select on candidates for select
  using (org_id = current_org_id() and can_access_location(location_id));
create policy candidates_insert on candidates for insert
  with check (org_id = current_org_id() and can_access_location(location_id));
