-- Web Push subscriptions (PWA notifications). One row per browser/device a user
-- has enabled notifications on; a user can have several. The subscription JSON
-- (endpoint + keys) is what web-push sends to. Deny-all RLS — only the service
-- role reads/writes these.
create table if not exists push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  endpoint text not null unique,
  subscription jsonb not null,
  user_agent text,
  created_at timestamptz not null default now(),
  last_used_at timestamptz
);
create index if not exists push_subscriptions_user_idx on push_subscriptions (user_id);
alter table push_subscriptions enable row level security; -- deny-all: service-role only
