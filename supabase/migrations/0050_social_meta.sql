-- Social planner Phase 2: Meta (Facebook + Instagram) auto-publish.
--
-- Stores the single brand connection (FB Page + linked IG account + the
-- long-lived Page access token) and a global auto-publish switch. Deny-all RLS
-- like the rest of the platform tables — the token is only ever read by the
-- service-role client in server code and is never sent to the browser.

create table social_settings (
  id int primary key default 1 check (id = 1),   -- single row
  fb_page_id text,
  fb_page_name text,
  page_access_token text,                          -- long-lived Page token
  ig_user_id text,                                 -- linked IG Business account
  ig_username text,
  token_expires_at timestamptz,
  auto_publish boolean not null default false,     -- publish automatically at post time
  connected_at timestamptz,
  connected_by uuid references profiles(id) on delete set null,
  updated_at timestamptz not null default now()
);
insert into social_settings (id) values (1) on conflict (id) do nothing;

alter table social_settings enable row level security; -- deny-all: service-role only

-- Publish results on each post.
alter table social_posts
  add column if not exists published_urls jsonb not null default '{}', -- {facebook: url, instagram: url}
  add column if not exists publish_error text,
  add column if not exists last_publish_at timestamptz;
