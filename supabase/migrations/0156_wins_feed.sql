-- Shift Hub, Slice 3: the Wins feed. Recognition goes team-wide — any team
-- member shares a win or shouts out a teammate (not just managers), everyone
-- sees it, and anyone can celebrate it. Built on the existing culture_moments.

-- 'win' (I did/we did something good — no target) vs 'shoutout' (recognizing a
-- teammate, the existing behavior). Existing rows default to 'shoutout'.
alter table culture_moments add column if not exists kind text not null default 'shoutout';

-- Open posting to the whole team: you post as yourself (created_by = auth.uid()),
-- so no one can attribute a post to someone else. This replaces the 0002 policy
-- that limited posting to managers — recognition works best bottom-up too.
drop policy if exists culture_moments_insert on culture_moments;
create policy culture_moments_insert on culture_moments for insert
  with check (org_id = current_org_id() and created_by = auth.uid());

-- A poster can remove their own post; managers/shift-leads can remove any
-- (moderation). Recognition posts are small and non-critical, so a hard delete
-- of your own is fine here (unlike guest/partner/staff data, which soft-delete).
drop policy if exists culture_moments_delete on culture_moments;
create policy culture_moments_delete on culture_moments for delete
  using (org_id = current_org_id() and (created_by = auth.uid() or is_manager_or_above()));

-- Celebrate reactions — one per person per moment.
create table culture_moment_reactions (
  moment_id uuid not null references culture_moments(id) on delete cascade,
  user_id uuid not null references profiles(id) on delete cascade,
  org_id uuid not null references organizations(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (moment_id, user_id)
);
create index culture_moment_reactions_moment_idx on culture_moment_reactions(moment_id);

alter table culture_moment_reactions enable row level security;
create policy cmr_select on culture_moment_reactions for select
  using (org_id = current_org_id());
create policy cmr_insert on culture_moment_reactions for insert
  with check (org_id = current_org_id() and user_id = auth.uid());
create policy cmr_delete on culture_moment_reactions for delete
  using (org_id = current_org_id() and user_id = auth.uid());
