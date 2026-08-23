-- Google Business Profile reviews: connect a restaurant's Google account, map
-- each Wingman location to a Google Business location, pull its public reviews,
-- and let the AI read them for strengths / where to improve. Lives inside Guest
-- Reviews. Read-only against Google (no posting in v1).

-- The OAuth connection (per Google account, per org). Tokens are SECRETS: RLS is
-- enabled with NO policies, so the browser client can never read this table —
-- every access is via the service-role client in server code. An org can connect
-- more than one Google account (locations may live under different accounts).
create table if not exists google_business_accounts (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id) on delete cascade,
  google_sub text not null,                 -- stable Google account id
  email text not null default '',
  access_token text not null,
  refresh_token text not null default '',
  token_expires_at timestamptz,
  scopes text not null default '',
  connected_by uuid references profiles(id) on delete set null,
  connected_at timestamptz not null default now(),
  unique (org_id, google_sub)
);
alter table google_business_accounts enable row level security;
-- Deny-all: no policies. Access is exclusively via the service-role client.

-- Which Google Business location each Wingman location is mapped to, plus cached
-- rating/count, last sync, and the latest AI insight. No secrets here, so it's
-- readable by the org (managers) and manageable by managers.
create table if not exists google_review_locations (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id) on delete cascade,
  location_id uuid not null references locations(id) on delete cascade,
  account_id uuid not null references google_business_accounts(id) on delete cascade,
  google_account_id text not null,          -- bare account id (v4 path)
  google_location_id text not null,         -- bare location id (v4 path)
  location_title text not null default '',  -- the Google location's display name
  average_rating numeric,
  review_count integer not null default 0,
  last_synced_at timestamptz,
  last_sync_status text,                     -- 'ok' | 'error: ...'
  insight jsonb,                             -- AI analysis (strengths/improvements/themes/actions/trend)
  insight_generated_at timestamptz,
  created_at timestamptz not null default now(),
  unique (org_id, location_id)
);
create index if not exists google_review_locations_org_idx on google_review_locations(org_id, location_id);
alter table google_review_locations enable row level security;
create policy google_review_locations_select on google_review_locations for select using (org_id = current_org_id());
create policy google_review_locations_write on google_review_locations for all
  using (org_id = current_org_id() and is_manager_or_above())
  with check (org_id = current_org_id() and is_manager_or_above());

-- Cached individual reviews per mapped location.
create table if not exists google_reviews (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id) on delete cascade,
  location_id uuid not null references locations(id) on delete cascade,
  google_review_id text not null,           -- Google's stable review id
  reviewer_name text not null default '',
  star_rating integer not null default 0,   -- 1..5
  comment text not null default '',
  reply_comment text,                        -- the business's existing reply, if any
  review_created_at timestamptz,
  review_updated_at timestamptz,
  synced_at timestamptz not null default now(),
  unique (org_id, google_review_id)
);
create index if not exists google_reviews_loc_idx on google_reviews(org_id, location_id, review_created_at desc);
alter table google_reviews enable row level security;
create policy google_reviews_select on google_reviews for select using (org_id = current_org_id());
-- Written only by the service-role client during sync (no browser writes needed).

notify pgrst, 'reload schema';
