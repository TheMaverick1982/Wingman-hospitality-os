-- Lightweight, database-backed rate limiting for expensive/abusable endpoints.
--
-- Why in the database: the app runs on serverless (Vercel) where there's no
-- shared in-process memory between requests, so a counter has to live somewhere
-- durable. This table + function give a simple fixed-window limiter that every
-- server instance shares, with no extra infrastructure (Redis/KV) to run.
--
-- Buckets are opaque strings chosen by the caller, e.g.:
--   'ai:<org_id>'      -> caps AI-generation spend per organization
--   'apiv1:<key_id>'   -> caps external API calls per key
--
-- The function is SECURITY DEFINER and only callable by the service role: the
-- app always invokes it through the service-role (admin) client, and we don't
-- want a signed-in user hitting it directly via PostgREST to inflate someone
-- else's counter.

create table if not exists rate_limit_hits (
  id bigint generated always as identity primary key,
  bucket text not null,
  created_at timestamptz not null default now()
);

create index if not exists rate_limit_hits_bucket_time_idx
  on rate_limit_hits (bucket, created_at desc);

-- Atomically: prune this bucket's expired rows, count what's left in the
-- window, and (if under the limit) record one more hit. Returns true when the
-- caller is allowed to proceed, false when the limit is already reached.
create or replace function rate_limit_consume(
  p_bucket text,
  p_max integer,
  p_window_seconds integer
) returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  hits integer;
begin
  -- Keep the table bounded: drop this bucket's rows older than the window.
  delete from rate_limit_hits
    where bucket = p_bucket
      and created_at < now() - make_interval(secs => p_window_seconds);

  select count(*) into hits
    from rate_limit_hits
    where bucket = p_bucket
      and created_at > now() - make_interval(secs => p_window_seconds);

  if hits >= p_max then
    return false;
  end if;

  insert into rate_limit_hits (bucket) values (p_bucket);
  return true;
end;
$$;

-- Lock the function down to the service role only.
revoke all on function rate_limit_consume(text, integer, integer) from public;
revoke all on function rate_limit_consume(text, integer, integer) from anon, authenticated;
grant execute on function rate_limit_consume(text, integer, integer) to service_role;

-- The table is only ever touched by the SECURITY DEFINER function above and the
-- service-role client; enable RLS with no policies so no ordinary role can read
-- or write it directly.
alter table rate_limit_hits enable row level security;
