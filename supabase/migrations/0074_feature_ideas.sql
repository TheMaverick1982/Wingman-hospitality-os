-- Feature Ideas board. A shared, cross-customer wishlist: anyone can post an
-- idea and upvote others', so demand is visible in one place. The submitter's
-- org is stored for internal follow-up + alerting but never shown to other
-- customers. Platform staff set status (via the service-role client).
create table feature_ideas (
  id uuid primary key default gen_random_uuid(),
  org_id uuid references organizations(id) on delete set null,
  submitted_by uuid references profiles(id) on delete set null,
  title text not null,
  details text not null default '',
  status text not null default 'open' check (status in ('open', 'planned', 'in_progress', 'shipped', 'declined')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index feature_ideas_created_idx on feature_ideas(created_at desc);

create table feature_idea_votes (
  id uuid primary key default gen_random_uuid(),
  idea_id uuid not null references feature_ideas(id) on delete cascade,
  profile_id uuid not null references profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (idea_id, profile_id)
);
create index feature_idea_votes_idea_idx on feature_idea_votes(idea_id);

alter table feature_ideas enable row level security;
alter table feature_idea_votes enable row level security;

-- The board is intentionally cross-org: every signed-in user sees every idea and
-- vote (that's the point of shared demand). Writes are limited to your own rows.
create policy feature_ideas_select on feature_ideas for select using (auth.uid() is not null);
create policy feature_ideas_insert on feature_ideas for insert with check (submitted_by = auth.uid());
create policy feature_ideas_delete on feature_ideas for delete using (submitted_by = auth.uid());

create policy feature_idea_votes_select on feature_idea_votes for select using (auth.uid() is not null);
create policy feature_idea_votes_insert on feature_idea_votes for insert with check (profile_id = auth.uid());
create policy feature_idea_votes_delete on feature_idea_votes for delete using (profile_id = auth.uid());
