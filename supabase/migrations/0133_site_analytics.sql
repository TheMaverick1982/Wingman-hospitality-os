-- First-party visitor analytics. Anonymous page views keyed by a first-party
-- cookie (wm_vid). No third parties, no identity graphs — just our own record of
-- which pages a visitor saw. When a visitor later converts (lead / contact form /
-- demo booking) their visitor_id is linked to the CRM contact, so the team can see
-- the pages a lead viewed before converting.
create table if not exists site_page_views (
  id uuid primary key default gen_random_uuid(),
  visitor_id uuid not null,
  path text not null,
  referrer text,
  utm_source text,
  utm_medium text,
  utm_campaign text,
  created_at timestamptz not null default now()
);
create index if not exists site_page_views_visitor_idx on site_page_views (visitor_id, created_at desc);
create index if not exists site_page_views_created_idx on site_page_views (created_at desc);
alter table site_page_views enable row level security; -- deny-all: service-role only

-- Tie a CRM contact to their anonymous visitor id (set at conversion).
alter table crm_contacts add column if not exists visitor_id uuid;
create index if not exists crm_contacts_visitor_idx on crm_contacts (visitor_id) where visitor_id is not null;
