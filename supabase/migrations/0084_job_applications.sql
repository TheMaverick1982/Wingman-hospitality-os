-- Public job-application intake + a "new hires" tracker (no applicant logins).
-- Applications arrive from a hosted/embeddable form, land here with a status,
-- and can be scheduled for a visit and later turned into a hiring candidate.

-- Org identity for the public apply link (no subdomains — a path slug) plus a
-- logo and an on/off switch for the form.
alter table organizations add column if not exists public_slug text;
alter table organizations add column if not exists logo_url text;
alter table organizations add column if not exists apply_enabled boolean not null default true;

-- Auto-generate a URL-safe slug on insert; backfill existing orgs below.
create or replace function set_org_public_slug() returns trigger as $$
begin
  if new.public_slug is null then
    new.public_slug := trim(both '-' from lower(regexp_replace(coalesce(new.name, 'org'), '[^a-zA-Z0-9]+', '-', 'g')))
      || '-' || substr(md5(new.id::text || clock_timestamp()::text), 1, 6);
  end if;
  return new;
end;
$$ language plpgsql;

drop trigger if exists org_public_slug on organizations;
create trigger org_public_slug before insert on organizations
  for each row execute function set_org_public_slug();

update organizations
set public_slug = trim(both '-' from lower(regexp_replace(coalesce(name, 'org'), '[^a-zA-Z0-9]+', '-', 'g'))) || '-' || substr(md5(id::text), 1, 6)
where public_slug is null;

create unique index if not exists organizations_public_slug_key on organizations(public_slug);

-- Applications.
create table if not exists job_applications (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id) on delete cascade,
  location_id uuid references locations(id) on delete set null,
  department text not null default '',
  name text not null,
  email text not null default '',
  phone text not null default '',
  availability text not null default '',
  message text not null default '',
  resume_path text,
  preferred_visit_at timestamptz,
  visit_confirmed boolean not null default false,
  status text not null default 'new' check (status in ('new', 'contacted', 'not_a_fit', 'hired')),
  candidate_id uuid references candidates(id) on delete set null,
  source text not null default 'link',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists job_applications_org_status_idx on job_applications(org_id, status, created_at desc);

alter table job_applications enable row level security;

-- Applicants are submitted by unauthenticated visitors via the service-role
-- client (which validates the org by its public slug), so there is no public
-- insert policy. Managers and above read/manage their org's applications; the
-- app further scopes to Hiring access and accessible locations.
drop policy if exists job_applications_select on job_applications;
create policy job_applications_select on job_applications for select
  using (org_id = current_org_id() and is_manager_or_above());
drop policy if exists job_applications_write on job_applications;
create policy job_applications_write on job_applications for all
  using (org_id = current_org_id() and is_manager_or_above())
  with check (org_id = current_org_id() and is_manager_or_above());

-- Private bucket for uploaded resumes — reads/writes go through the admin
-- client, gated by Hiring access in the app.
insert into storage.buckets (id, name, public)
values ('resumes', 'resumes', false)
on conflict (id) do nothing;
