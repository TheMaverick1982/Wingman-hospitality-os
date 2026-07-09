-- Per-organization API keys for external integrations (POS sync, Zapier, etc.).
--
-- Security model:
--   * We store only a SHA-256 HASH of each key, never the plaintext. The
--     plaintext is shown to the Super Admin exactly once, at creation.
--   * key_prefix is a short, non-secret display fragment (e.g. "wm_live_ab12cd")
--     so the owner can tell keys apart in the UI.
--   * Keys are revocable (revoked_at); the API rejects revoked keys.
--   * Only Super Admins of the owning org can see or manage their keys (RLS).
--   * The API request path authenticates with the service-role client and looks
--     the key up by hash, then scopes every query to that key's org_id.

create table api_keys (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id) on delete cascade,
  name text not null default '',
  key_prefix text not null,
  key_hash text not null unique,
  created_by uuid references profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  last_used_at timestamptz,
  revoked_at timestamptz
);

create index api_keys_org_id_idx on api_keys(org_id);
create index api_keys_key_hash_idx on api_keys(key_hash);

alter table api_keys enable row level security;

create policy api_keys_select on api_keys for select
  using (org_id = current_org_id() and is_super_admin());

create policy api_keys_write on api_keys for all
  using (org_id = current_org_id() and is_super_admin())
  with check (org_id = current_org_id() and is_super_admin());
