-- Manager channel (#2): a single org-wide channel where owners, managers, and
-- shift leads talk — post updates and reply in threads. Standalone (not tied to
-- a location or another feature). Managers-only by RLS; staff never see it.
-- parent_id null = a top-level post; set = a reply to that post.
create table manager_channel_messages (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id) on delete cascade,
  parent_id uuid references manager_channel_messages(id) on delete cascade,
  author_id uuid references profiles(id) on delete set null,
  author_name text not null default '',
  body text not null,
  created_at timestamptz not null default now(),
  deleted_at timestamptz               -- soft delete only
);
create index manager_channel_org_created_idx on manager_channel_messages(org_id, created_at desc);
create index manager_channel_parent_idx on manager_channel_messages(parent_id, created_at);

alter table manager_channel_messages enable row level security;
-- Managers/owners/shift-leads read and write; no one else can even see it.
create policy manager_channel_select on manager_channel_messages for select
  using (org_id = current_org_id() and is_manager_or_above());
create policy manager_channel_insert on manager_channel_messages for insert
  with check (org_id = current_org_id() and is_manager_or_above() and author_id = auth.uid());
-- Author edits/soft-deletes their own; any manager can soft-delete (moderation).
create policy manager_channel_update on manager_channel_messages for update
  using (org_id = current_org_id() and is_manager_or_above())
  with check (org_id = current_org_id() and is_manager_or_above());
