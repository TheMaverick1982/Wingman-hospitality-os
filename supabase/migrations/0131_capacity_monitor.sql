-- Capacity watchdog: fire an alert email to the owner as usage approaches a
-- service tier's limit (Supabase storage, Resend/Twilio monthly volume, AI spend,
-- CRM cron backlog). Mirrors the error-monitor pattern: measure → dedupe → email.

-- One row per fired alert (metric + level). Used to dedupe so an ongoing breach
-- doesn't email every day — the watchdog only alerts a given metric+level once per
-- 30 days (an escalation warn→critical is a new level, so it alerts again).
create table if not exists capacity_alerts (
  id uuid primary key default gen_random_uuid(),
  metric text not null,
  level text not null check (level in ('warn', 'critical')),
  value numeric,
  threshold numeric,
  message text,
  created_at timestamptz not null default now()
);
create index if not exists capacity_alerts_metric_idx on capacity_alerts (metric, created_at desc);
alter table capacity_alerts enable row level security;  -- deny-all: service-role only

-- Daily send volume per channel, incremented best-effort by the send helpers so
-- the watchdog can compare month-to-date volume to the Resend/Twilio plan caps
-- (neither provider exposes a clean "usage vs limit" API).
create table if not exists provider_usage_daily (
  day date not null,
  channel text not null check (channel in ('email', 'sms')),
  count integer not null default 0,
  primary key (day, channel)
);
alter table provider_usage_daily enable row level security;  -- deny-all: service-role only

-- Atomic increment — avoids read-modify-write races across concurrent serverless
-- invocations. security definer so the service-role caller (which already bypasses
-- RLS) and any future path can upsert without a policy.
create or replace function bump_provider_usage(p_channel text, p_n integer)
returns void language sql security definer set search_path = public as $$
  insert into provider_usage_daily (day, channel, count)
  values (current_date, p_channel, greatest(p_n, 0))
  on conflict (day, channel) do update set count = provider_usage_daily.count + greatest(p_n, 0);
$$;

-- Current database size in bytes, for the storage-tier check. Callable via rpc.
create or replace function db_size_bytes()
returns bigint language sql security definer set search_path = public as $$
  select pg_database_size(current_database());
$$;
