-- Social planner Phase 3: LinkedIn (personal profile) auto-publish.
--
-- Extends the single-row social_settings with the LinkedIn member connection.
-- Same deny-all RLS; the token is only ever read by the service-role client.
-- Posting uses the member's own w_member_social permission (no Company Page /
-- Community Management API, which would need LinkedIn approval).

alter table social_settings
  add column if not exists li_member_id text,          -- urn:li:person:<id>
  add column if not exists li_member_name text,
  add column if not exists li_access_token text,       -- ~60-day token
  add column if not exists li_token_expires_at timestamptz,
  add column if not exists li_connected_at timestamptz,
  add column if not exists li_connected_by uuid references profiles(id) on delete set null;

-- social_posts.platforms is a free text[] (no constraint), so "linkedin" is
-- already storable — no change needed there.
