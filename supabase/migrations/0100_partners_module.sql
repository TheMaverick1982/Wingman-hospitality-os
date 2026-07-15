-- Partners (B2B / Community) module — foundation.
--
-- A relationship CRM for managers to nurture the local businesses around each
-- store (catering, group lunches, private events, happy-hour buyouts,
-- fundraisers). Bounce Back wins back guests; Partners wins businesses.
--
-- Two tables here: contacts (the businesses/people) and activities (every touch
-- against a contact). Goals + monthly-report snapshots land in a later migration
-- alongside their UI.
--
-- Access model: Partners is for owners and managers only. Staff and shift leads
-- get NO access — not even read — so policies gate on
-- current_access_role() in ('super_admin','manager') rather than the shared
-- is_manager_or_above() (which now includes shift_lead). Location scoping reuses
-- the existing can_access_location() helper, so a manager assigned to several
-- stores (via profile_locations / all_locations) sees exactly those stores, and
-- a super_admin sees the whole org (including org-wide contacts with a null
-- location, which can_access_location already limits to super_admin).

-- ---------------------------------------------------------------------------
-- Contacts
-- ---------------------------------------------------------------------------
create table partner_contacts (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id) on delete cascade,
  -- The store that owns this relationship. Null = org-wide (super_admin only).
  location_id uuid references locations(id) on delete set null,
  company_name text not null,
  contact_name text not null default '',
  title text not null default '',
  email text not null default '',
  phone text not null default '',
  category text not null default '',
  subcategory text not null default '',
  website text not null default '',
  address text not null default '',
  notes text not null default '',
  status text not null default 'active' check (status in ('active', 'archived')),
  -- Denormalized latest activity_date, kept current by the trigger below. Powers
  -- the Fading-Connections KPIs and the default "Needs Follow-up First" sort
  -- without a per-row subquery. Null = never contacted.
  last_activity_at date,
  created_by uuid references profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index partner_contacts_org_loc_idx on partner_contacts(org_id, location_id);
create index partner_contacts_fading_idx on partner_contacts(org_id, last_activity_at);

alter table partner_contacts enable row level security;

create policy partner_contacts_select on partner_contacts for select
  using (org_id = current_org_id() and current_access_role() in ('super_admin', 'manager') and can_access_location(location_id));
create policy partner_contacts_write on partner_contacts for all
  using (org_id = current_org_id() and current_access_role() in ('super_admin', 'manager') and can_access_location(location_id))
  with check (org_id = current_org_id() and current_access_role() in ('super_admin', 'manager') and can_access_location(location_id));

-- ---------------------------------------------------------------------------
-- Activities
-- ---------------------------------------------------------------------------
create table partner_activities (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id) on delete cascade,
  contact_id uuid not null references partner_contacts(id) on delete cascade,
  -- Copied from the contact so per-store rollups and RLS don't need a join.
  location_id uuid references locations(id) on delete set null,
  activity_date date not null default current_date,
  -- call_text / email / meeting reset the "warm" clock; event_booked and
  -- fundraiser_booked also count toward goals and usually carry revenue.
  activity_type text not null check (activity_type in ('call_text', 'email', 'meeting', 'event_booked', 'fundraiser_booked')),
  notes text not null default '',
  -- Actual booked revenue, entered after the event happens. Cents, like the
  -- rest of the money in the app. Null until known.
  revenue_cents integer,
  created_by uuid references profiles(id) on delete set null,
  created_at timestamptz not null default now()
);
create index partner_activities_contact_idx on partner_activities(contact_id, activity_date desc);
create index partner_activities_org_loc_date_idx on partner_activities(org_id, location_id, activity_date desc);

alter table partner_activities enable row level security;

create policy partner_activities_select on partner_activities for select
  using (org_id = current_org_id() and current_access_role() in ('super_admin', 'manager') and can_access_location(location_id));
create policy partner_activities_write on partner_activities for all
  using (org_id = current_org_id() and current_access_role() in ('super_admin', 'manager') and can_access_location(location_id))
  with check (org_id = current_org_id() and current_access_role() in ('super_admin', 'manager') and can_access_location(location_id));

-- ---------------------------------------------------------------------------
-- last_activity_at denormalization
-- ---------------------------------------------------------------------------
-- Recompute the owning contact's last_activity_at as the max activity_date of
-- its activities (null when none remain). Runs on insert/update/delete; if an
-- update moves an activity to a different contact, both are refreshed. Security
-- definer so the cross-row update isn't re-filtered by RLS.
create or replace function partner_touch_contact() returns trigger
  language plpgsql security definer set search_path = public as $$
declare
  cid uuid;
begin
  if TG_OP = 'DELETE' then
    cid := OLD.contact_id;
  else
    cid := NEW.contact_id;
  end if;

  update partner_contacts c
    set last_activity_at = (select max(a.activity_date) from partner_activities a where a.contact_id = cid)
    where c.id = cid;

  if TG_OP = 'UPDATE' and NEW.contact_id is distinct from OLD.contact_id then
    update partner_contacts c
      set last_activity_at = (select max(a.activity_date) from partner_activities a where a.contact_id = OLD.contact_id)
      where c.id = OLD.contact_id;
  end if;

  if TG_OP = 'DELETE' then
    return OLD;
  end if;
  return NEW;
end;
$$;

create trigger partner_activities_touch_contact
  after insert or update or delete on partner_activities
  for each row execute function partner_touch_contact();
