-- Cache of AI-translated, owner-authored content (test questions, training,
-- checklist items, menu). Keyed by a hash of the source text so each unique
-- string is translated once per language and reused thereafter. English is the
-- source language and is never stored here (it's the identity).
create table if not exists content_translations (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id) on delete cascade,
  lang text not null check (lang in ('es')),
  source_hash text not null,
  translated text not null,
  created_at timestamptz not null default now(),
  unique (org_id, lang, source_hash)
);

create index if not exists content_translations_lookup
  on content_translations (org_id, lang, source_hash);

alter table content_translations enable row level security;

-- Anyone in the org may read cached translations; writes go through the
-- service-role client (translation is generated server-side), so there's no
-- insert/update policy for regular members.
drop policy if exists content_translations_select on content_translations;
create policy content_translations_select on content_translations
  for select using (org_id = current_org_id());
