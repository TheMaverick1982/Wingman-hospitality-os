-- Phase 1A of the in-house sales CRM (platform-admin only, under /admin/crm).
--
-- Two tables: contacts (people in the pipeline) and activities (a unified
-- timeline — captured leads, notes, stage changes, and sent/received emails).
-- Every inbound lead (demo, sales-chat, calculator, scorecard) is mirrored here
-- by captureLead(). Like the other platform tables (leads, impersonation_log),
-- these are deny-all under RLS: all access is via the service-role admin client
-- from the /admin/crm server code, gated in-app by requirePlatformSection("crm").

create table crm_contacts (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,          -- always stored lowercased by the app
  name text,
  phone text,
  stage text not null default 'new' check (stage in ('new','engaged','demoed','signed_up','lost')),
  first_source text,                   -- the funnel they first came in through
  org_id uuid references organizations(id) on delete set null,  -- set if they convert
  unsubscribed boolean not null default false,
  notes text not null default '',
  last_activity_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index crm_contacts_stage_idx on crm_contacts (stage, last_activity_at desc);

create table crm_activities (
  id uuid primary key default gen_random_uuid(),
  contact_id uuid not null references crm_contacts(id) on delete cascade,
  kind text not null check (kind in ('lead','note','email_out','email_in','stage_change','system')),
  subject text,
  body text not null default '',
  meta jsonb not null default '{}',
  created_by uuid references profiles(id) on delete set null,  -- the staffer; null = system
  created_at timestamptz not null default now()
);
create index crm_activities_contact_idx on crm_activities (contact_id, created_at desc);

alter table crm_contacts enable row level security;   -- deny-all: service-role only
alter table crm_activities enable row level security;  -- deny-all: service-role only

-- Backfill existing leads → one contact per email (earliest lead sets the source),
-- plus a 'lead' activity per historical lead.
insert into crm_contacts (email, name, first_source, created_at, last_activity_at)
select distinct on (lower(l.email))
  lower(l.email), nullif(l.name, ''), l.source, l.created_at, l.created_at
from leads l
order by lower(l.email), l.created_at asc
on conflict (email) do nothing;

insert into crm_activities (contact_id, kind, body, meta, created_at)
select c.id, 'lead', 'Lead captured via ' || l.source,
       jsonb_build_object('source', l.source) || coalesce(l.payload, '{}'::jsonb), l.created_at
from leads l
join crm_contacts c on c.email = lower(l.email);

-- Point last_activity_at at the most recent activity so the board sorts sensibly.
update crm_contacts c
  set last_activity_at = a.mx
  from (select contact_id, max(created_at) as mx from crm_activities group by contact_id) a
  where a.contact_id = c.id;

-- Grant CRM access to existing full-access platform admins (mirrors 0038).
update profiles
  set platform_access = array_append(platform_access, 'crm')
  where is_platform_admin = true
    and 'organizations' = any(platform_access)
    and not ('crm' = any(platform_access));
